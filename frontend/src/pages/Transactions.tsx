import { useState, type FormEvent } from "react";

import { api, queryString } from "../api";
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
  todayISO,
  TRANSACTION_TYPES,
} from "../lib/format";
import type {
  Account,
  Category,
  Page,
  Transaction,
  TransactionType,
} from "../types";

interface FormState {
  type: TransactionType;
  amount: string;
  date: string;
  account_id: string;
  transfer_account_id: string;
  category_id: string;
  description: string;
}

const EMPTY: FormState = {
  type: "expense",
  amount: "",
  date: todayISO(),
  account_id: "",
  transfer_account_id: "",
  category_id: "",
  description: "",
};

export function Transactions() {
  const accounts = useApi<Account[]>("/accounts");
  const categories = useApi<Category[]>("/categories");

  const [filters, setFilters] = useState({
    account_id: "",
    type: "",
    category_id: "",
    date_from: "",
    date_to: "",
    search: "",
  });
  const [page, setPage] = useState(1);

  const path = `/transactions${queryString({ ...filters, page, size: 20 })}`;
  const list = useApi<Page<Transaction>>(path);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accountName = (id: number | null) =>
    accounts.data?.find((account) => account.id === id)?.name ?? "—";
  const categoryName = (id: number | null) =>
    categories.data?.find((category) => category.id === id)?.name ?? "—";

  function openCreate() {
    setEditing(null);
    const defaultAccount = accounts.data?.[0]?.id;
    setForm({ ...EMPTY, account_id: defaultAccount ? String(defaultAccount) : "" });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditing(tx);
    setForm({
      type: tx.type,
      amount: String(tx.amount),
      date: tx.date,
      account_id: String(tx.account_id),
      transfer_account_id: tx.transfer_account_id
        ? String(tx.transfer_account_id)
        : "",
      category_id: tx.category_id ? String(tx.category_id) : "",
      description: tx.description ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);

    const payload = {
      type: form.type,
      amount: Number(form.amount),
      date: form.date,
      account_id: Number(form.account_id),
      transfer_account_id:
        form.type === "transfer" && form.transfer_account_id
          ? Number(form.transfer_account_id)
          : null,
      category_id:
        form.type !== "transfer" && form.category_id
          ? Number(form.category_id)
          : null,
      description: form.description.trim() || null,
    };

    try {
      if (editing) {
        await api.patch(`/transactions/${editing.id}`, payload);
      } else {
        await api.post("/transactions", payload);
      }
      setOpen(false);
      await list.reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(tx: Transaction) {
    if (!window.confirm("این تراکنش حذف شود؟")) return;
    try {
      await api.delete(`/transactions/${tx.id}`);
      await list.reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  const categoryOptions = (categories.data ?? []).filter(
    (category) => category.kind === (form.type === "income" ? "income" : "expense"),
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>تراکنش‌ها</h1>
          <p className="sub">درآمدها، هزینه‌ها و انتقال‌های بین حساب‌ها</p>
        </div>
        <div className="head-actions">
          <Button onClick={openCreate} disabled={!accounts.data?.length}>
            + تراکنش جدید
          </Button>
        </div>
      </header>

      <Card>
        <div className="toolbar">
          <Field label="حساب">
            <Select
              value={filters.account_id}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, account_id: event.target.value });
              }}
            >
              <option value="">همه</option>
              {(accounts.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="نوع">
            <Select
              value={filters.type}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, type: event.target.value });
              }}
            >
              <option value="">همه</option>
              {Object.entries(TRANSACTION_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="از تاریخ">
            <DateInput
              value={filters.date_from}
              placeholder="از تاریخ"
              onChange={(iso) => {
                setPage(1);
                setFilters({ ...filters, date_from: iso });
              }}
            />
          </Field>
          <Field label="تا تاریخ">
            <DateInput
              value={filters.date_to}
              placeholder="تا تاریخ"
              onChange={(iso) => {
                setPage(1);
                setFilters({ ...filters, date_to: iso });
              }}
            />
          </Field>
          <Field label="جستجو">
            <Input
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters({ ...filters, search: event.target.value });
              }}
              placeholder="شرح…"
            />
          </Field>
        </div>

        {list.loading && <Spinner />}
        {list.error && <ErrorText>{list.error}</ErrorText>}
        {list.data && list.data.items.length === 0 && (
          <EmptyState text="تراکنشی یافت نشد." />
        )}

        {list.data && list.data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>تاریخ</th>
                    <th>نوع</th>
                    <th>حساب</th>
                    <th>دسته</th>
                    <th className="num">مبلغ</th>
                    <th>شرح</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.date)}</td>
                      <td>
                        <Badge
                          tone={
                            tx.type === "income"
                              ? "success"
                              : tx.type === "expense"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {TRANSACTION_TYPES[tx.type]}
                        </Badge>
                      </td>
                      <td>
                        {accountName(tx.account_id)}
                        {tx.type === "transfer" &&
                          ` → ${accountName(tx.transfer_account_id)}`}
                      </td>
                      <td>{categoryName(tx.category_id)}</td>
                      <td className="num money">{formatMoney(tx.amount)}</td>
                      <td className="muted">{tx.description || "—"}</td>
                      <td>
                        <div className="actions">
                          <Button
                            variant="ghost"
                            className="btn-sm"
                            onClick={() => openEdit(tx)}
                          >
                            ویرایش
                          </Button>
                          <Button
                            variant="danger"
                            className="btn-sm"
                            onClick={() => remove(tx)}
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

            <div
              className="actions"
              style={{ justifyContent: "space-between", marginTop: 14 }}
            >
              <span className="muted" style={{ fontSize: 13 }}>
                مجموع {list.data.total} تراکنش
              </span>
              <div className="actions">
                <Button
                  variant="ghost"
                  className="btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  قبلی
                </Button>
                <Button
                  variant="ghost"
                  className="btn-sm"
                  disabled={page >= Math.ceil(list.data.total / list.data.size)}
                  onClick={() => setPage((value) => value + 1)}
                >
                  بعدی
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={open}
        title={editing ? "ویرایش تراکنش" : "تراکنش جدید"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="row">
            <Field label="نوع">
              <Select
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as TransactionType })
                }
              >
                {Object.entries(TRANSACTION_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
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
          </div>

          <div className="row">
            <Field label={form.type === "transfer" ? "از حساب" : "حساب"}>
              <Select
                required
                value={form.account_id}
                onChange={(event) =>
                  setForm({ ...form, account_id: event.target.value })
                }
              >
                <option value="">انتخاب کنید</option>
                {(accounts.data ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>

            {form.type === "transfer" ? (
              <Field label="به حساب">
                <Select
                  required
                  value={form.transfer_account_id}
                  onChange={(event) =>
                    setForm({ ...form, transfer_account_id: event.target.value })
                  }
                >
                  <option value="">انتخاب کنید</option>
                  {(accounts.data ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="دسته‌بندی">
                <Select
                  value={form.category_id}
                  onChange={(event) =>
                    setForm({ ...form, category_id: event.target.value })
                  }
                >
                  <option value="">بدون دسته</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <Field label="شرح">
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
    </>
  );
}
