import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth";
import { Button } from "./ui";

const LINKS = [
  { to: "/", label: "داشبورد", icon: "📊", end: true },
  { to: "/accounts", label: "حساب‌ها", icon: "🏦" },
  { to: "/transactions", label: "تراکنش‌ها", icon: "🧾" },
  { to: "/plans", label: "وام و خرید قسطی", icon: "📆" },
  { to: "/debts", label: "طلب و بدهی", icon: "🤝" },
  { to: "/contacts", label: "اشخاص", icon: "👥" },
  { to: "/categories", label: "دسته‌بندی‌ها", icon: "🏷️" },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge">💰</span>
          <span>حساب‌یار</span>
        </div>
        <nav className="nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              <span className="nav-icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="who">{user?.email}</div>
          <Button variant="ghost" className="btn-sm btn-block" onClick={logout}>
            خروج
          </Button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
