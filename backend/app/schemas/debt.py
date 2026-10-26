from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import DebtDirection, DebtStatus
from app.schemas.common import Money, ORMModel


class DebtPaymentCreate(BaseModel):
    amount: Money = Field(gt=0)
    date: date_type
    note: str | None = Field(default=None, max_length=500)


class DebtPaymentRead(ORMModel):
    id: int
    debt_id: int
    amount: Money
    date: date_type
    note: str | None = None


class DebtCreate(BaseModel):
    direction: DebtDirection
    contact_id: int | None = None
    title: str | None = Field(default=None, max_length=200)
    amount: Money = Field(gt=0)
    currency: str | None = Field(default=None, max_length=8)
    date: date_type
    due_date: date_type | None = None
    description: str | None = None


class DebtUpdate(BaseModel):
    direction: DebtDirection | None = None
    contact_id: int | None = None
    title: str | None = Field(default=None, max_length=200)
    amount: Money | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, max_length=8)
    date: date_type | None = None
    due_date: date_type | None = None
    description: str | None = None


class DebtRead(ORMModel):
    id: int
    direction: DebtDirection
    contact_id: int | None = None
    title: str | None = None
    amount: Money
    currency: str
    date: date_type
    due_date: date_type | None = None
    status: DebtStatus
    description: str | None = None
    paid_amount: Money = Money(0)
    remaining: Money = Money(0)
    payments: list[DebtPaymentRead] = []
    created_at: datetime
