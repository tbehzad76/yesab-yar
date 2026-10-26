export type AccountType = "cash" | "bank" | "wallet" | "credit";
export type CategoryKind = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type DebtDirection = "receivable" | "payable";
export type DebtStatus = "open" | "partial" | "settled";
export type PlanType = "loan" | "purchase";
export type PlanStatus = "active" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  is_active: boolean;
  note: string | null;
  balance: number | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string | null;
  icon: string | null;
  created_at: string;
}

export interface Contact {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  transfer_account_id: number | null;
  category_id: number | null;
  contact_id: number | null;
  type: TransactionType;
  amount: number;
  date: string;
  description: string | null;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface DebtPayment {
  id: number;
  debt_id: number;
  amount: number;
  date: string;
  note: string | null;
}

export interface Debt {
  id: number;
  direction: DebtDirection;
  contact_id: number | null;
  title: string | null;
  amount: number;
  currency: string;
  date: string;
  due_date: string | null;
  status: DebtStatus;
  description: string | null;
  paid_amount: number;
  remaining: number;
  payments: DebtPayment[];
  created_at: string;
}

export interface Installment {
  id: number;
  plan_id: number;
  number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_date: string | null;
  status: PaymentStatus;
  note: string | null;
}

export interface Plan {
  id: number;
  type: PlanType;
  title: string;
  counterparty: string | null;
  principal: number;
  down_payment: number;
  installments_count: number;
  start_date: string;
  first_due_date: string | null;
  interest_rate: number | null;
  currency: string;
  account_id: number | null;
  category_id: number | null;
  status: PlanStatus;
  note: string | null;
  created_at: string;
  total_amount: number;
  total_paid: number;
  total_remaining: number;
  paid_count: number;
  next_due_date: string | null;
  progress_percent: number;
  installments: Installment[];
}

export interface UpcomingInstallment {
  installment_id: number;
  plan_id: number;
  plan_title: string;
  plan_type: string;
  number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  remaining: number;
  status: string;
}

export interface DashboardSummary {
  currency: string;
  total_balance: number;
  accounts_count: number;
  month_income: number;
  month_expense: number;
  month_net: number;
  debts: {
    receivable_total: number;
    payable_total: number;
    receivable_remaining: number;
    payable_remaining: number;
  };
  active_plans_count: number;
  plans_total_remaining: number;
  upcoming_installments: UpcomingInstallment[];
}

export interface CategoryBreakdownItem {
  category_id: number | null;
  category_name: string;
  total: number;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expense: number;
}
