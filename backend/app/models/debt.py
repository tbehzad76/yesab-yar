from datetime import date as date_type
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.db import Base
from app.models.enums import DebtDirection, DebtStatus, TimestampMixin


class Debt(Base, TimestampMixin):
    """قرض: پولی که من به کسی داده‌ام (receivable) یا از کسی گرفته‌ام (payable)."""

    __tablename__ = "debts"
    __table_args__ = (Index("ix_debts_user_direction", "user_id", "direction"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    contact_id: Mapped[int | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), index=True
    )
    direction: Mapped[DebtDirection] = mapped_column(
        Enum(DebtDirection, name="debt_direction"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(200))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(8), default=settings.default_currency, nullable=False
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    due_date: Mapped[date_type | None] = mapped_column(Date)
    status: Mapped[DebtStatus] = mapped_column(
        Enum(DebtStatus, name="debt_status"), default=DebtStatus.open, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text)

    payments: Mapped[list["DebtPayment"]] = relationship(
        back_populates="debt",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class DebtPayment(Base, TimestampMixin):
    __tablename__ = "debt_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    debt_id: Mapped[int] = mapped_column(
        ForeignKey("debts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))

    debt: Mapped[Debt] = relationship(back_populates="payments")
