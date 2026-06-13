import React, { useEffect, useState } from "react";
import {
  Box,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Star,
  Truck,
  User,
  X,
} from "lucide-react";
import { AuthSession } from "../types";
import { authorizedFetch } from "../auth";
import { parseApiResponse } from "../api";

interface CustomerProfileProps {
  authSession: AuthSession;
  onClose: () => void;
  onSessionRefresh: (session: AuthSession | null) => void;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_sku: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  product_image_url?: string;
}

interface Order {
  id: string;
  status: string;
  total_amount: string;
  subtotal: string;
  shipping_fee: string;
  shipping_address: string;
  created_at: string;
  items: OrderItem[];
  tracking_code?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  payment_pending: { label: "Chờ thanh toán", color: "text-amber-700 bg-amber-700/10 border-amber-700/20" },
  paid: { label: "Đã thanh toán", color: "text-emerald-700 bg-emerald-700/10 border-emerald-700/20" },
  payment_failed: { label: "Thanh toán thất bại", color: "text-red-700 bg-red-700/10 border-red-700/20" },
  shipping: { label: "Đang vận chuyển", color: "text-blue-700 bg-blue-700/10 border-blue-700/20" },
  completed: { label: "Hoàn thành", color: "text-emerald-800 bg-emerald-800/10 border-emerald-800/20" },
  cancelled: { label: "Đã hủy", color: "text-stone-500 bg-stone-100 border-stone-200" },
  created: { label: "Đã tạo", color: "text-stone-600 bg-stone-100 border-stone-200" },
};

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchMyOrders(
  session: AuthSession,
  onSessionRefresh: (session: AuthSession | null) => void,
): Promise<Order[]> {
  const res = await authorizedFetch(
    "/api/orders/my-orders",
    { method: "GET" },
    session,
    onSessionRefresh,
  );
  const { data } = await parseApiResponse<{ results: Order[] }>(res);
  return Array.isArray(data) ? data : (data as any)?.results ?? [];
}

