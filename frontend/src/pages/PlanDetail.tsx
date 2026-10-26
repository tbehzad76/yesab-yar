import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

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
  Spinner,
} from "../components/ui";
import { errorMessage, useApi } from "../hooks";
import {
  formatDate,
  formatMoney,
  PAYMENT_STATUSES,
  PLAN_STATUSES,
  PLAN_TYPES,
  todayISO,
} from "../lib/format";
import type { Installment, Plan } from "../types";

export function PlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const { data, loading, error, reload } = useApi<Plan>(
    planId ? `/plans/${planId}` : null,
  );

  const [payTarget, setPayTarget] = useState<Installment | null>(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    date: todayISO(),
    note: "",
    record_transaction: true,
  });
  const [payError, setPayError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openPay(installment: Installment) {
    setPayTarget(installment);
    setPayForm({
      amount: String(installment.amount - installment.paid_amount),
      date: todayISO(),
      note: "",
      record_transaction: true,
    });
    setPayError(null);
  }

  async function submitPay(event: FormEvent) {
    event.preventDefault();
    if (!payTarget || !data) return;
    setBusy(true);
    setPayError(null);
    try {
      await api.post(
        `/plans/${data.id}/installments/${payTarget.id}/pay`,
        {
          amount: Number(payForm.amount),
          date: payForm.date,
          note: payForm.note.trim() || null,
          record_transaction: payForm.record_transaction,
        },
      );
      setPayTarget(null);
      await reload();
    } catch (err) {
      setPayError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function unpay(installment: Installment) {
    if (!data) return;
    if (!window.confirm(`قسط ${installment.number} به حالت پرداخت‌نشده برگردد؟`))
      return;
    try {
      await api.post(
        `/plans/${data.id}/installments/${installment.id}/unpay`,
      );
      await reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return null;

  const plan = data;
  const currency = plan.currency;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{plan.title}</h1>
          <p className="sub">
            <Link to="/plans">← بازگشت به فهرست</Link>
            {plan.counterparty && ` • ${plan.counterparty}`}
          </p>
        </div>
        <div className="head-actions">
          <Badge tone={plan.type === "loan" ? "info" : "warning"}>
            {PLAN_TYPES[plan.type]}
          </Badge>
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
      </header>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-label">مبلغ کل اقساط</div>
          <div className="stat-value money">{formatMoney(plan.total_amount, currency)}</div>
          <div className="stat-hint">
            اصل: {formatMoney(plan.principal, currency)}
            {plan.down_payment > 0 &&
              ` • پیش‌پرداخت: ${formatMoney(plan.down_payment, currency)}`}
          </div>
        </div>
        <div className="stat tone-success">
          <div className="stat-label">پرداخت‌شده</div>
          <div className="stat-value money">{formatMoney(plan.total_paid, currency)}</div>
          <div className="stat-hint">
            {plan.paid_count} از {plan.installments_count} قسط
          </div>
        </div>
        <div className="stat tone-danger">
          <div className="stat-label">مانده</div>
          <div className="stat-value money">
            {formatMoney(plan.total_remaining, currency)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">قسط بعدی</div>
          <div className="stat-value">{formatDate(plan.next_due_date)}</div>
          <div className="stat-hint">
            {plan.interest_rate ? `نرخ سود: ${plan.interest_rate}٪` : "—"}
          </div>
        </div>
      </div>

      <Card title="پیشرفت بازپرداخت">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13.5,
            marginBottom: 6,
          }}
        >
          <span>{plan.progress_percent.toFixed(1)}٪</span>
          <span className="muted">
            شروع: {formatDate(plan.start_date)}
          </span>
        </div>
        <div className="progress">
          <span style={{ width: `${Math.min(100, plan.progress_percent)}%` }} />
        </div>
      </Card>

      <div style={{ height: 18 }} />

      <Card title="جدول اقساط">
        {plan.installments.length === 0 ? (
          <EmptyState text="قسطی ثبت نشده است." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>سررسید</th>
                  <th className="num">مبلغ</th>
                  <th className="num">پرداخت‌شده</th>
                  <th className="num">باقی‌مانده</th>
                  <th>وضعیت</th>
                  <th>تاریخ پرداخت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {plan.installments.map((installment) => {
                  const remaining = installment.amount - installment.paid_amount;
                  return (
                    <tr key={installment.id}>
                      <td>{installment.number}</td>
                      <td>{formatDate(installment.due_date)}</td>
                      <td className="num money">{formatMoney(installment.amount, currency)}</td>
                      <td className="num money">
                        {formatMoney(installment.paid_amount, currency)}
                      </td>
                      <td className="num money">{formatMoney(remaining, currency)}</td>
                      <td>
                        <Badge
                          tone={
                            installment.status === "paid"
                              ? "success"
                              : installment.status === "partial"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {PAYMENT_STATUSES[installment.status]}
                        </Badge>
                      </td>
                      <td>{formatDate(installment.paid_date)}</td>
                      <td>
                        <div className="actions">
                          {installment.status !== "paid" && (
                            <Button
                              variant="success"
                              className="btn-sm"
                              onClick={() => openPay(installment)}
                            >
                              پرداخت
                            </Button>
                          )}
                          {installment.status !== "unpaid" && (
                            <Button
                              variant="ghost"
                              className="btn-sm"
                              onClick={() => unpay(installment)}
                            >
                              برگرداندن
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={payTarget !== null}
        title={`پرداخت قسط ${payTarget?.number ?? ""}`}
        onClose={() => setPayTarget(null)}
      >
        <form onSubmit={submitPay}>
          {payError && <div className="alert alert-error">{payError}</div>}
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
          {plan.account_id && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={payForm.record_transaction}
                onChange={(event) =>
                  setPayForm({
                    ...payForm,
                    record_transaction: event.target.checked,
                  })
                }
              />
              ثبت خودکار هزینه در حساب مربوطه
            </label>
          )}
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
