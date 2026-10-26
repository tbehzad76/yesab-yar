import { formatJalali, todayISO as isoToday } from "./jalali";

export const CURRENCY_LABEL: Record<string, string> = {
  IRT: "تومان",
  IRR: "ریال",
  USD: "$",
  EUR: "€",
};

export function formatMoney(
  value: number | null | undefined,
  currency = "IRT",
): string {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  const label = CURRENCY_LABEL[currency] ?? currency;
  return `${formatted} ${label}`;
}

export function formatDate(value: string | null | undefined): string {
  return formatJalali(value);
}

export function todayISO(): string {
  return isoToday();
}

export const ACCOUNT_TYPES: Record<string, string> = {
  cash: "نقدی",
  bank: "بانکی",
  wallet: "کیف پول",
  credit: "اعتباری",
};

export const TRANSACTION_TYPES: Record<string, string> = {
  income: "درآمد",
  expense: "هزینه",
  transfer: "انتقال",
};

export const DEBT_DIRECTIONS: Record<string, string> = {
  receivable: "طلب (دادم)",
  payable: "بدهی (گرفتم)",
};

export const DEBT_STATUSES: Record<string, string> = {
  open: "باز",
  partial: "پرداخت جزئی",
  settled: "تسویه شده",
};

export const PLAN_TYPES: Record<string, string> = {
  loan: "وام",
  purchase: "خرید قسطی",
};

export const PLAN_STATUSES: Record<string, string> = {
  active: "فعال",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
};

export const PAYMENT_STATUSES: Record<string, string> = {
  unpaid: "پرداخت‌نشده",
  partial: "جزئی",
  paid: "پرداخت‌شده",
};
