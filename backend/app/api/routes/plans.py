from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models import (
    Account,
    Category,
    Installment,
    InstallmentPlan,
    PaymentStatus,
    PlanStatus,
    PlanType,
    Transaction,
    User,
)
from app.models.enums import TransactionType
from app.schemas.plan import (
    InstallmentPay,
    InstallmentRead,
    InstallmentUpdate,
    PlanCreate,
    PlanRead,
    PlanUpdate,
)
from app.services.finance import (
    build_schedule,
    plan_totals,
    refresh_installment_status,
)

router = APIRouter(prefix="/plans", tags=["plans"])

_TYPE_LABEL = {PlanType.loan: "وام", PlanType.purchase: "خرید قسطی"}


def _serialize(plan: InstallmentPlan) -> PlanRead:
    item = PlanRead.model_validate(plan)
    for field, value in plan_totals(plan).items():
        setattr(item, field, value)
    return item


def _maybe_complete(plan: InstallmentPlan) -> None:
    if plan.status == PlanStatus.cancelled:
        return
    if plan.installments and all(
        installment.status == PaymentStatus.paid for installment in plan.installments
    ):
        plan.status = PlanStatus.completed
    elif plan.status == PlanStatus.completed:
        plan.status = PlanStatus.active


def _plan_query(plan_id: int):
    return (
        select(InstallmentPlan)
        .where(InstallmentPlan.id == plan_id)
        .options(selectinload(InstallmentPlan.installments))
    )


async def _get_owned(db: AsyncSession, user: User, plan_id: int) -> InstallmentPlan:
    plan = (await db.execute(_plan_query(plan_id))).scalar_one_or_none()
    if plan is None or plan.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="برنامهٔ اقساط یافت نشد"
        )
    return plan


async def _reload(db: AsyncSession, plan_id: int) -> InstallmentPlan:
    result = await db.execute(
        _plan_query(plan_id).execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _get_installment(
    db: AsyncSession, plan: InstallmentPlan, installment_id: int
) -> Installment:
    installment = await db.get(Installment, installment_id)
    if installment is None or installment.plan_id != plan.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="قسط یافت نشد")
    return installment


async def _validate_ref(
    db: AsyncSession, user: User, model, ref_id: int | None, label: str
) -> None:
    if ref_id is None:
        return
    obj = await db.get(model, ref_id)
    if obj is None or obj.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} نامعتبر است"
        )


@router.get("", response_model=list[PlanRead])
async def list_plans(
    type: PlanType | None = None,
    status_filter: PlanStatus | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PlanRead]:
    query = (
        select(InstallmentPlan)
        .where(InstallmentPlan.user_id == user.id)
        .options(selectinload(InstallmentPlan.installments))
    )
    if type is not None:
        query = query.where(InstallmentPlan.type == type)
    if status_filter is not None:
        query = query.where(InstallmentPlan.status == status_filter)
    result = await db.execute(query.order_by(InstallmentPlan.id.desc()))
    return [_serialize(plan) for plan in result.scalars().all()]


@router.post("", response_model=PlanRead, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlanRead:
    await _validate_ref(db, user, Account, payload.account_id, "حساب")
    await _validate_ref(db, user, Category, payload.category_id, "دسته‌بندی")

    data = payload.model_dump(exclude={"interval_months"})
    data["currency"] = data.get("currency") or settings.default_currency

    plan = InstallmentPlan(user_id=user.id, **data)
    schedule = build_schedule(
        principal=payload.principal,
        down_payment=payload.down_payment,
        count=payload.installments_count,
        start_date=payload.start_date,
        first_due_date=payload.first_due_date,
        interval_months=payload.interval_months,
    )
    plan.installments = [
        Installment(number=number, due_date=due_date, amount=amount)
        for number, due_date, amount in schedule
    ]
    db.add(plan)
    await db.commit()
    return _serialize(await _reload(db, plan.id))


@router.get("/{plan_id}", response_model=PlanRead)
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlanRead:
    return _serialize(await _get_owned(db, user, plan_id))


@router.patch("/{plan_id}", response_model=PlanRead)
async def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlanRead:
    plan = await _get_owned(db, user, plan_id)
    data = payload.model_dump(exclude_unset=True)
    if "account_id" in data:
        await _validate_ref(db, user, Account, data["account_id"], "حساب")
    if "category_id" in data:
        await _validate_ref(db, user, Category, data["category_id"], "دسته‌بندی")
    for field, value in data.items():
        setattr(plan, field, value)
    await db.commit()
    return _serialize(await _reload(db, plan.id))


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    plan = await _get_owned(db, user, plan_id)
    await db.delete(plan)
    await db.commit()


@router.get("/{plan_id}/installments", response_model=list[InstallmentRead])
async def list_installments(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Installment]:
    plan = await _get_owned(db, user, plan_id)
    return list(plan.installments)


@router.patch(
    "/{plan_id}/installments/{installment_id}", response_model=InstallmentRead
)
async def update_installment(
    plan_id: int,
    installment_id: int,
    payload: InstallmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Installment:
    plan = await _get_owned(db, user, plan_id)
    installment = await _get_installment(db, plan, installment_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(installment, field, value)
    refresh_installment_status(installment)
    await db.commit()
    await db.refresh(installment)
    return installment


@router.post(
    "/{plan_id}/installments/{installment_id}/pay",
    response_model=PlanRead,
)
async def pay_installment(
    plan_id: int,
    installment_id: int,
    payload: InstallmentPay,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlanRead:
    plan = await _get_owned(db, user, plan_id)
    installment = await _get_installment(db, plan, installment_id)

    remaining = Decimal(installment.amount) - Decimal(installment.paid_amount or 0)
    amount = payload.amount or remaining
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="قسط قبلاً به‌طور کامل پرداخت شده است",
        )
    if amount > remaining:
        amount = remaining

    paid_date = payload.date or date.today()
    installment.paid_amount = Decimal(installment.paid_amount or 0) + amount
    installment.paid_date = paid_date
    if payload.note:
        installment.note = payload.note
    refresh_installment_status(installment)

    if payload.record_transaction and plan.account_id is not None:
        label = _TYPE_LABEL.get(plan.type, "قسط")
        db.add(
            Transaction(
                user_id=user.id,
                account_id=plan.account_id,
                category_id=plan.category_id,
                type=TransactionType.expense,
                amount=amount,
                date=paid_date,
                description=f"{label} {plan.title} - قسط {installment.number}",
            )
        )

    await db.flush()
    plan = await _reload(db, plan.id)
    _maybe_complete(plan)
    await db.commit()
    return _serialize(await _reload(db, plan.id))


@router.post(
    "/{plan_id}/installments/{installment_id}/unpay",
    response_model=PlanRead,
)
async def unpay_installment(
    plan_id: int,
    installment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlanRead:
    plan = await _get_owned(db, user, plan_id)
    installment = await _get_installment(db, plan, installment_id)
    installment.paid_amount = Decimal(0)
    installment.paid_date = None
    refresh_installment_status(installment)
    await db.flush()

    plan = await _reload(db, plan.id)
    _maybe_complete(plan)
    await db.commit()
    return _serialize(await _reload(db, plan.id))
