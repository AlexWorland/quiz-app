"""Authentication routes."""

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User, UserRole
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Register a new user."""
    # Check if username already exists
    result = await db.execute(select(User).where(User.username == request.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    # Create user
    user = User(
        id=uuid4(),
        username=request.username,
        display_name=request.username,  # Default display name
        email=f"{request.username}@quiz.local",  # Placeholder email
        password_hash=hash_password(request.password),
        role=UserRole.PARTICIPANT.value,
        avatar_url=request.avatar_url,
        avatar_type=request.avatar_type,
    )
    db.add(user)
    await db.flush()

    # Create token
    token = create_access_token(user.id, user.role)

    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Login with username and password."""
    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(user.id, user.role)

    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: CurrentUser) -> UserResponse:
    """Get the current authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Update the current user's profile."""
    if request.username is not None:
        # Check if username is taken by another user
        result = await db.execute(
            select(User).where(
                User.username == request.username, User.id != current_user.id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )
        current_user.username = request.username

    if request.display_name is not None:
        current_user.display_name = request.display_name

    if request.avatar_url is not None:
        current_user.avatar_url = request.avatar_url

    if request.avatar_type is not None:
        current_user.avatar_type = request.avatar_type

    await db.flush()

    return UserResponse.model_validate(current_user)
