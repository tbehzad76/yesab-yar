from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models import Account, Transaction, User
from app.schemas.finance import AccountCreate, AccountRead, AccountUpdate
from app.services.finance import account_balances

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _get_owned(db: AsyncSession, user: User, account_id: int) -> Account:
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="حساب یافت نشد")
    return account


@router.get("", response_model=list[AccountRead])
async def list_accounts(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
) -> list[AccountRead]:
    result = await db.execute(
        select(Account).where(Account.user_id == user.id).order_by(Account.id)
    )
    accounts = result.scalars().all()
    balances = await account_balances(db, user.id)
    out: list[AccountRead] = []
    for account in accounts:
        item = AccountRead.model_validate(account)
        item.balance = balances.get(account.id, 0)
        out.append(item)
    return out


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountRead:
    account = Account(
        user_id=user.id,
        name=payload.name,
        type=payload.type,
        currency=payload.currency or settings.default_currency,
        initial_balance=payload.initial_balance,
        is_active=payload.is_active,
        note=payload.note,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    item = AccountRead.model_validate(account)
    item.balance = account.initial_balance
    return item


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountRead:
    account = await _get_owned(db, user, account_id)
    balances = await account_balances(db, user.id)
    item = AccountRead.model_validate(account)
    item.balance = balances.get(account.id, 0)
    return item


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountRead:
    account = await _get_owned(db, user, account_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    balances = await account_balances(db, user.id)
    item = AccountRead.model_validate(account)
    item.balance = balances.get(account.id, 0)
    return item


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    account = await _get_owned(db, user, account_id)
    count = await db.scalar(
        select(func.count())
        .select_from(Transaction)
        .where(
            (Transaction.account_id == account_id)
            | (Transaction.transfer_account_id == account_id)
        )
    )
    if count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="این حساب تراکنش دارد؛ به‌جای حذف، آن را غیرفعال کنید",
        )
    await db.delete(account)
    await db.commit()
