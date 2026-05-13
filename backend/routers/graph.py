"""Graph Intelligence Router — Agent behavior graph with blast radius analysis."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Agent, AuditLog, Violation, RiskLevel

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/nodes")
async def get_graph_nodes(db: AsyncSession = Depends(get_db)):
    """Get all nodes for the behavior graph — agents, tools, and data sources."""
    # Agent nodes
    result = await db.execute(select(Agent))
    agents = result.scalars().all()
    
    nodes = []
    tools_set = set()
    data_sources_set = set()
    
    for a in agents:
        nodes.append({
            "id": a.agent_id,
            "label": a.agent_name,
            "type": "agent",
            "department": a.department,
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            "risk_score": max(0, 100 - (a.total_violations * 10)),
            "total_actions": a.total_actions,
            "total_violations": a.total_violations,
            "total_cost": a.total_cost_usd,
            "size": max(10, min(50, a.total_actions // 10 + 10)),
        })
        for t in (a.allowed_tools or []):
            tools_set.add(t)
        for d in (a.allowed_data_sources or []):
            data_sources_set.add(d)
    
    # Tool nodes
    for t in tools_set:
        nodes.append({
            "id": f"tool:{t}",
            "label": t,
            "type": "tool",
            "size": 8,
        })
    
    # Data source nodes
    for d in data_sources_set:
        nodes.append({
            "id": f"data:{d}",
            "label": d,
            "type": "data_source",
            "size": 8,
        })
    
    return nodes


@router.get("/edges")
async def get_graph_edges(db: AsyncSession = Depends(get_db)):
    """Get edges — connections between agents, tools, and data sources."""
    result = await db.execute(select(Agent))
    agents = result.scalars().all()
    
    edges = []
    
    for a in agents:
        # Agent → Tool edges
        for t in (a.allowed_tools or []):
            edges.append({
                "source": a.agent_id,
                "target": f"tool:{t}",
                "type": "uses_tool",
                "weight": 1,
            })
        
        # Agent → Data Source edges
        for d in (a.allowed_data_sources or []):
            edges.append({
                "source": a.agent_id,
                "target": f"data:{d}",
                "type": "accesses_data",
                "weight": 1,
            })
    
    # Get violation edges (agent → tool that caused violation)
    v_result = await db.execute(select(Violation).limit(200))
    violations = v_result.scalars().all()
    
    violation_edges = {}
    for v in violations:
        key = f"{v.agent_id}->violation"
        if key not in violation_edges:
            violation_edges[key] = {
                "source": v.agent_id,
                "target": f"violation:{v.violation_id[:8]}",
                "type": "violation",
                "weight": 0,
                "violations": [],
            }
        violation_edges[key]["weight"] += 1
        violation_edges[key]["violations"].append(v.violation_type)
    
    edges.extend(violation_edges.values())
    
    return edges


@router.get("/blast-radius/{agent_id}")
async def get_blast_radius(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Calculate blast radius — what a compromised agent can reach.
    
    Shows all tools, data sources, and connected agents that would be
    affected if this agent is compromised.
    """
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    
    # Direct access
    direct_tools = set(agent.allowed_tools or [])
    direct_data = set(agent.allowed_data_sources or [])
    
    # Find co-accessing agents (share any data source or tool)
    result = await db.execute(select(Agent).where(Agent.agent_id != agent_id))
    all_agents = result.scalars().all()
    
    connected_agents = []
    shared_tools = {}
    shared_data = {}
    
    for other in all_agents:
        other_tools = set(other.allowed_tools or [])
        other_data = set(other.allowed_data_sources or [])
        
        common_tools = direct_tools & other_tools
        common_data = direct_data & other_data
        
        if common_tools or common_data:
            connected_agents.append({
                "agent_id": other.agent_id,
                "agent_name": other.agent_name,
                "department": other.department,
                "shared_tools": list(common_tools),
                "shared_data_sources": list(common_data),
                "risk": "HIGH" if common_data else "MEDIUM",
            })
            for t in common_tools:
                shared_tools[t] = shared_tools.get(t, 0) + 1
            for d in common_data:
                shared_data[d] = shared_data.get(d, 0) + 1
    
    # Get violations for this agent
    v_result = await db.execute(
        select(Violation).where(Violation.agent_id == agent_id).limit(50)
    )
    violations = v_result.scalars().all()
    
    # Risk assessment
    total_exposure = len(direct_tools) + len(direct_data) + len(connected_agents)
    risk_rating = "CRITICAL" if total_exposure > 10 else "HIGH" if total_exposure > 5 else "MEDIUM"
    
    return {
        "agent_id": agent_id,
        "agent_name": agent.agent_name,
        "department": agent.department,
        "status": agent.status.value if hasattr(agent.status, "value") else str(agent.status),
        "blast_radius": {
            "risk_rating": risk_rating,
            "direct_tools": list(direct_tools),
            "direct_data_sources": list(direct_data),
            "connected_agents": connected_agents,
            "total_connected_agents": len(connected_agents),
            "shared_tools": shared_tools,
            "shared_data_sources": shared_data,
            "total_exposure_points": total_exposure,
        },
        "violations": [
            {
                "type": v.violation_type,
                "description": v.description,
                "severity": v.severity.value if hasattr(v.severity, "value") else str(v.severity),
            }
            for v in violations[:10]
        ],
    }
