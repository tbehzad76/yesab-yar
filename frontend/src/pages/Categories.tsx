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
  Spinner,
} from "../components/ui";
import { errorMessage, useApi } from "../hooks";
import type { Category, CategoryKind } from "../types";

const EMPTY = { name: "", color: "#3b5bdb" };

export function Categories() {
  const [kind, setKind] = useState<CategoryKind>("expense");
  const { data, loading, error, reload } = useApi<Category[]>(
    `/categories?kind=${kind}`,
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/categories", {
        name: form.name.trim(),
        kind,
        color: form.color,
      });
      setOpen(false);
      setForm({ ...EMPTY });
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`دسته «${category.name}» حذف شود؟`)) return;
    try {
      await api.delete(`/categories/${category.id}`);
      await reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>دسته‌بندی‌ها</h1>
          <p className="sub">برای گروه‌بندی درآمدها و هزینه‌ها</p>
        </div>
        <div className="head-actions">
          <Button onClick={() => setOpen(true)}>+ دستهٔ جدید</Button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab${kind === "expense" ? " active" : ""}`}
          onClick={() => setKind("expense")}
        >
          هزینه‌ها
        </button>
        <button
          className={`tab${kind === "income" ? " active" : ""}`}
          onClick={() => setKind("income")}
        >
          درآمدها
        </button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorText>{error}</ErrorText>}

      {data && data.length === 0 && (
        <Card>
          <EmptyState
            text={
              kind === "expense"
                ? "دستهٔ هزینه‌ای وجود ندارد."
                : "دستهٔ درآمدی وجود ندارد."
            }
          />
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>نوع</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {data.map((category) => (
                <tr key={category.id}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: category.color ?? "#94a3b8",
                        marginLeft: 8,
                      }}
                    />
                    {category.name}
                  </td>
                  <td>
                    <Badge tone={category.kind === "income" ? "success" : "danger"}>
                      {category.kind === "income" ? "درآمد" : "هزینه"}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      className="btn-sm"
                      onClick={() => remove(category)}
                    >
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title="دستهٔ جدید" onClose={() => setOpen(false)}>
        <form onSubmit={submit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <Field label="نام دسته">
            <Input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder={kind === "expense" ? "مثلاً خواربار" : "مثلاً حقوق"}
            />
          </Field>
          <Field label="رنگ">
            <input
              className="input"
              type="color"
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
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
