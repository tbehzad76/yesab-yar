from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import Category, User
from app.models.enums import CategoryKind
from app.schemas.finance import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


async def _get_owned(db: AsyncSession, user: User, category_id: int) -> Category:
    category = await db.get(Category, category_id)
    if category is None or category.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="دسته‌بندی یافت نشد")
    return category


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    kind: CategoryKind | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Category]:
    query = select(Category).where(Category.user_id == user.id)
    if kind is not None:
        query = query.where(Category.kind == kind)
    result = await db.execute(query.order_by(Category.kind, Category.name))
    return list(result.scalars().all())


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Category:
    category = Category(user_id=user.id, **payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Category:
    category = await _get_owned(db, user, category_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    category = await _get_owned(db, user, category_id)
    await db.delete(category)
    await db.commit()
