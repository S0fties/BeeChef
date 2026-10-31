from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower()

    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # concurrent request won the race on the unique index
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))

    # Always run a bcrypt check so response time doesn't reveal whether the email exists
    password_ok = verify_password(
        payload.password, user.hashed_password if user else DUMMY_HASH
    )
    if not user or not password_ok:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user