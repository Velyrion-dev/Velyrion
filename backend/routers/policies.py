"""Policy Engine Router — YAML-based governance policy management."""

import yaml
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/policies", tags=["policies"])

POLICY_DIR = Path(__file__).parent.parent.parent / "policies"


class PolicyRule(BaseModel):
    name: str
    condition: str
    action: str  # BLOCK, WARN, REQUIRE_APPROVAL, KILL, THROTTLE
    severity: str = "MEDIUM"
    message: str = ""


class PolicySchema(BaseModel):
    name: str
    version: str = "1.0"
    agents: list[str] = ["*"]
    rules: list[PolicyRule]


class PolicyResponse(BaseModel):
    filename: str
    name: str
    version: str
    agents: list[str]
    rules_count: int


# ── List all policies ────────────────────────────────────────────────────

@router.get("", response_model=list[PolicyResponse])
async def list_policies():
    """List all YAML policy files."""
    policies = []
    if not POLICY_DIR.exists():
        return policies

    for f in sorted(POLICY_DIR.glob("*.yaml")):
        try:
            with open(f) as fh:
                data = yaml.safe_load(fh)
            p = data.get("policy", data)
            policies.append(PolicyResponse(
                filename=f.name,
                name=p.get("name", f.stem),
                version=p.get("version", "1.0"),
                agents=p.get("agents", ["*"]),
                rules_count=len(p.get("rules", [])),
            ))
        except Exception:
            pass

    return policies


# ── Get a specific policy ────────────────────────────────────────────────

@router.get("/{filename}")
async def get_policy(filename: str):
    """Get full policy content by filename."""
    path = POLICY_DIR / filename
    if not path.exists() or not path.suffix == ".yaml":
        raise HTTPException(404, f"Policy '{filename}' not found")

    with open(path) as f:
        data = yaml.safe_load(f)
    return data


# ── Create/update a policy ───────────────────────────────────────────────

@router.post("", status_code=201)
async def create_policy(policy: PolicySchema):
    """Create or update a YAML policy file."""
    POLICY_DIR.mkdir(parents=True, exist_ok=True)

    filename = policy.name.lower().replace(" ", "-") + ".yaml"
    path = POLICY_DIR / filename

    data = {
        "policy": {
            "name": policy.name,
            "version": policy.version,
            "agents": policy.agents,
            "rules": [r.model_dump() for r in policy.rules],
        }
    }

    with open(path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)

    return {"filename": filename, "message": f"Policy '{policy.name}' saved"}


# ── Delete a policy ─────────────────────────────────────────────────────

@router.delete("/{filename}")
async def delete_policy(filename: str):
    """Delete a policy file."""
    path = POLICY_DIR / filename
    if not path.exists():
        raise HTTPException(404, f"Policy '{filename}' not found")

    os.remove(path)
    return {"message": f"Policy '{filename}' deleted"}


# ── Evaluate policies against an action ──────────────────────────────────

class EvalRequest(BaseModel):
    agent_id: str
    tool_used: str = ""
    task: str = ""
    confidence_score: float = 1.0
    token_cost: int = 0
    duration_ms: int = 0
    cost_usd: float = 0.0
    allowed_tools: list[str] = []
    max_token_budget: int = 999999


class EvalViolation(BaseModel):
    rule_name: str
    action: str
    severity: str
    message: str
    policy_file: str


@router.post("/evaluate", response_model=list[EvalViolation])
async def evaluate_policies(req: EvalRequest):
    """Evaluate all policies against a proposed action."""
    # Lazy import to avoid circular dependency
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent / "sdk"))

    try:
        from velyrion.policy import Policy
    except ImportError:
        raise HTTPException(500, "SDK policy module not available")

    all_violations = []

    if not POLICY_DIR.exists():
        return all_violations

    for f in POLICY_DIR.glob("*.yaml"):
        try:
            policy = Policy.from_file(str(f))
            violations = policy.evaluate(
                agent_id=req.agent_id,
                tool=req.tool_used,
                task=req.task,
                confidence=req.confidence_score,
                tokens=req.token_cost,
                duration_ms=req.duration_ms,
                cost_usd=req.cost_usd,
                allowed_tools=req.allowed_tools,
                max_token_budget=req.max_token_budget,
            )
            for v in violations:
                all_violations.append(EvalViolation(
                    rule_name=v.rule_name,
                    action=v.action,
                    severity=v.severity,
                    message=v.message,
                    policy_file=f.name,
                ))
        except Exception:
            pass

    return all_violations