export default function CustomerProfile({
  authSession,
  onClose,
  onSessionRefresh,
}: CustomerProfileProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMyOrders(authSession, onSessionRefresh)
      .then(setOrders)
      .catch((err) => setError(err?.message || "Không thể tải đơn hàng."))
      .finally(() => setLoading(false));
  }, [authSession.user.id]);

  const totalSpent = orders
    .filter((o) => o.status === "completed" || o.status === "paid" || o.status === "shipping")
    .reduce((sum, o) => sum + parseFloat(o.total_amount || "0"), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/28 p-0 md:p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-none border border-stone-900/10 bg-white shadow-[0_30px_100px_rgba(112,82,48,0.35)] md:h-[92vh] md:rounded-[8px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-900/10 px-6 py-4 md:px-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/45">Tài khoản</p>
            <h2 className="mt-1 text-xl font-semibold text-editorial-text">Thông tin khách hàng</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/70 transition hover:border-amber-700/25 hover:bg-amber-700/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile card */}
          <div className="border-b border-stone-900/10 bg-[#f7f1e6] p-6 md:p-8">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-700/15 text-amber-800">
                <User className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-editorial-text">{authSession.user.email}</h3>
                <p className="mt-1 text-sm text-editorial-text/58">Khách hàng thành viên</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-editorial-text">{orders.length}</p>
                    <p className="mt-1 text-xs text-editorial-text/55">Đơn hàng</p>
                  </div>
                  <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-editorial-text">
                      {orders.filter((o) => o.status === "completed").length}
                    </p>
                    <p className="mt-1 text-xs text-editorial-text/55">Hoàn thành</p>
                  </div>
                  <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-center">
                    <p className="text-lg font-bold text-editorial-text">{formatCurrency(totalSpent)}</p>
                    <p className="mt-1 text-xs text-editorial-text/55">Tổng chi tiêu</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="p-6 md:p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-editorial-text">Đơn hàng của tôi</h3>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchMyOrders(authSession, onSessionRefresh)
                    .then(setOrders)
                    .catch((err) => setError(err?.message || "Lỗi"))
                    .finally(() => setLoading(false));
                }}
                className="flex items-center gap-1.5 rounded-full border border-stone-900/10 px-3 py-1.5 text-xs text-editorial-text/60 transition hover:bg-stone-50"
              >
                <RefreshCw className="h-3 w-3" />
                Làm mới
              </button>
            </div>

            {loading ? (
              <div className="mt-8 flex flex-col items-center gap-3 py-12 text-editorial-text/45">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <p className="text-sm">Đang tải đơn hàng...</p>
              </div>
            ) : error ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                {error}
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-8 flex flex-col items-center gap-3 py-12 text-center">
                <Box className="h-12 w-12 text-editorial-text/20" />
                <p className="text-base font-medium text-editorial-text/55">Chưa có đơn hàng nào</p>
                <p className="text-sm text-editorial-text/38">Hãy thêm sản phẩm vào giỏ và đặt hàng ngay!</p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {orders.map((order) => {
                  const status = STATUS_LABELS[order.status] ?? { label: order.status, color: "text-stone-600 bg-stone-100 border-stone-200" };
                  const isExpanded = expandedOrder === order.id;
                  return (
                    <div key={order.id} className="overflow-hidden rounded-[8px] border border-stone-900/10 bg-white">
                      {/* Order header */}
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="flex w-full items-center gap-4 p-5 text-left hover:bg-stone-50/80"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-stone-900/10 bg-stone-100">
                          <Package className="h-5 w-5 text-editorial-text/55" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-editorial-text">#{order.id.slice(0, 8).toUpperCase()}</span>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-4 text-xs text-editorial-text/55">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(order.created_at)}
                            </span>
                            <span className="font-medium text-editorial-text/75">{formatCurrency(order.total_amount)}</span>
                            <span>{order.items?.length ?? 0} sản phẩm</span>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 text-editorial-text/40 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>

                      {/* Order detail */}
                      {isExpanded && (
                        <div className="border-t border-stone-900/10 px-5 pb-5">
                          {/* Items */}
                          <div className="mt-4 space-y-3">
                            {(order.items ?? []).map((item) => (
                              <div key={item.id} className="flex items-center gap-4">
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-stone-900/10 bg-stone-100">
                                  {item.product_image_url ? (
                                    <img src={item.product_image_url} alt={item.product_name} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-editorial-text/25">
                                      <Box className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-editorial-text truncate">{item.product_name}</p>
                                  <p className="text-xs text-editorial-text/50">SKU: {item.product_sku}</p>
                                </div>
                                <div className="text-right text-sm">
                                  <p className="font-medium text-editorial-text">{formatCurrency(item.line_total)}</p>
                                  <p className="text-xs text-editorial-text/50">x{item.quantity} × {formatCurrency(item.unit_price)}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Shipping + totals */}
                          <div className="mt-4 grid gap-3 border-t border-stone-900/10 pt-4 sm:grid-cols-2">
                            <div className="space-y-2 text-sm">
                              <p className="text-xs font-semibold uppercase tracking-widest text-editorial-text/45">Địa chỉ giao hàng</p>
                              <div className="flex items-start gap-2 text-editorial-text/70">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                                <span>{order.shipping_address || "—"}</span>
                              </div>
                              {order.tracking_code && (
                                <div className="flex items-center gap-2 text-editorial-text/70">
                                  <Truck className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                                  <span>Mã vận đơn: <span className="font-semibold text-editorial-text">{order.tracking_code}</span></span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between text-editorial-text/60">
                                <span>Tạm tính</span>
                                <span>{formatCurrency(order.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-editorial-text/60">
                                <span>Phí vận chuyển</span>
                                <span>{parseFloat(order.shipping_fee) === 0 ? "Miễn phí" : formatCurrency(order.shipping_fee)}</span>
                              </div>
                              <div className="flex justify-between border-t border-stone-900/10 pt-1.5 font-semibold text-editorial-text">
                                <span>Tổng cộng</span>
                                <span>{formatCurrency(order.total_amount)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
