import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.security import decode_access_token
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_prefix}/auth/token", auto_error=True
)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="اعتبارنامه نامعتبر یا منقضی شده است",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise _unauthorized()
        user_id = int(subject)
    except (jwt.PyJWTError, ValueError):
        raise _unauthorized()

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    return user
