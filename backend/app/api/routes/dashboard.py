from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models import (
    Account,
    Category,
    Debt,
    Installment,
    InstallmentPlan,
    PaymentStatus,
    PlanStatus,
    Transaction,
    User,
)
from app.models.enums import (
    DebtDirection,
    TransactionType,
)
from app.schemas.dashboard import (
    CategoryBreakdownItem,
    DashboardSummary,
    DebtSummary,
    MonthlyPoint,
    UpcomingInstallment,
)
from app.services.finance import account_balances

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _month_bounds(today: date) -> tuple[date, date]:
    start = today.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    upcoming_limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardSummary:
    balances = await account_balances(db, user.id)
    total_balance = sum(balances.values(), Decimal(0))

    start, end = _month_bounds(date.today())
    month_rows = (
        await db.execute(
            select(Transaction.type, func.coalesce(func.sum(Transaction.amount), 0))
            .where(
                Transaction.user_id == user.id,
                Transaction.date >= start,
                Transaction.date < end,
                Transaction.type.in_(
                    [TransactionType.income, TransactionType.expense]
                ),
            )
            .group_by(Transaction.type)
        )
    ).all()
    totals = {tx_type: Decimal(total) for tx_type, total in month_rows}
    month_income = totals.get(TransactionType.income, Decimal(0))
    month_expense = totals.get(TransactionType.expense, Decimal(0))

    debts = (await db.execute(select(Debt).where(Debt.user_id == user.id))).scalars().all()
    receivable_total = Decimal(0)
    payable_total = Decimal(0)
    receivable_remaining = Decimal(0)
    payable_remaining = Decimal(0)
    for debt in debts:
        amount = Decimal(debt.amount)
        paid = sum((Decimal(p.amount) for p in debt.payments), Decimal(0))
        if debt.direction == DebtDirection.receivable:
            receivable_total += amount
            receivable_remaining += amount - paid
        else:
            payable_total += amount
            payable_remaining += amount - paid

    plans = (
        (
            await db.execute(
                select(InstallmentPlan).where(
                    InstallmentPlan.user_id == user.id,
                    InstallmentPlan.status == PlanStatus.active,
                )
            )
        )
        .scalars()
        .all()
    )
    plans_total_remaining = Decimal(0)
    for plan in plans:
        for installment in plan.installments:
            plans_total_remaining += Decimal(installment.amount) - Decimal(
                installment.paid_amount or 0
            )

    upcoming_rows = (
        await db.execute(
            select(Installment, InstallmentPlan)
            .join(InstallmentPlan, Installment.plan_id == InstallmentPlan.id)
            .where(
                InstallmentPlan.user_id == user.id,
                Installment.status != PaymentStatus.paid,
            )
            .order_by(Installment.due_date, Installment.number)
            .limit(upcoming_limit)
        )
    ).all()
    upcoming = [
        UpcomingInstallment(
            installment_id=installment.id,
            plan_id=plan.id,
            plan_title=plan.title,
            plan_type=plan.type.value,
            number=installment.number,
            due_date=installment.due_date,
            amount=installment.amount,
            paid_amount=installment.paid_amount,
            remaining=Decimal(installment.amount) - Decimal(installment.paid_amount or 0),
            status=installment.status.value,
        )
        for installment, plan in upcoming_rows
    ]

    return DashboardSummary(
        currency=settings.default_currency,
        total_balance=total_balance,
        accounts_count=len(balances),
        month_income=month_income,
        month_expense=month_expense,
        month_net=month_income - month_expense,
        debts=DebtSummary(
            receivable_total=receivable_total,
            payable_total=payable_total,
            receivable_remaining=receivable_remaining,
            payable_remaining=payable_remaining,
        ),
        active_plans_count=len(plans),
        plans_total_remaining=plans_total_remaining,
        upcoming_installments=upcoming,
    )


@router.get("/expenses-by-category", response_model=list[CategoryBreakdownItem])
async def expenses_by_category(
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CategoryBreakdownItem]:
    if date_from is None or date_to is None:
        start, end = _month_bounds(date.today())
        date_from = date_from or start
        date_to = date_to or end

    rows = (
        await db.execute(
            select(
                Transaction.category_id,
                Category.name,
                func.coalesce(func.sum(Transaction.amount), 0),
            )
            .outerjoin(Category, Category.id == Transaction.category_id)
            .where(
                Transaction.user_id == user.id,
                Transaction.type == TransactionType.expense,
                Transaction.date >= date_from,
                Transaction.date < date_to,
            )
            .group_by(Transaction.category_id, Category.name)
            .order_by(func.coalesce(func.sum(Transaction.amount), 0).desc())
        )
    ).all()
    return [
        CategoryBreakdownItem(
            category_id=category_id,
            category_name=name or "بدون دسته",
            total=Decimal(total),
        )
        for category_id, name, total in rows
    ]


@router.get("/monthly-trend", response_model=list[MonthlyPoint])
async def monthly_trend(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MonthlyPoint]:
    month_expr = func.to_char(Transaction.date, "YYYY-MM")
    rows = (
        await db.execute(
            select(
                month_expr.label("month"),
                Transaction.type,
                func.coalesce(func.sum(Transaction.amount), 0),
            )
            .where(
                Transaction.user_id == user.id,
                Transaction.type.in_(
                    [TransactionType.income, TransactionType.expense]
                ),
            )
            .group_by(month_expr, Transaction.type)
            .order_by(month_expr)
        )
    ).all()

    buckets: dict[str, dict[str, Decimal]] = {}
    for month, tx_type, total in rows:
        bucket = buckets.setdefault(month, {"income": Decimal(0), "expense": Decimal(0)})
        bucket[tx_type.value] = Decimal(total)

    ordered = sorted(buckets.keys())[-months:]
    return [
        MonthlyPoint(
            month=month,
            income=buckets[month]["income"],
            expense=buckets[month]["expense"],
        )
        for month in ordered
    ]
