from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import Contact, User
from app.schemas.finance import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


async def _get_owned(db: AsyncSession, user: User, contact_id: int) -> Contact:
    contact = await db.get(Contact, contact_id)
    if contact is None or contact.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="شخص یافت نشد")
    return contact


@router.get("", response_model=list[ContactRead])
async def list_contacts(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Contact]:
    query = select(Contact).where(Contact.user_id == user.id)
    if search:
        query = query.where(Contact.name.ilike(f"%{search}%"))
    result = await db.execute(query.order_by(Contact.name))
    return list(result.scalars().all())


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Contact:
    contact = Contact(user_id=user.id, **payload.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=ContactRead)
async def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Contact:
    contact = await _get_owned(db, user, contact_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    contact = await _get_owned(db, user, contact_id)
    await db.delete(contact)
    await db.commit()
