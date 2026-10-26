import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { Accounts } from "./pages/Accounts";
import { Categories } from "./pages/Categories";
import { Contacts } from "./pages/Contacts";
import { Dashboard } from "./pages/Dashboard";
import { Debts } from "./pages/Debts";
import { Login } from "./pages/Login";
import { PlanDetail } from "./pages/PlanDetail";
import { Plans } from "./pages/Plans";
import { Transactions } from "./pages/Transactions";

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="plans" element={<Plans />} />
        <Route path="plans/:planId" element={<PlanDetail />} />
        <Route path="debts" element={<Debts />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="categories" element={<Categories />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
