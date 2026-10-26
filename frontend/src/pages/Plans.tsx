import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api";
import { DateInput } from "../components/DateInput";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from "../components/ui";
import { errorMessage, useApi } from "../hooks";
import {
  formatDate,
  formatMoney,
  PLAN_STATUSES,
  PLAN_TYPES,
  todayISO,
} from "../lib/format";
import type { Account, Category, Plan, PlanType } from "../types";

interface PlanForm {
  title: string;
  counterparty: string;
  principal: string;
  down_payment: string;
  installments_count: string;
  start_date: string;
  first_due_date: string;
  interval_months: string;
  interest_rate: string;
  account_id: string;
  category_id: string;
  note: string;
}

const EMPTY: PlanForm = {
  title: "",
  counterparty: "",
  principal: "",
  down_payment: "0",
  installments_count: "12",
  start_date: todayISO(),
  first_due_date: "",
  interval_months: "1",
  interest_rate: "",
  account_id: "",
  category_id: "",
  note: "",
};

export function Plans() {
  const [type, setType] = useState<PlanType>("loan");
  const navigate = useNavigate();
  const accounts = useApi<Account[]>("/accounts");
  const categories = useApi<Category[]>("/categories");
  const list = useApi<Plan[]>(`/plans?type=${type}`);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanForm>({ ...EMPTY });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLoan = type === "loan";

  function openCreate() {
    setForm({ ...EMPTY });
    setFormError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const plan = await api.post<Plan>("/plans", {
        type,
        title: form.title.trim(),
        counterparty: form.counterparty.trim() || null,
        principal: Number(form.principal),
        down_payment: Number(form.down_payment) || 0,
        installments_count: Number(form.installments_count),
        start_date: form.start_date,
        first_due_date: form.first_due_date || null,
        interval_months: Number(form.interval_months) || 1,
        interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
        account_id: form.account_id ? Number(form.account_id) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        note: form.note.trim() || null,
      });
      setOpen(false);
      navigate(`/plans/${plan.id}`);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(plan: Plan) {
    if (!window.confirm(`«${plan.title}» و همهٔ اقساطش حذف شود؟`)) return;
    try {
      await api.delete(`/plans/${plan.id}`);
      await list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  const categoryOptions = (categories.data ?? []).filter(
    (category) => category.kind === "expense",
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>وام و خرید قسطی</h1>
          <p className="sub">برنامه‌های پرداخت قسطی و پیگیری اقساط</p>
        </div>
        <div className="head-actions">
          <Button onClick={openCreate}>
            + {isLoan ? "وام جدید" : "خرید قسطی جدید"}
          </Button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab${isLoan ? " active" : ""}`}
          onClick={() => setType("loan")}
        >
          وام‌ها
        </button>
        <button
          className={`tab${!isLoan ? " active" : ""}`}
          onClick={() => setType("purchase")}
        >
          خریدهای قسطی
        </button>
      </div>

      {list.loading && <Spinner />}
      {list.error && <ErrorText>{list.error}</ErrorText>}

      {list.data && list.data.length === 0 && (
        <Card>
          <EmptyState
            text={
              isLoan
                ? "وامی ثبت نشده است."
                : "خرید قسطی‌ای ثبت نشده است."
            }
          />
        </Card>
      )}

      {list.data && list.data.length > 0 && (
        <div className="grid cols-2">
          {list.data.map((plan) => (
            <Card
              key={plan.id}
              title={
                <span>
                  <Link to={`/plans/${plan.id}`}>{plan.title}</Link>{" "}
                  <Badge tone={plan.type === "loan" ? "info" : "warning"}>
                    {PLAN_TYPES[plan.type]}
                  </Badge>
                </span>
              }
              actions={
                <Button
                  variant="danger"
                  className="btn-sm"
                  onClick={() => remove(plan)}
                >
                  حذف
                </Button>
              }
            >
              <div className="stack">
                {plan.counterparty && (
                  <div className="muted" style={{ fontSize: 13 }}>
                    {isLoan ? "وام‌دهنده" : "فروشنده"}: {plan.counterparty}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13.5,
                  }}
                >
                  <span>پرداخت‌شده ({plan.paid_count}/{plan.installments_count})</span>
                  <span className="money">
                    {formatMoney(plan.total_paid, plan.currency)} /{" "}
                    {formatMoney(plan.total_amount, plan.currency)}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${Math.min(100, plan.progress_percent)}%` }} />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13.5,
                  }}
                >
                  <span>
                    مانده:{" "}
                    <strong className="money">
                      {formatMoney(plan.total_remaining, plan.currency)}
                    </strong>
                  </span>
                  <Badge
                    tone={
                      plan.status === "completed"
                        ? "success"
                        : plan.status === "cancelled"
                          ? "danger"
                          : "info"
                    }
                  >
                    {PLAN_STATUSES[plan.status]}
                  </Badge>
                </div>
                {plan.next_due_date && (
                  <div className="muted" style={{ fontSize: 13 }}>
                    قسط بعدی: {formatDate(plan.next_due_date)}
                  </div>
                )}
                <Link to={`/plans/${plan.id}`} className="btn btn-ghost btn-sm">
                  مشاهدهٔ اقساط
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={isLoan ? "وام جدید" : "خرید قسطی جدید"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="row">
            <Field label="عنوان">
              <Input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={isLoan ? "مثلاً وام مسکن" : "مثلاً یخچال"}
              />
            </Field>
            <Field label={isLoan ? "وام‌دهنده" : "فروشنده"}>
              <Input
                value={form.counterparty}
                onChange={(event) =>
                  setForm({ ...form, counterparty: event.target.value })
                }
                placeholder={isLoan ? "مثلاً بانک ملی" : "مثلاً فروشگاه"}
              />
            </Field>
          </div>

          <div className="row">
            <Field label={isLoan ? "مبلغ وام" : "مبلغ کل خرید"}>
              <Input
                type="number"
                dir="ltr"
                required
                min={1}
                value={form.principal}
                onChange={(event) =>
                  setForm({ ...form, principal: event.target.value })
                }
              />
            </Field>
            <Field label="پیش‌پرداخت">
              <Input
                type="number"
                dir="ltr"
                value={form.down_payment}
                onChange={(event) =>
                  setForm({ ...form, down_payment: event.target.value })
                }
              />
            </Field>
            <Field label="تعداد اقساط">
              <Input
                type="number"
                dir="ltr"
                required
                min={1}
                value={form.installments_count}
                onChange={(event) =>
                  setForm({ ...form, installments_count: event.target.value })
                }
              />
            </Field>
          </div>

          <div className="row">
            <Field label="تاریخ شروع">
              <DateInput
                required
                value={form.start_date}
                onChange={(iso) => setForm({ ...form, start_date: iso })}
              />
            </Field>
            <Field label="اولین سررسید" hint="خالی = یک ماه بعد از شروع">
              <DateInput
                value={form.first_due_date}
                placeholder="خودکار"
                onChange={(iso) => setForm({ ...form, first_due_date: iso })}
              />
            </Field>
            <Field label="فاصله (ماه)">
              <Input
                type="number"
                dir="ltr"
                min={1}
                max={12}
                value={form.interval_months}
                onChange={(event) =>
                  setForm({ ...form, interval_months: event.target.value })
                }
              />
            </Field>
          </div>

          <div className="row">
            <Field label="نرخ سود (٪، اختیاری)">
              <Input
                type="number"
                dir="ltr"
                value={form.interest_rate}
                onChange={(event) =>
                  setForm({ ...form, interest_rate: event.target.value })
                }
              />
            </Field>
            <Field label="حساب پرداخت" hint="برای ثبت خودکار هزینهٔ اقساط">
              <Select
                value={form.account_id}
                onChange={(event) =>
                  setForm({ ...form, account_id: event.target.value })
                }
              >
                <option value="">—</option>
                {(accounts.data ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="دسته‌بندی قسط">
              <Select
                value={form.category_id}
                onChange={(event) =>
                  setForm({ ...form, category_id: event.target.value })
                }
              >
                <option value="">—</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="یادداشت">
            <Textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </Field>

          <div className="modal-foot" style={{ margin: "16px -20px -20px" }}>
            <Button type="submit" disabled={busy}>
              {busy ? "در حال ایجاد…" : "ایجاد و تولید اقساط"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
