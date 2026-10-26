from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models import Contact, Debt, DebtPayment, DebtStatus, User
from app.models.enums import DebtDirection
from app.schemas.debt import (
    DebtCreate,
    DebtPaymentCreate,
    DebtRead,
    DebtUpdate,
)

router = APIRouter(prefix="/debts", tags=["debts"])


def _paid_amount(debt: Debt) -> Decimal:
    return sum((Decimal(payment.amount) for payment in debt.payments), Decimal(0))


def _sync_status(debt: Debt) -> None:
    paid = _paid_amount(debt)
    amount = Decimal(debt.amount)
    if paid <= 0:
        debt.status = DebtStatus.open
    elif paid < amount:
        debt.status = DebtStatus.partial
    else:
        debt.status = DebtStatus.settled


def _serialize(debt: Debt) -> DebtRead:
    paid = _paid_amount(debt)
    item = DebtRead.model_validate(debt)
    item.paid_amount = paid
    item.remaining = Decimal(debt.amount) - paid
    return item


def _debt_query(debt_id: int):
    return (
        select(Debt)
        .where(Debt.id == debt_id)
        .options(selectinload(Debt.payments))
    )


async def _get_owned(db: AsyncSession, user: User, debt_id: int) -> Debt:
    debt = (await db.execute(_debt_query(debt_id))).scalar_one_or_none()
    if debt is None or debt.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="قرض یافت نشد")
    return debt


async def _reload(db: AsyncSession, debt_id: int) -> Debt:
    result = await db.execute(
        _debt_query(debt_id).execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _validate_contact(db: AsyncSession, user: User, contact_id: int | None) -> None:
    if contact_id is None:
        return
    contact = await db.get(Contact, contact_id)
    if contact is None or contact.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="شخص نامعتبر است")


@router.get("", response_model=list[DebtRead])
async def list_debts(
    direction: DebtDirection | None = None,
    status_filter: DebtStatus | None = None,
    contact_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DebtRead]:
    query = (
        select(Debt)
        .where(Debt.user_id == user.id)
        .options(selectinload(Debt.payments))
    )
    if direction is not None:
        query = query.where(Debt.direction == direction)
    if status_filter is not None:
        query = query.where(Debt.status == status_filter)
    if contact_id is not None:
        query = query.where(Debt.contact_id == contact_id)
    result = await db.execute(query.order_by(Debt.date.desc(), Debt.id.desc()))
    return [_serialize(debt) for debt in result.scalars().all()]


@router.post("", response_model=DebtRead, status_code=status.HTTP_201_CREATED)
async def create_debt(
    payload: DebtCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DebtRead:
    await _validate_contact(db, user, payload.contact_id)
    data = payload.model_dump()
    data["currency"] = data.get("currency") or settings.default_currency
    debt = Debt(user_id=user.id, **data)
    db.add(debt)
    await db.commit()
    return _serialize(await _reload(db, debt.id))


@router.get("/{debt_id}", response_model=DebtRead)
async def get_debt(
    debt_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DebtRead:
    return _serialize(await _get_owned(db, user, debt_id))


@router.patch("/{debt_id}", response_model=DebtRead)
async def update_debt(
    debt_id: int,
    payload: DebtUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DebtRead:
    debt = await _get_owned(db, user, debt_id)
    data = payload.model_dump(exclude_unset=True)
    if "contact_id" in data:
        await _validate_contact(db, user, data["contact_id"])
    for field, value in data.items():
        setattr(debt, field, value)
    _sync_status(debt)
    await db.commit()
    return _serialize(await _reload(db, debt.id))


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debt(
    debt_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    debt = await _get_owned(db, user, debt_id)
    await db.delete(debt)
    await db.commit()


@router.post(
    "/{debt_id}/payments",
    response_model=DebtRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_payment(
    debt_id: int,
    payload: DebtPaymentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DebtRead:
    debt = await _get_owned(db, user, debt_id)
    db.add(DebtPayment(debt_id=debt.id, **payload.model_dump()))
    await db.flush()

    debt = await _reload(db, debt.id)
    _sync_status(debt)
    await db.commit()
    return _serialize(await _reload(db, debt.id))


@router.delete(
    "/{debt_id}/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_payment(
    debt_id: int,
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    debt = await _get_owned(db, user, debt_id)
    payment = await db.get(DebtPayment, payment_id)
    if payment is None or payment.debt_id != debt.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="پرداخت یافت نشد")
    await db.delete(payment)
    await db.flush()

    debt = await _reload(db, debt.id)
    _sync_status(debt)
    await db.commit()
