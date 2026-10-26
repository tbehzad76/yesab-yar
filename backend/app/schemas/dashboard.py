from datetime import date

from pydantic import BaseModel

from app.schemas.common import Money


class UpcomingInstallment(BaseModel):
    installment_id: int
    plan_id: int
    plan_title: str
    plan_type: str
    number: int
    due_date: date
    amount: Money
    paid_amount: Money
    remaining: Money
    status: str


class DebtSummary(BaseModel):
    receivable_total: Money
    payable_total: Money
    receivable_remaining: Money
    payable_remaining: Money


class DashboardSummary(BaseModel):
    currency: str
    total_balance: Money
    accounts_count: int
    month_income: Money
    month_expense: Money
    month_net: Money
    debts: DebtSummary
    active_plans_count: int
    plans_total_remaining: Money
    upcoming_installments: list[UpcomingInstallment]


class CategoryBreakdownItem(BaseModel):
    category_id: int | None
    category_name: str
    total: Money


class MonthlyPoint(BaseModel):
    month: str
    income: Money
    expense: Money
