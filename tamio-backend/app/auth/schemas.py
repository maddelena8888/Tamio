"""Authentication schemas."""
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    """Schema for user signup."""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")


class LoginRequest(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserAuthInfo(BaseModel):
    """User info returned after auth."""
    id: str
    email: str
    base_currency: str
    has_completed_onboarding: bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Schema for authentication response."""
    access_token: str
    token_type: str = "bearer"
    user: UserAuthInfo
