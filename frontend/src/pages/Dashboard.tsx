import { Link } from "react-router-dom";

import { Badge, Card, EmptyState, ErrorText, Spinner } from "../components/ui";
import { useApi } from "../hooks";
import { formatDate, formatMoney, PAYMENT_STATUSES } from "../lib/format";
import type { CategoryBreakdownItem, DashboardSummary } from "../types";

export function Dashboard() {
  const summary = useApi<DashboardSummary>("/dashboard/summary?upcoming_limit=8");
  const breakdown = useApi<CategoryBreakdownItem[]>(
    "/dashboard/expenses-by-category",
  );

  if (summary.loading) return <Spinner />;
  if (summary.error) return <ErrorText>{summary.error}</ErrorText>;
  if (!summary.data) return null;

  const data = summary.data;
  const currency = data.currency;
  const maxExpense = Math.max(
    1,
    ...(breakdown.data ?? []).map((item) => item.total),
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>داشبورد</h1>
          <p className="sub">خلاصهٔ وضعیت مالی شما</p>
        </div>
      </header>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <div className="stat tone-primary">
          <div className="stat-label">موجودی کل</div>
          <div className="stat-value money">{formatMoney(data.total_balance, currency)}</div>
          <div className="stat-hint">{data.accounts_count} حساب</div>
        </div>
        <div className="stat tone-success">
          <div className="stat-label">درآمد این ماه</div>
          <div className="stat-value money">{formatMoney(data.month_income, currency)}</div>
        </div>
        <div className="stat tone-danger">
          <div className="stat-label">هزینهٔ این ماه</div>
          <div className="stat-value money">{formatMoney(data.month_expense, currency)}</div>
        </div>
        <div className={`stat ${data.month_net >= 0 ? "tone-success" : "tone-danger"}`}>
          <div className="stat-label">تراز این ماه</div>
          <div className="stat-value money">{formatMoney(data.month_net, currency)}</div>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-label">طلب من از دیگران</div>
          <div className="stat-value money positive">
            {formatMoney(data.debts.receivable_remaining, currency)}
          </div>
          <div className="stat-hint">
            از مجموع {formatMoney(data.debts.receivable_total, currency)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">بدهی من به دیگران</div>
          <div className="stat-value money negative">
            {formatMoney(data.debts.payable_remaining, currency)}
          </div>
          <div className="stat-hint">
            از مجموع {formatMoney(data.debts.payable_total, currency)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">ماندهٔ اقساط فعال</div>
          <div className="stat-value money">
            {formatMoney(data.plans_total_remaining, currency)}
          </div>
          <div className="stat-hint">{data.active_plans_count} برنامهٔ فعال</div>
        </div>
      </div>

      <div className="grid cols-2">
        <Card title="اقساط پیش‌رو">
          {data.upcoming_installments.length === 0 ? (
            <EmptyState text="قسط پرداخت‌نشده‌ای وجود ندارد." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>عنوان</th>
                    <th>قسط</th>
                    <th>سررسید</th>
                    <th className="num">مبلغ</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming_installments.map((item) => (
                    <tr key={item.installment_id}>
                      <td>
                        <Link to={`/plans/${item.plan_id}`}>{item.plan_title}</Link>
                      </td>
                      <td>{item.number}</td>
                      <td>{formatDate(item.due_date)}</td>
                      <td className="num money">
                        {formatMoney(item.remaining, currency)}
                      </td>
                      <td>
                        <Badge tone={item.status === "partial" ? "warning" : "danger"}>
                          {PAYMENT_STATUSES[item.status] ?? item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="هزینه‌های این ماه بر اساس دسته">
          {breakdown.loading ? (
            <Spinner />
          ) : (breakdown.data ?? []).length === 0 ? (
            <EmptyState text="هزینه‌ای برای این ماه ثبت نشده است." />
          ) : (
            <div className="stack">
              {(breakdown.data ?? []).map((item) => (
                <div key={item.category_id ?? "none"}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13.5,
                      marginBottom: 4,
                    }}
                  >
                    <span>{item.category_name}</span>
                    <span className="money muted">
                      {formatMoney(item.total, currency)}
                    </span>
                  </div>
                  <div className="progress">
                    <span
                      style={{ width: `${(item.total / maxExpense) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
