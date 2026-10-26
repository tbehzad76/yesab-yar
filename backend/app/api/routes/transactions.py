from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import Account, Category, Contact, Transaction, User
from app.models.enums import TransactionType
from app.schemas.common import Page
from app.schemas.finance import TransactionCreate, TransactionRead, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])

_REF_MODELS = {
    "account_id": (Account, "حساب"),
    "transfer_account_id": (Account, "حساب مقصد"),
    "category_id": (Category, "دسته‌بندی"),
    "contact_id": (Contact, "شخص"),
}


async def _validate_refs(db: AsyncSession, user: User, values: dict) -> None:
    for field, (model, label) in _REF_MODELS.items():
        ref_id = values.get(field)
        if ref_id is None:
            continue
        obj = await db.get(model, ref_id)
        if obj is None or obj.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} نامعتبر است"
            )


async def _get_owned(db: AsyncSession, user: User, tx_id: int) -> Transaction:
    tx = await db.get(Transaction, tx_id)
    if tx is None or tx.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="تراکنش یافت نشد")
    return tx


@router.get("", response_model=Page[TransactionRead])
async def list_transactions(
    account_id: int | None = None,
    category_id: int | None = None,
    contact_id: int | None = None,
    type: TransactionType | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Page[TransactionRead]:
    filters = [Transaction.user_id == user.id]
    if account_id is not None:
        filters.append(Transaction.account_id == account_id)
    if category_id is not None:
        filters.append(Transaction.category_id == category_id)
    if contact_id is not None:
        filters.append(Transaction.contact_id == contact_id)
    if type is not None:
        filters.append(Transaction.type == type)
    if date_from is not None:
        filters.append(Transaction.date >= date_from)
    if date_to is not None:
        filters.append(Transaction.date <= date_to)
    if search:
        filters.append(Transaction.description.ilike(f"%{search}%"))

    total = await db.scalar(
        select(func.count()).select_from(Transaction).where(*filters)
    )
    rows = await db.execute(
        select(Transaction)
        .where(*filters)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = [TransactionRead.model_validate(row) for row in rows.scalars().all()]
    return Page(items=items, total=total or 0, page=page, size=size)


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Transaction:
    await _validate_refs(db, user, payload.model_dump())
    tx = Transaction(user_id=user.id, **payload.model_dump())
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.get("/{tx_id}", response_model=TransactionRead)
async def get_transaction(
    tx_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Transaction:
    return await _get_owned(db, user, tx_id)


@router.patch("/{tx_id}", response_model=TransactionRead)
async def update_transaction(
    tx_id: int,
    payload: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Transaction:
    tx = await _get_owned(db, user, tx_id)
    data = payload.model_dump(exclude_unset=True)
    await _validate_refs(db, user, data)
    for field, value in data.items():
        setattr(tx, field, value)

    if tx.type == TransactionType.transfer:
        if tx.transfer_account_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="برای انتقال، حساب مقصد الزامی است",
            )
        if tx.transfer_account_id == tx.account_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="حساب مبدأ و مقصد نباید یکی باشند",
            )
    else:
        tx.transfer_account_id = None

    await db.commit()
    await db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    tx_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    tx = await _get_owned(db, user, tx_id)
    await db.delete(tx)
    await db.commit()
