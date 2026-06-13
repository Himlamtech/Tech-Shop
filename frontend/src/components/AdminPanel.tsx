import React from "react";
import { AdminDashboardData, AdminPaymentRecord, AdminReviewRecord, AdminUserRecord, AuthUser } from "../types";

interface AdminPanelProps {
  user: AuthUser;
  dashboard: AdminDashboardData | null;
  users: AdminUserRecord[];
  payments: AdminPaymentRecord[];
  reviews: AdminReviewRecord[];
  loading: boolean;
  error: string | null;
  selectedUserId: string | null;
  onRefresh: () => void;
  onSelectUser: (user: AdminUserRecord) => void;
  onToggleUserStatus: (user: AdminUserRecord) => void;
  onClearLockout: (user: AdminUserRecord) => void;
  onChangeUserRole: (user: AdminUserRecord, role: string) => void;
  onDeleteReview: (review: AdminReviewRecord) => void;
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className="rounded-[24px] border border-stone-900/10 bg-white/65 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-editorial-text">{value}</p>
      <p className="mt-2 text-sm text-editorial-text/58">{hint}</p>
    </article>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPanel({ user, dashboard, users, payments, reviews, loading, error, selectedUserId, onRefresh, onSelectUser, onToggleUserStatus, onClearLockout, onChangeUserRole, onDeleteReview }: AdminPanelProps) {
  return (
    <section className="glass-panel glass-border rounded-[32px] p-6 md:p-8">
      <div className="flex flex-col gap-4 border-b border-stone-900/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/45">Admin console</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-editorial-text">Operations workspace</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-editorial-text/62">
            Signed in as {user.email} with role {user.role}. This surface keeps identity, payments, orders, and review moderation visible in one place.
          </p>
        </div>
        <button onClick={onRefresh} className="rounded-2xl border border-stone-900/10 bg-white/65 px-4 py-3 text-sm font-semibold text-editorial-text transition hover:border-amber-700/25 hover:bg-amber-700/10">
          Refresh admin data
        </button>
      </div>

      {error && <div className="mt-6 rounded-2xl border border-red-700/20 bg-red-700/10 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={dashboard?.identity.total_users ?? "-"} hint={`Active ${dashboard?.identity.active_users ?? 0} / Locked ${dashboard?.identity.locked_users ?? 0}`} />
        <MetricCard label="Catalog" value={dashboard?.catalog.total_products ?? "-"} hint={`Categories ${dashboard?.catalog.total_categories ?? 0}`} />
        <MetricCard label="Orders" value={dashboard?.orders.total_orders ?? "-"} hint={`Revenue ${dashboard?.orders.total_revenue ?? "0.00"}`} />
        <MetricCard label="Payments" value={dashboard?.payments.total_transactions ?? "-"} hint={`Success amount ${dashboard?.payments.successful_amount ?? "0.00"}`} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-editorial-text/55">Users</h3>
            {loading && <span className="text-xs text-editorial-text/38">Syncing...</span>}
          </div>
          <div className="space-y-3">
            {users.map((record) => (
              <article key={record.id} className={`rounded-[24px] border p-4 ${selectedUserId === record.id ? "border-amber-700/25 bg-amber-700/10" : "border-stone-900/10 bg-white/65"}`}>
                <p className="text-sm font-semibold text-editorial-text">{record.email}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-editorial-text/45">{record.role}</p>
                <p className="mt-2 text-xs text-editorial-text/58">Active: {record.is_active ? "yes" : "no"} | Failed attempts: {record.failed_login_attempts}</p>
                <p className="mt-1 text-[11px] text-editorial-text/45">Locked until: {formatDateTime(record.locked_until)}</p>
                <p className="mt-1 text-[11px] text-editorial-text/45">Created: {formatDateTime(record.created_at)}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => onSelectUser(record)} className="rounded-xl border border-stone-900/10 bg-white/65 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-editorial-text/72">Inspect</button>
                  <select value={record.role} onChange={(event) => onChangeUserRole(record, event.target.value)} className="rounded-xl border border-stone-900/10 bg-stone-100/80 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-editorial-text outline-none">
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                    <option value="customer">customer</option>
                  </select>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => onToggleUserStatus(record)} className="rounded-xl border border-stone-900/10 bg-white/65 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-editorial-text/72">{record.is_active ? "Disable" : "Enable"}</button>
                  <button onClick={() => onClearLockout(record)} className="rounded-xl border border-stone-900/10 bg-white/65 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-editorial-text/72">Clear lock</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-editorial-text/55">Payments</h3>
          <div className="space-y-3">
            {payments.map((payment) => (
              <article key={payment.id} className="rounded-[24px] border border-stone-900/10 bg-white/65 p-4">
                <p className="text-sm font-semibold text-editorial-text">{payment.status.toUpperCase()}</p>
                <p className="mt-1 text-xs text-editorial-text/58">Order {payment.order_id}</p>
                <p className="mt-2 text-sm text-editorial-text">{payment.amount}</p>
                <p className="mt-1 text-[11px] text-editorial-text/45">Idempotency: {payment.idempotency_key}</p>
                <p className="mt-1 text-[11px] text-editorial-text/45">Updated: {formatDateTime(payment.updated_at)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-editorial-text/55">Reviews</h3>
          <div className="space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-[24px] border border-stone-900/10 bg-white/65 p-4">
                <p className="text-sm font-semibold text-editorial-text">Rating {review.rating}/5</p>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-editorial-text/62">{review.comment}</p>
                <p className="mt-2 text-[11px] text-editorial-text/45">User {review.user_id.slice(0, 8)} / Product {review.product_id.slice(0, 8)}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-editorial-text/42">{review.sentiment_label || review.sentiment_status}</div>
                  <button onClick={() => onDeleteReview(review)} className="rounded-xl border border-red-700/20 bg-red-700/10 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-red-800">Delete</button>
                </div>
                <p className="mt-2 text-[11px] text-editorial-text/45">Created: {formatDateTime(review.created_at)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
