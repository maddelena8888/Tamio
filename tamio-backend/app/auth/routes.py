"""Authentication routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.data.models import User
from app.auth import schemas
from app.auth.utils import get_password_hash, verify_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter()


@router.post("/signup", response_model=schemas.AuthResponse)
async def signup(data: schemas.SignupRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user with email and password.
    Returns JWT token on success.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # If user exists but has no password, they signed up via Xero
        if existing_user.hashed_password is None:
            # Allow them to set a password
            existing_user.hashed_password = get_password_hash(data.password)
            await db.commit()
            await db.refresh(existing_user)

            token = create_access_token(existing_user.id, existing_user.email)
            return schemas.AuthResponse(
                access_token=token,
                user=schemas.UserAuthInfo.model_validate(existing_user)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    # Create new user with default USD currency (will be updated during onboarding)
    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        base_currency="USD",
        has_completed_onboarding=False
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.email)
    return schemas.AuthResponse(
        access_token=token,
        user=schemas.UserAuthInfo.model_validate(user)
    )


@router.post("/login", response_model=schemas.AuthResponse)
async def login(data: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user with email and password.
    Returns JWT token on success.
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token(user.id, user.email)
    return schemas.AuthResponse(
        access_token=token,
        user=schemas.UserAuthInfo.model_validate(user)
    )


@router.get("/me", response_model=schemas.UserAuthInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return schemas.UserAuthInfo.model_validate(current_user)


@router.post("/refresh", response_model=schemas.AuthResponse)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """Refresh the access token (extends session)."""
    token = create_access_token(current_user.id, current_user.email)
    return schemas.AuthResponse(
        access_token=token,
        user=schemas.UserAuthInfo.model_validate(current_user)
    )


@router.post("/complete-onboarding", response_model=schemas.UserAuthInfo)
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark user's onboarding as complete."""
    current_user.has_completed_onboarding = True
    await db.commit()
    await db.refresh(current_user)
    return schemas.UserAuthInfo.model_validate(current_user)
