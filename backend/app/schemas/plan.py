from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import PaymentStatus, PlanStatus, PlanType
from app.schemas.common import Money, ORMModel


class InstallmentRead(ORMModel):
    id: int
    plan_id: int
    number: int
    due_date: date_type
    amount: Money
    paid_amount: Money
    paid_date: date_type | None = None
    status: PaymentStatus
    note: str | None = None


class InstallmentUpdate(BaseModel):
    due_date: date_type | None = None
    amount: Money | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=500)


class InstallmentPay(BaseModel):
    amount: Money | None = Field(default=None, gt=0)
    date: date_type | None = None
    note: str | None = Field(default=None, max_length=500)
    record_transaction: bool = True


class PlanBase(BaseModel):
    type: PlanType
    title: str = Field(min_length=1, max_length=200)
    counterparty: str | None = Field(default=None, max_length=200)
    principal: Money = Field(gt=0)
    down_payment: Money = Money(0)
    installments_count: int = Field(ge=1, le=600)
    start_date: date_type
    first_due_date: date_type | None = None
    interest_rate: Money | None = None
    currency: str | None = Field(default=None, max_length=8)
    account_id: int | None = None
    category_id: int | None = None
    note: str | None = None


class PlanCreate(PlanBase):
    interval_months: int = Field(default=1, ge=1, le=12)


class PlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    counterparty: str | None = Field(default=None, max_length=200)
    status: PlanStatus | None = None
    account_id: int | None = None
    category_id: int | None = None
    note: str | None = None


class PlanRead(ORMModel):
    id: int
    type: PlanType
    title: str
    counterparty: str | None = None
    principal: Money
    down_payment: Money
    installments_count: int
    start_date: date_type
    first_due_date: date_type | None = None
    interest_rate: Money | None = None
    currency: str
    account_id: int | None = None
    category_id: int | None = None
    status: PlanStatus
    note: str | None = None
    created_at: datetime
    total_amount: Money = Money(0)
    total_paid: Money = Money(0)
    total_remaining: Money = Money(0)
    paid_count: int = 0
    next_due_date: date_type | None = None
    progress_percent: float = 0.0
    installments: list[InstallmentRead] = []
