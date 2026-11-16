import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_user
from ..models import AuditLog, User
from ..schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserOut
from ..security import (create_access_token, create_refresh_token, decode_token,
                        hash_password, verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# naive in-memory login rate limit: max 5 attempts per email per 60s
_attempts: dict[str, deque] = defaultdict(deque)


def _rate_limit(email: str) -> None:
    now = time.time()
    q = _attempts[email]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= 5:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many login attempts — try again in a minute")
    q.append(now)


def _tokens(user: User) -> TokenPair:
    return TokenPair(access_token=create_access_token(user.id),
                     refresh_token=create_refresh_token(user.id))


@router.post("/register", response_model=TokenPair, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(email=email, full_name=body.full_name.strip(),
                hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _tokens(user)


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    _rate_limit(email)
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    return _tokens(user)


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    user_id = decode_token(body.refresh_token, "refresh")
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
    return _tokens(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
