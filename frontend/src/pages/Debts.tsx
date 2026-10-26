import { useState, type FormEvent } from "react";

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
  DEBT_DIRECTIONS,
  DEBT_STATUSES,
  formatDate,
  formatMoney,
  todayISO,
} from "../lib/format";
import type { Contact, Debt, DebtDirection } from "../types";

interface DebtForm {
  contact_id: string;
  title: string;
  amount: string;
  date: string;
  due_date: string;
  description: string;
}

const EMPTY_DEBT: DebtForm = {
  contact_id: "",
  title: "",
  amount: "",
  date: todayISO(),
  due_date: "",
  description: "",
};

export function Debts() {
  const [direction, setDirection] = useState<DebtDirection>("receivable");
  const contacts = useApi<Contact[]>("/contacts");
  const list = useApi<Debt[]>(`/debts?direction=${direction}`);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DebtForm>({ ...EMPTY_DEBT });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [payTarget, setPayTarget] = useState<Debt | null>(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    date: todayISO(),
    note: "",
  });
  const [payError, setPayError] = useState<string | null>(null);

  const contactName = (id: number | null) =>
    contacts.data?.find((contact) => contact.id === id)?.name ?? null;

  function openCreate() {
    setForm({ ...EMPTY_DEBT });
    setFormError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/debts", {
        direction,
        contact_id: form.contact_id ? Number(form.contact_id) : null,
        title: form.title.trim() || null,
        amount: Number(form.amount),
        date: form.date,
        due_date: form.due_date || null,
        description: form.description.trim() || null,
      });
      setOpen(false);
      await list.reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function openPay(debt: Debt) {
    setPayTarget(debt);
    setPayForm({
      amount: String(debt.remaining),
      date: todayISO(),
      note: "",
    });
    setPayError(null);
  }

  async function submitPay(event: FormEvent) {
    event.preventDefault();
    if (!payTarget) return;
    setBusy(true);
    setPayError(null);
    try {
      await api.post(`/debts/${payTarget.id}/payments`, {
        amount: Number(payForm.amount),
        date: payForm.date,
        note: payForm.note.trim() || null,
      });
      setPayTarget(null);
      await list.reload();
    } catch (err) {
      setPayError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(debt: Debt) {
    if (!window.confirm("این قرض و همهٔ پرداخت‌هایش حذف شود؟")) return;
    try {
      await api.delete(`/debts/${debt.id}`);
      await list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  const isReceivable = direction === "receivable";

  return (
    <>
      <header className="page-head">
        <div>
          <h1>طلب و بدهی</h1>
          <p className="sub">
            پول‌هایی که به دیگران داده‌اید و پول‌هایی که از دیگران گرفته‌اید
          </p>
        </div>
        <div className="head-actions">
          <Button onClick={openCreate}>+ قرض جدید</Button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab${isReceivable ? " active" : ""}`}
          onClick={() => setDirection("receivable")}
        >
          طلب من (داده‌ام)
        </button>
        <button
          className={`tab${!isReceivable ? " active" : ""}`}
          onClick={() => setDirection("payable")}
        >
          بدهی من (گرفته‌ام)
        </button>
      </div>

      {list.loading && <Spinner />}
      {list.error && <ErrorText>{list.error}</ErrorText>}

      {list.data && list.data.length === 0 && (
        <Card>
          <EmptyState
            text={
              isReceivable
                ? "طلبی ثبت نشده است."
                : "بدهی‌ای ثبت نشده است."
            }
          />
        </Card>
      )}

      {list.data && list.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>شخص / عنوان</th>
                <th className="num">مبلغ</th>
                <th className="num">پرداخت‌شده</th>
                <th className="num">باقی‌مانده</th>
                <th>سررسید</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((debt) => (
                <tr key={debt.id}>
                  <td>
                    {contactName(debt.contact_id) ?? debt.title ?? "—"}
                    {contactName(debt.contact_id) && debt.title && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {debt.title}
                      </div>
                    )}
                  </td>
                  <td className="num money">{formatMoney(debt.amount, debt.currency)}</td>
                  <td className="num money">
                    {formatMoney(debt.paid_amount, debt.currency)}
                  </td>
                  <td className="num money">
                    <span className={isReceivable ? "positive" : "negative"}>
                      {formatMoney(debt.remaining, debt.currency)}
                    </span>
                  </td>
                  <td>{formatDate(debt.due_date)}</td>
                  <td>
                    <Badge
                      tone={
                        debt.status === "settled"
                          ? "success"
                          : debt.status === "partial"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {DEBT_STATUSES[debt.status]}
                    </Badge>
                  </td>
                  <td>
                    <div className="actions">
                      <Button
                        variant="success"
                        className="btn-sm"
                        disabled={debt.status === "settled"}
                        onClick={() => openPay(debt)}
                      >
                        پرداخت
                      </Button>
                      <Button
                        variant="danger"
                        className="btn-sm"
                        onClick={() => remove(debt)}
                      >
                        حذف
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title={`${DEBT_DIRECTIONS[direction]} — مورد جدید`}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="row">
            <Field label="شخص" hint="می‌توانید خالی بگذارید و عنوان بنویسید">
              <Select
                value={form.contact_id}
                onChange={(event) =>
                  setForm({ ...form, contact_id: event.target.value })
                }
              >
                <option value="">—</option>
                {(contacts.data ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="عنوان">
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="مثلاً قرض برای خرید ماشین"
              />
            </Field>
          </div>
          <div className="row">
            <Field label="مبلغ">
              <Input
                type="number"
                dir="ltr"
                required
                min={1}
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </Field>
            <Field label="تاریخ">
              <DateInput
                required
                value={form.date}
                onChange={(iso) => setForm({ ...form, date: iso })}
              />
            </Field>
            <Field label="سررسید (اختیاری)">
              <DateInput
                value={form.due_date}
                allowClear
                onChange={(iso) => setForm({ ...form, due_date: iso })}
              />
            </Field>
          </div>
          <Field label="توضیحات">
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          <div className="modal-foot" style={{ margin: "16px -20px -20px" }}>
            <Button type="submit" disabled={busy}>
              {busy ? "در حال ذخیره…" : "ذخیره"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={payTarget !== null}
        title="ثبت پرداخت"
        onClose={() => setPayTarget(null)}
      >
        <form onSubmit={submitPay}>
          {payError && <div className="alert alert-error">{payError}</div>}
          {payTarget && (
            <p className="muted" style={{ marginTop: 0 }}>
              باقی‌مانده: {formatMoney(payTarget.remaining, payTarget.currency)}
            </p>
          )}
          <div className="row">
            <Field label="مبلغ پرداخت">
              <Input
                type="number"
                dir="ltr"
                required
                min={1}
                value={payForm.amount}
                onChange={(event) =>
                  setPayForm({ ...payForm, amount: event.target.value })
                }
              />
            </Field>
            <Field label="تاریخ">
              <DateInput
                required
                value={payForm.date}
                onChange={(iso) => setPayForm({ ...payForm, date: iso })}
              />
            </Field>
          </div>
          <Field label="یادداشت">
            <Input
              value={payForm.note}
              onChange={(event) =>
                setPayForm({ ...payForm, note: event.target.value })
              }
            />
          </Field>
          <div className="modal-foot" style={{ margin: "16px -20px -20px" }}>
            <Button type="submit" disabled={busy}>
              {busy ? "در حال ثبت…" : "ثبت پرداخت"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPayTarget(null)}
            >
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
