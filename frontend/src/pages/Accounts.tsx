import { useState, type FormEvent } from "react";

import { api } from "../api";
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
} from "../components/ui";
import { errorMessage, useApi } from "../hooks";
import { ACCOUNT_TYPES, formatMoney } from "../lib/format";
import type { Account, AccountType } from "../types";

const EMPTY = {
  name: "",
  type: "bank" as AccountType,
  initial_balance: "0",
  note: "",
};

export function Accounts() {
  const { data, loading, error, reload } = useApi<Account[]>("/accounts");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      initial_balance: String(account.initial_balance),
      note: account.note ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      initial_balance: Number(form.initial_balance) || 0,
      note: form.note.trim() || null,
    };
    try {
      if (editing) {
        await api.patch(`/accounts/${editing.id}`, payload);
      } else {
        await api.post("/accounts", payload);
      }
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(account: Account) {
    if (!window.confirm(`حساب «${account.name}» حذف شود؟`)) return;
    try {
      await api.delete(`/accounts/${account.id}`);
      await reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>حساب‌ها</h1>
          <p className="sub">حساب‌های نقدی، بانکی، کیف پول و اعتباری</p>
        </div>
        <div className="head-actions">
          <Button onClick={openCreate}>+ حساب جدید</Button>
        </div>
      </header>

      {loading && <Spinner />}
      {error && <ErrorText>{error}</ErrorText>}

      {data && data.length === 0 && (
        <Card>
          <EmptyState text="هنوز حسابی نساخته‌اید. یک حساب بانکی یا نقدی بسازید." />
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>نوع</th>
                <th className="num">موجودی اولیه</th>
                <th className="num">موجودی فعلی</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {data.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{ACCOUNT_TYPES[account.type] ?? account.type}</td>
                  <td className="num money">
                    {formatMoney(account.initial_balance, account.currency)}
                  </td>
                  <td className="num money">
                    {formatMoney(account.balance, account.currency)}
                  </td>
                  <td>
                    <Badge tone={account.is_active ? "success" : "neutral"}>
                      {account.is_active ? "فعال" : "غیرفعال"}
                    </Badge>
                  </td>
                  <td>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        className="btn-sm"
                        onClick={() => openEdit(account)}
                      >
                        ویرایش
                      </Button>
                      <Button
                        variant="danger"
                        className="btn-sm"
                        onClick={() => remove(account)}
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
        title={editing ? "ویرایش حساب" : "حساب جدید"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <Field label="نام حساب">
            <Input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="مثلاً بانک ملت"
            />
          </Field>
          <div className="row">
            <Field label="نوع">
              <Select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as AccountType })
                }
              >
                {Object.entries(ACCOUNT_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="موجودی اولیه" hint="مبلغ شروع این حساب">
              <Input
                type="number"
                dir="ltr"
                value={form.initial_balance}
                onChange={(event) =>
                  setForm({ ...form, initial_balance: event.target.value })
                }
              />
            </Field>
          </div>
          <Field label="یادداشت">
            <Input
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
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
    </>
  );
}
