"""Authentication Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RegisterRequest(BaseModel):
    """Registration request."""

    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    avatar_url: str | None = None
    avatar_type: str | None = None


class LoginRequest(BaseModel):
    """Login request."""

    username: str
    password: str


class UpdateProfileRequest(BaseModel):
    """Profile update request."""

    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    avatar_type: str | None = None


class UserResponse(BaseModel):
    """User response (without sensitive fields)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str
    email: str
    role: str
    avatar_url: str | None = None
    avatar_type: str | None = None


class AuthResponse(BaseModel):
    """Authentication response with token and user."""

    token: str
    user: UserResponse
