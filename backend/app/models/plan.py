from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.db import Base
from app.models.enums import PaymentStatus, PlanStatus, PlanType, TimestampMixin


class InstallmentPlan(Base, TimestampMixin):
    """یک برنامهٔ پرداخت قسطی؛ هم برای «وام» و هم برای «خرید قسطی»."""

    __tablename__ = "installment_plans"
    __table_args__ = (Index("ix_plans_user_type", "user_id", "type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[PlanType] = mapped_column(
        Enum(PlanType, name="plan_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    counterparty: Mapped[str | None] = mapped_column(String(200))  # بانک / فروشنده
    principal: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    down_payment: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), default=Decimal("0"), nullable=False
    )
    installments_count: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    first_due_date: Mapped[date | None] = mapped_column(Date)
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    currency: Mapped[str] = mapped_column(
        String(8), default=settings.default_currency, nullable=False
    )
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL")
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )
    status: Mapped[PlanStatus] = mapped_column(
        Enum(PlanStatus, name="plan_status"), default=PlanStatus.active, nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)

    installments: Mapped[list["Installment"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Installment.number",
    )


class Installment(Base, TimestampMixin):
    __tablename__ = "installments"
    __table_args__ = (Index("ix_installments_plan_number", "plan_id", "number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("installment_plans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), default=Decimal("0"), nullable=False
    )
    paid_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"),
        default=PaymentStatus.unpaid,
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(String(500))

    plan: Mapped[InstallmentPlan] = relationship(back_populates="installments")
