import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import { Button, Field, Input } from "../components/ui";
import { errorMessage } from "../hooks";

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, fullName.trim());
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-badge">💰</span>
          <span>حساب‌یار</span>
        </div>
        <h1>{mode === "login" ? "ورود به حساب" : "ساخت حساب جدید"}</h1>
        <p className="sub">مدیریت مالی شخصی: وام، اقساط، طلب و بدهی</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          {mode === "register" && (
            <Field label="نام و نام خانوادگی">
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="مثلاً علی رضایی"
                autoComplete="name"
              />
            </Field>
          )}
          <Field label="ایمیل">
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              dir="ltr"
            />
          </Field>
          <Field label="رمز عبور">
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="حداقل ۶ کاراکتر"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              dir="ltr"
            />
          </Field>
          <Button type="submit" className="btn-block" disabled={busy}>
            {busy ? "لطفاً صبر کنید…" : mode === "login" ? "ورود" : "ثبت‌نام"}
          </Button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "حساب ندارید؟ " : "قبلاً ثبت‌نام کرده‌اید؟ "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "ثبت‌نام کنید" : "وارد شوید"}
          </button>
        </p>
      </div>
    </div>
  );
}
