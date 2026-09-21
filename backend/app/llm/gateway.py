"""Orchestrates one chat turn: stream tokens to the client over SSE,
then persist the assistant message and a usage-log row once it's done.

Opens its own DB session rather than reusing the route's request-scoped
one — a StreamingResponse's generator body keeps running after the route
handler returns, by which point FastAPI has already closed a
`Depends(get_db)` session, so writing through it here would fail or
silently no-op partway through a stream."""

import json
from collections.abc import AsyncIterator

from app.db.models.llm import ChatMessage, ChatSession, LLMUsageLog
from app.db.session import SessionLocal
from app.llm.router import stream_with_fallback


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def stream_chat_response(user_id: int, session_id: int, task_type: str) -> AsyncIterator[str]:
    db = SessionLocal()
    try:
        session = db.get(ChatSession, session_id)
        if session is None:
            yield _sse({"type": "error", "message": "Session not found."})
            return

        history = [{"role": m.role, "content": m.content} for m in session.messages]

        async for event in stream_with_fallback(db, user_id, task_type, history):
            if event["type"] == "token":
                yield _sse({"type": "token", "text": event["text"]})
            elif event["type"] == "done":
                db.add(
                    ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=event["full_text"],
                        model_used=f"{event['provider']}:{event['model']}",
                    )
                )
                db.add(LLMUsageLog(user_id=user_id, provider=event["provider"], model=event["model"], task_type=task_type))
                db.commit()
                yield _sse({"type": "done", "provider": event["provider"], "model": event["model"]})
            elif event["type"] == "error":
                yield _sse({"type": "error", "message": event["message"]})
    finally:
        db.close()
