"""
TALA API — Hermes Agent as BAIA backend.
This server imports and runs the REAL Hermes agent code.
"""

import sys
from pathlib import Path

# Make Hermes modules importable
HERMES_DIR = Path(__file__).parent
sys.path.insert(0, str(HERMES_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tala")

app = FastAPI(title="TALA — Hermes for BAIA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ChatResponse(BaseModel):
    reply: str
    session_id: str


# Lazy-load the real Hermes agent
_agent = None

def get_agent():
    global _agent
    if _agent is None:
        from run_agent import AIAgent
        _agent = AIAgent()
    return _agent


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "hermes"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Send message to the REAL Hermes agent."""
    try:
        agent = get_agent()
        from agent.conversation_loop import run_conversation
        result = await run_conversation(agent, req.message, session_id=req.session_id)
        return ChatResponse(reply=result, session_id=req.session_id)
    except Exception as e:
        logger.exception("Agent error")
        raise HTTPException(500, str(e))


@app.get("/api/skills")
async def list_skills():
    """List installed Hermes skills."""
    skills = []
    skills_dir = HERMES_DIR / "skills"
    if skills_dir.exists():
        for cat in skills_dir.iterdir():
            if cat.is_dir():
                for skill in cat.iterdir():
                    if (skill / "SKILL.md").exists():
                        skills.append({"name": skill.name, "category": cat.name})
    return {"skills": skills}


@app.get("/api/status")
async def status():
    return {"status": "running", "agent": "hermes"}


# ── Workforce endpoints ──────────────────────────────────────

@app.get("/api/workforce/agents")
async def workforce_agents():
    """List available workforce agents."""
    return {
        "agents": [
            {"id": "cmd", "role": "command-center", "name": "Command Center", "status": "idle"},
            {"id": "fin", "role": "financial-agent", "name": "Financial Agent", "status": "idle"},
            {"id": "lead", "role": "lead-agent", "name": "Lead Agent", "status": "idle"},
            {"id": "email", "role": "email-agent", "name": "Email Agent", "status": "idle"},
            {"id": "dev", "role": "developer-agent", "name": "Developer Agent", "status": "idle"},
            {"id": "ops", "role": "operations-agent", "name": "Operations Agent", "status": "idle"},
        ]
    }


@app.get("/api/workforce/jobs")
async def workforce_jobs():
    """Get active jobs."""
    return {"jobs": []}


@app.get("/api/workforce/scheduled")
async def workforce_scheduled():
    """Get scheduled jobs."""
    return {"scheduled": []}


@app.get("/api/workforce/approvals")
async def workforce_approvals():
    """Get pending approvals."""
    return {"approvals": []}


@app.get("/api/workforce/logs")
async def workforce_logs():
    """Get agent logs."""
    return {"logs": []}


@app.post("/api/workforce/command")
async def workforce_command(req: ChatRequest):
    """Send command to workforce agent."""
    try:
        agent = get_agent()
        from agent.conversation_loop import run_conversation
        result = await run_conversation(agent, req.message, session_id=req.session_id)
        return {"reply": result, "session_id": req.session_id}
    except Exception as e:
        logger.exception("Workforce command error")
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
