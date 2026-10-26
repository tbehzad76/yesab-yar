import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
        nullable=False,
    )


class AccountType(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    wallet = "wallet"
    credit = "credit"


class CategoryKind(str, enum.Enum):
    income = "income"
    expense = "expense"


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"


class DebtDirection(str, enum.Enum):
    receivable = "receivable"  # طلب: پولی که من به کسی داده‌ام
    payable = "payable"  # بدهی: پولی که من از کسی گرفته‌ام


class DebtStatus(str, enum.Enum):
    open = "open"
    partial = "partial"
    settled = "settled"


class PlanType(str, enum.Enum):
    loan = "loan"  # وام
    purchase = "purchase"  # خرید قسطی


class PlanStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    partial = "partial"
    paid = "paid"
