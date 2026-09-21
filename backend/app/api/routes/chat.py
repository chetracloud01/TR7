from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import llm_call_limiter
from app.db.models.llm import ChatMessage, ChatSession
from app.db.models.user import User
from app.db.session import get_db
from app.llm.gateway import stream_chat_response
from app.schemas.chat import ChatMessageOut, ChatSessionCreate, ChatSessionOut, SendMessageRequest

router = APIRouter()


def _get_owned_session(session_id: int, user: User, db: Session) -> ChatSession:
    session = db.get(ChatSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


@router.get("/chat/sessions", response_model=list[ChatSessionOut])
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ChatSession]:
    return list(db.scalars(select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.id.desc())))


@router.post("/chat/sessions", response_model=ChatSessionOut)
def create_session(
    payload: ChatSessionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ChatSession:
    session = ChatSession(user_id=user.id, title=payload.title or "New chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/chat/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
def get_messages(
    session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ChatMessage]:
    session = _get_owned_session(session_id, user, db)
    return session.messages


@router.post("/chat/sessions/{session_id}/messages", dependencies=[Depends(llm_call_limiter.dependency())])
def send_message(
    session_id: int,
    payload: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _get_owned_session(session_id, user, db)

    db.add(ChatMessage(session_id=session_id, role="user", content=payload.content))
    db.commit()

    return StreamingResponse(
        stream_chat_response(user.id, session_id, payload.task_type),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
