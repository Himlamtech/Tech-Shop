import React from "react";
import {
  AdminDashboardData,
  AdminPaymentRecord,
  AdminReviewRecord,
  AdminUserRecord,
  AuthUser,
} from "../types";

interface AdminPanelProps {
  user: AuthUser;
  dashboard: AdminDashboardData | null;
  users: AdminUserRecord[];
  payments: AdminPaymentRecord[];
  reviews: AdminReviewRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onToggleUserStatus: (user: AdminUserRecord) => void;
  onClearLockout: (user: AdminUserRecord) => void;
  onDeleteReview: (review: AdminReviewRecord) => void;
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className="border border-editorial-text/15 bg-editorial-paper p-5">
      <p className="cap-text text-editorial-text/45">{label}</p>
      <p className="serif mt-3 text-3xl font-bold text-editorial-dark">{value}</p>
      <p className="mt-2 text-xs text-editorial-text/60">{hint}</p>
    </article>
  );
}

export default function AdminPanel({
  user,
  dashboard,
  users,
  payments,
  reviews,
  loading,
  error,
  onRefresh,
  onToggleUserStatus,
  onClearLockout,
  onDeleteReview,
}: AdminPanelProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8 pt-6">
      <div className="border border-editorial-text/15 bg-white/70 p-6 md:p-8">
        <div className="flex flex-col gap-4 border-b border-editorial-text/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="cap-text text-editorial-text/45">Backoffice Signal Room</p>
            <h2 className="serif mt-2 text-3xl font-bold text-editorial-dark">Admin Operations Console</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-editorial-text/70">
              Signed in as {user.email} with role {user.role}. This board unifies identity, orders, payments,
              and review moderation into one working surface.
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="border border-editorial-text px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-editorial-dark transition hover:bg-editorial-dark hover:text-editorial-bg"
          >
            Refresh Admin Data
          </button>
        </div>

        {error && <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Users"
            value={dashboard?.identity.total_users ?? "-"}
            hint={`Active ${dashboard?.identity.active_users ?? 0} / Locked ${dashboard?.identity.locked_users ?? 0}`}
          />
          <MetricCard
            label="Catalog"
            value={dashboard?.catalog.total_products ?? "-"}
            hint={`Categories ${dashboard?.catalog.total_categories ?? 0}`}
          />
          <MetricCard
            label="Orders"
            value={dashboard?.orders.total_orders ?? "-"}
            hint={`Revenue ${dashboard?.orders.total_revenue ?? "0.00"}`}
          />
          <MetricCard
            label="Payments"
            value={dashboard?.payments.total_transactions ?? "-"}
            hint={`Success amount ${dashboard?.payments.successful_amount ?? "0.00"}`}
          />
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-3">
          <section className="space-y-4 xl:col-span-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-editorial-text/70">Users</h3>
              {loading && <span className="text-xs text-editorial-text/45">Syncing...</span>}
            </div>
            <div className="space-y-3">
              {users.map((record) => (
                <article key={record.id} className="border border-editorial-text/10 bg-editorial-paper p-4">
                  <p className="text-sm font-semibold text-editorial-dark">{record.email}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-editorial-text/50">{record.role}</p>
                  <p className="mt-2 text-xs text-editorial-text/60">
                    Active: {record.is_active ? "yes" : "no"} | Failed attempts: {record.failed_login_attempts}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onToggleUserStatus(record)}
                      className="border border-editorial-text/20 px-3 py-2 text-[11px] uppercase tracking-[0.14em]"
                    >
                      {record.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => onClearLockout(record)}
                      className="border border-editorial-text/20 px-3 py-2 text-[11px] uppercase tracking-[0.14em]"
                    >
                      Clear Lock
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-4 xl:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-editorial-text/70">Payments</h3>
            <div className="space-y-3">
              {payments.map((payment) => (
                <article key={payment.id} className="border border-editorial-text/10 bg-editorial-paper p-4">
                  <p className="text-sm font-semibold text-editorial-dark">{payment.status.toUpperCase()}</p>
                  <p className="mt-1 text-xs text-editorial-text/60">Order {payment.order_id}</p>
                  <p className="mt-2 text-sm text-editorial-dark">{payment.amount}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-4 xl:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-editorial-text/70">Reviews</h3>
            <div className="space-y-3">
              {reviews.map((review) => (
                <article key={review.id} className="border border-editorial-text/10 bg-editorial-paper p-4">
                  <p className="text-sm font-semibold text-editorial-dark">Rating {review.rating}/5</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-editorial-text/70">{review.comment}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-editorial-text/50">
                      {review.sentiment_label || review.sentiment_status}
                    </span>
                    <button
                      onClick={() => onDeleteReview(review)}
                      className="border border-red-300 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
