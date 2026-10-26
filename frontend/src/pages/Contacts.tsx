import { useState, type FormEvent } from "react";

import { api } from "../api";
import {
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
import type { Contact } from "../types";

const EMPTY = { name: "", phone: "", email: "", note: "" };

export function Contacts() {
  const { data, loading, error, reload } = useApi<Contact[]>("/contacts");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setForm({
      name: contact.name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      note: contact.note ?? "",
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
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      note: form.note.trim() || null,
    };
    try {
      if (editing) {
        await api.patch(`/contacts/${editing.id}`, payload);
      } else {
        await api.post("/contacts", payload);
      }
      setOpen(false);
      setEditing(null);
      setForm({ ...EMPTY });
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(contact: Contact) {
    if (!window.confirm(`«${contact.name}» حذف شود؟`)) return;
    try {
      await api.delete(`/contacts/${contact.id}`);
      await reload();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>اشخاص</h1>
          <p className="sub">اشخاصی که با آن‌ها طلب یا بدهی دارید</p>
        </div>
        <div className="head-actions">
          <Button onClick={openCreate}>+ شخص جدید</Button>
        </div>
      </header>

      {loading && <Spinner />}
      {error && <ErrorText>{error}</ErrorText>}

      {data && data.length === 0 && (
        <Card>
          <EmptyState text="هنوز شخصی ثبت نشده است." />
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>تلفن</th>
                <th>ایمیل</th>
                <th>یادداشت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {data.map((contact) => (
                <tr key={contact.id}>
                  <td>{contact.name}</td>
                  <td dir="ltr">{contact.phone || "—"}</td>
                  <td dir="ltr">{contact.email || "—"}</td>
                  <td className="muted">{contact.note || "—"}</td>
                  <td>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        className="btn-sm"
                        onClick={() => openEdit(contact)}
                      >
                        ویرایش
                      </Button>
                      <Button
                        variant="danger"
                        className="btn-sm"
                        onClick={() => remove(contact)}
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
        title={editing ? "ویرایش شخص" : "شخص جدید"}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <form onSubmit={submit}>
          {formError && <div className="alert alert-error">{formError}</div>}
          <Field label="نام">
            <Input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="مثلاً رضا احمدی"
            />
          </Field>
          <div className="row">
            <Field label="تلفن">
              <Input
                dir="ltr"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <Field label="ایمیل">
              <Input
                dir="ltr"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              انصراف
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
