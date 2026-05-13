"""WebSocket Connection Manager — Real-time event streaming.

Broadcasts governance events (audit logs, violations, anomalies, incidents)
to all connected WebSocket clients in real-time. Zero-refresh dashboard.
"""

import json
import logging
from datetime import datetime
from fastapi import WebSocket

logger = logging.getLogger("velyrion.ws")


class ConnectionManager:
    """Manages WebSocket connections and broadcasts events."""
    
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._event_count = 0
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected — {len(self.active_connections)} active")
        
        # Send welcome message
        await websocket.send_json({
            "type": "CONNECTED",
            "message": "VELYRION real-time stream active",
            "active_clients": len(self.active_connections),
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected — {len(self.active_connections)} active")
    
    async def broadcast(self, event_type: str, data: dict):
        """Broadcast an event to all connected clients."""
        self._event_count += 1
        message = {
            "type": event_type,
            "sequence": self._event_count,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data,
        }
        
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        # Clean up dead connections
        for conn in disconnected:
            self.disconnect(conn)
    
    async def broadcast_event(self, audit_log):
        """Broadcast a new audit log event."""
        await self.broadcast("AUDIT_EVENT", {
            "event_id": audit_log.event_id,
            "agent_id": audit_log.agent_id,
            "agent_name": audit_log.agent_name,
            "task_description": audit_log.task_description,
            "tool_used": audit_log.tool_used,
            "risk_level": audit_log.risk_level.value if hasattr(audit_log.risk_level, "value") else str(audit_log.risk_level),
            "token_cost": audit_log.token_cost,
            "compute_cost_usd": audit_log.compute_cost_usd,
            "event_hash": getattr(audit_log, "event_hash", "")[:16],
        })
    
    async def broadcast_violation(self, violation):
        """Broadcast a new violation."""
        await self.broadcast("VIOLATION", {
            "violation_id": violation.violation_id,
            "agent_id": violation.agent_id,
            "violation_type": violation.violation_type,
            "description": violation.description,
            "severity": violation.severity.value if hasattr(violation.severity, "value") else str(violation.severity),
            "action_taken": violation.action_taken,
        })
    
    async def broadcast_anomaly(self, anomaly):
        """Broadcast a new anomaly detection."""
        await self.broadcast("ANOMALY", {
            "anomaly_id": anomaly.anomaly_id,
            "agent_id": anomaly.agent_id,
            "anomaly_type": anomaly.anomaly_type,
            "description": anomaly.description,
            "risk_level": anomaly.risk_level.value if hasattr(anomaly.risk_level, "value") else str(anomaly.risk_level),
        })
    
    async def broadcast_agent_locked(self, agent_id: str, agent_name: str, reason: str):
        """Broadcast an agent lock event — highest priority."""
        await self.broadcast("AGENT_LOCKED", {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "reason": reason,
            "severity": "CRITICAL",
        })
    
    @property
    def client_count(self):
        return len(self.active_connections)


# Global singleton
ws_manager = ConnectionManager()
