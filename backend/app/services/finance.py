import calendar
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, Installment, InstallmentPlan, PaymentStatus, Transaction
from app.models.enums import TransactionType

CENT = Decimal("0.01")


def add_months(source: date, months: int) -> date:
    month_index = source.month - 1 + months
    year = source.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def build_schedule(
    *,
    principal: Decimal,
    down_payment: Decimal,
    count: int,
    start_date: date,
    first_due_date: date | None,
    interval_months: int = 1,
) -> list[tuple[int, date, Decimal]]:
    """تولید جدول اقساط. مبلغ هر قسط تقسیم مساوی است و اختلاف گردکردن به قسط آخر اضافه می‌شود."""
    financed = (principal - down_payment).quantize(CENT)
    if financed <= 0:
        financed = Decimal("0")
    base = (financed / count).quantize(CENT, rounding=ROUND_HALF_UP)
    amounts = [base] * (count - 1)
    amounts.append((financed - base * (count - 1)).quantize(CENT))

    first = first_due_date or add_months(start_date, 1)
    return [
        (index + 1, add_months(first, index * interval_months), amounts[index])
        for index in range(count)
    ]


async def account_balances(db: AsyncSession, user_id: int) -> dict[int, Decimal]:
    """موجودی هر حساب = موجودی اولیه + درآمد - هزینه + انتقال‌های ورودی - انتقال‌های خروجی."""
    accounts = (
        (
            await db.execute(
                select(Account).where(Account.user_id == user_id)
            )
        )
        .scalars()
        .all()
    )
    balances = {account.id: Decimal(account.initial_balance) for account in accounts}

    rows = (
        await db.execute(
            select(
                Transaction.account_id,
                Transaction.transfer_account_id,
                Transaction.type,
                func.coalesce(func.sum(Transaction.amount), 0),
            )
            .where(Transaction.user_id == user_id)
            .group_by(
                Transaction.account_id, Transaction.transfer_account_id, Transaction.type
            )
        )
    ).all()

    for account_id, transfer_account_id, tx_type, total in rows:
        total = Decimal(total)
        if tx_type == TransactionType.income:
            balances[account_id] = balances.get(account_id, Decimal(0)) + total
        elif tx_type == TransactionType.expense:
            balances[account_id] = balances.get(account_id, Decimal(0)) - total
        elif tx_type == TransactionType.transfer:
            balances[account_id] = balances.get(account_id, Decimal(0)) - total
            if transfer_account_id is not None:
                balances[transfer_account_id] = (
                    balances.get(transfer_account_id, Decimal(0)) + total
                )
    return balances


def plan_totals(plan: InstallmentPlan) -> dict:
    installments = list(plan.installments or [])
    total_amount = sum((Decimal(i.amount) for i in installments), Decimal(0))
    total_paid = sum((Decimal(i.paid_amount) for i in installments), Decimal(0))
    remaining = total_amount - total_paid
    paid_count = sum(1 for i in installments if i.status == PaymentStatus.paid)
    upcoming = [i.due_date for i in installments if i.status != PaymentStatus.paid]
    progress = float(total_paid / total_amount * 100) if total_amount > 0 else 0.0
    return {
        "total_amount": total_amount,
        "total_paid": total_paid,
        "total_remaining": remaining,
        "paid_count": paid_count,
        "next_due_date": min(upcoming) if upcoming else None,
        "progress_percent": round(progress, 2),
    }


def refresh_installment_status(installment: Installment) -> None:
    amount = Decimal(installment.amount)
    paid = Decimal(installment.paid_amount or 0)
    if paid <= 0:
        installment.status = PaymentStatus.unpaid
    elif paid < amount:
        installment.status = PaymentStatus.partial
    else:
        installment.status = PaymentStatus.paid
