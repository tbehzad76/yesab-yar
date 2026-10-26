from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import AccountType, CategoryKind, TransactionType
from app.schemas.common import Money, ORMModel


# ---------------------------------------------------------------- Account
class AccountBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: AccountType = AccountType.bank
    currency: str | None = Field(default=None, max_length=8)
    initial_balance: Money = Money(0)
    is_active: bool = True
    note: str | None = Field(default=None, max_length=255)


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: AccountType | None = None
    currency: str | None = Field(default=None, max_length=8)
    initial_balance: Money | None = None
    is_active: bool | None = None
    note: str | None = Field(default=None, max_length=255)


class AccountRead(ORMModel):
    id: int
    name: str
    type: AccountType
    currency: str
    initial_balance: Money
    is_active: bool
    note: str | None = None
    balance: Money | None = None
    created_at: datetime


# ---------------------------------------------------------------- Category
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: CategoryKind
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=40)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: CategoryKind | None = None
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=40)


class CategoryRead(ORMModel):
    id: int
    name: str
    kind: CategoryKind
    color: str | None = None
    icon: str | None = None
    created_at: datetime


# ---------------------------------------------------------------- Contact
class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    note: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    note: str | None = None


class ContactRead(ORMModel):
    id: int
    name: str
    phone: str | None = None
    email: str | None = None
    note: str | None = None
    created_at: datetime


# ---------------------------------------------------------------- Transaction
class TransactionBase(BaseModel):
    account_id: int
    type: TransactionType
    amount: Money = Field(gt=0)
    date: date_type
    category_id: int | None = None
    contact_id: int | None = None
    transfer_account_id: int | None = None
    description: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_transfer(self):
        if self.type == TransactionType.transfer:
            if self.transfer_account_id is None:
                raise ValueError("برای انتقال، حساب مقصد الزامی است")
            if self.transfer_account_id == self.account_id:
                raise ValueError("حساب مبدأ و مقصد نباید یکی باشند")
        else:
            self.transfer_account_id = None
        return self


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    account_id: int | None = None
    type: TransactionType | None = None
    amount: Money | None = Field(default=None, gt=0)
    date: date_type | None = None
    category_id: int | None = None
    contact_id: int | None = None
    transfer_account_id: int | None = None
    description: str | None = Field(default=None, max_length=500)


class TransactionRead(ORMModel):
    id: int
    account_id: int
    transfer_account_id: int | None = None
    category_id: int | None = None
    contact_id: int | None = None
    type: TransactionType
    amount: Money
    date: date_type
    description: str | None = None
    created_at: datetime
