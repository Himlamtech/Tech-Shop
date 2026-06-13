import React, { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock, MapPin, Phone, ShoppingBag, Trash2, User, X } from "lucide-react";
import { CartItem } from "../types";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (item: CartItem, delta: number) => Promise<void> | void;
  onRemoveItem: (item: CartItem) => Promise<void> | void;
  onClose: () => void;
  onClearCart: () => Promise<void> | void;
  onCheckout: (shippingAddress: string) => Promise<{ id: string; status: string; total_amount: string }>;
  requiresSignIn: boolean;
}

export default function Cart({ items, onUpdateQuantity, onRemoveItem, onClose, onClearCart, onCheckout, requiresSignIn }: CartProps) {
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "shipping" | "processing" | "success">("cart");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card" | "wallet">("cod");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? item.product.price * item.quantity), 0);
  const shipping = subtotal > 2000000 ? 0 : 30000;
  const total = subtotal + shipping;

  const formatVND = (v: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);

  const fullAddress = [streetAddress, ward, district, province].filter(Boolean).join(", ");

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !fullAddress) return;

    setCheckoutError(null);
    setCheckoutStep("processing");
    try {
      const result = await onCheckout(`${fullName} | ${phone} | ${fullAddress}`);
      setOrderReference(result.id);
      setCheckoutStep("success");
    } catch (error: any) {
      setCheckoutError(error?.message || "Checkout failed.");
      setCheckoutStep("shipping");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/28 p-0 md:p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-none border border-stone-900/10 bg-[linear-gradient(180deg,rgba(255,250,240,0.96),rgba(248,243,232,0.96))] shadow-[0_30px_100px_rgba(112,82,48,0.75)] md:h-[92vh] md:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-stone-900/10 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/45">Basket</p>
            <h2 className="mt-1 text-xl font-semibold text-editorial-text">Secure checkout</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/60 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {checkoutStep === "cart" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-stone-900/10 bg-white/65 shadow-[0_0_40px_rgba(185,135,70,0.08)]">
                  <ShoppingBag className="h-8 w-8 text-editorial-text/35" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-editorial-text">Your basket is empty</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-editorial-text/55">Add products from the premium catalog to see shipping, totals, and AI-guided checkout in one place.</p>
                <button onClick={onClose} className="mt-6 rounded-full border border-stone-900/10 bg-white/70 px-5 py-3 text-sm font-semibold text-editorial-text transition hover:border-amber-700/30 hover:bg-amber-700/10">
                  Continue shopping
                </button>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                  {items.map((item) => (
                    <div key={item.id || item.product.id} className="rounded-[24px] border border-stone-900/10 bg-white/65 p-4">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-[20px] border border-stone-900/10 bg-stone-100/70">
                          <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">{item.product.category}</p>
                              <h4 className="mt-1 text-sm font-semibold text-editorial-text">{item.product.name}</h4>
                              <p className="mt-2 text-base font-semibold text-editorial-text">${item.product.price}</p>
                            </div>
                            <button onClick={() => onRemoveItem(item)} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/50 transition hover:border-red-700/25 hover:bg-red-700/10 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-4 flex items-center gap-2">
                            <button onClick={() => onUpdateQuantity(item, -1)} disabled={item.quantity <= 1} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-900/10 bg-stone-100/80 text-sm text-editorial-text transition hover:border-amber-700/25 disabled:opacity-40">-</button>
                            <span className="min-w-8 text-center text-sm font-semibold text-editorial-text">{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(item, 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-900/10 bg-stone-100/80 text-sm text-editorial-text transition hover:border-amber-700/25">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-stone-900/10 bg-stone-100/65 p-6">
                  {requiresSignIn && (
                    <div className="mb-4 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      <p>Sign in with a customer account to synchronize items with backend checkout.</p>
                    </div>
                  )}

                  {checkoutError && <div className="mb-4 rounded-2xl border border-red-700/20 bg-red-700/10 px-4 py-3 text-sm text-red-800">{checkoutError}</div>}

                  <div className="rounded-[24px] border border-stone-900/10 bg-white/65 p-4">
                    <div className="space-y-3 text-sm text-editorial-text/68">
                      <div className="flex justify-between"><span>Tạm tính</span><span className="font-semibold text-editorial-text">{formatVND(subtotal)}</span></div>
                      <div className="flex justify-between"><span>Phí vận chuyển</span><span className="font-semibold text-editorial-text">{shipping === 0 ? "Miễn phí" : formatVND(shipping)}</span></div>
                      <div className="flex justify-between border-t border-stone-900/10 pt-3 text-base"><span className="font-semibold text-editorial-text">Tổng cộng</span><span className="font-semibold text-editorial-text">{formatVND(total)}</span></div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
                    <button type="button" onClick={() => onClearCart()} className="rounded-2xl border border-stone-900/10 bg-white/65 px-4 py-3 text-sm font-semibold text-editorial-text transition hover:border-amber-700/25 hover:bg-amber-700/10">
                      Xóa
                    </button>
                    <button
                      type="button"
                      disabled={requiresSignIn || items.length === 0}
                      onClick={() => setCheckoutStep("shipping")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Đặt hàng
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-editorial-text/38">
                    <Lock className="h-3.5 w-3.5" />
                    Thanh toán bảo mật 256-bit
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {checkoutStep === "shipping" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-stone-900/10 px-6 py-3 text-sm text-editorial-text/60">
              <button onClick={() => setCheckoutStep("cart")} className="flex items-center gap-1 text-amber-800 hover:underline">
                ← Giỏ hàng
              </button>
              <span>/</span>
              <span className="font-medium text-editorial-text">Thông tin giao hàng</span>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-5 p-6">
                {/* Order summary mini */}
                <div className="rounded-2xl border border-stone-900/10 bg-white/65 p-4">
                  <p className="text-[11px] uppercase tracking-widest text-editorial-text/45">Đơn hàng ({items.length} sản phẩm)</p>
                  <div className="mt-3 space-y-2">
                    {items.map((item) => (
                      <div key={item.id || item.product.id} className="flex items-center gap-3 text-sm">
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-stone-900/10 bg-stone-100">
                          <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                        </div>
                        <span className="flex-1 truncate text-editorial-text/75">{item.product.name} ×{item.quantity}</span>
                        <span className="font-medium text-editorial-text">{formatVND(item.product.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-stone-900/10 pt-3 text-sm font-semibold text-editorial-text">
                    <span>Tổng cộng</span>
                    <span>{formatVND(total)}</span>
                  </div>
                </div>

                {/* Recipient info */}
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-editorial-text/50">
                    <User className="h-3.5 w-3.5" /> Người nhận
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Họ và tên *"
                      className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25"
                    />
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-editorial-text/35" />
                      <input
                        required
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Số điện thoại *"
                        className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 pl-11 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-editorial-text/50">
                    <MapPin className="h-3.5 w-3.5" /> Địa chỉ giao hàng
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      required
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Tỉnh / Thành phố *"
                      className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25"
                    />
                    <input
                      required
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Quận / Huyện *"
                      className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25"
                    />
                    <input
                      required
                      type="text"
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                      placeholder="Phường / Xã *"
                      className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-editorial-text/35" />
                    <input
                      required
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="Số nhà, tên đường *"
                      className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3 pl-11 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-amber-700/25"
                    />
                  </div>
                </div>

                {/* Payment method */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-editorial-text/50">Phương thức thanh toán</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      { key: "cod", label: "Tiền mặt (COD)", sub: "Thanh toán khi nhận hàng" },
                      { key: "card", label: "Thẻ ngân hàng", sub: "Visa / Mastercard / JCB" },
                      { key: "wallet", label: "Ví điện tử", sub: "MoMo, ZaloPay, VNPay" },
                    ] as const).map(({ key, label, sub }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPaymentMethod(key)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          paymentMethod === key
                            ? "border-amber-700/30 bg-amber-700/10"
                            : "border-stone-900/10 bg-stone-100/80 hover:border-amber-700/20"
                        }`}
                      >
                        <p className={`text-sm font-semibold ${paymentMethod === key ? "text-amber-900" : "text-editorial-text"}`}>{label}</p>
                        <p className="mt-0.5 text-xs text-editorial-text/50">{sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shipping fee note */}
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-editorial-text/60">
                  {shipping === 0
                    ? "🎉 Miễn phí vận chuyển cho đơn hàng trên 2.000.000đ"
                    : `Phí vận chuyển: ${formatVND(shipping)} — Miễn phí cho đơn trên 2.000.000đ`}
                </div>

                {checkoutError && (
                  <div className="rounded-2xl border border-red-700/20 bg-red-700/10 px-4 py-3 text-sm text-red-800">
                    {checkoutError}
                  </div>
                )}
              </div>

              <div className="border-t border-stone-900/10 p-6">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#a8783f,#b98746)] px-5 py-4 text-sm font-semibold text-stone-950 transition hover:brightness-110"
                >
                  <Lock className="h-4 w-4" />
                  Xác nhận đặt hàng — {formatVND(total)}
                </button>
                <p className="mt-3 text-center text-[11px] text-editorial-text/38">
                  Nhấn xác nhận đồng nghĩa với việc bạn chấp nhận điều khoản mua hàng của Lamania
                </p>
              </div>
            </form>
          </div>
        )}

        {checkoutStep === "processing" && (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-amber-700" />
            <h3 className="mt-5 text-xl font-semibold text-editorial-text">Đang xử lý đơn hàng</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-editorial-text/55">Đang xác thực giỏ hàng, gửi thanh toán và đăng ký đơn hàng vào hệ thống...</p>
          </div>
        )}

        {checkoutStep === "success" && (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-700/20 bg-emerald-700/10 text-emerald-800">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold text-editorial-text">Đặt hàng thành công!</h3>
            <p className="mt-2 text-xs text-editorial-text/45">Mã đơn hàng: <span className="font-semibold text-editorial-text">{orderReference?.slice(0,8).toUpperCase()}</span></p>
            <div className="mt-4 rounded-2xl border border-stone-900/10 bg-stone-50 px-5 py-4 text-left text-sm text-editorial-text/70 w-full max-w-xs space-y-1.5">
              <p><span className="font-medium text-editorial-text">Người nhận:</span> {fullName}</p>
              {phone && <p><span className="font-medium text-editorial-text">SĐT:</span> {phone}</p>}
              <p><span className="font-medium text-editorial-text">Địa chỉ:</span> {fullAddress || "—"}</p>
              <p><span className="font-medium text-editorial-text">Thanh toán:</span> {paymentMethod === "cod" ? "Tiền mặt (COD)" : paymentMethod === "card" ? "Thẻ ngân hàng" : "Ví điện tử"}</p>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-editorial-text/55">Đơn hàng đã được ghi nhận. Bạn có thể theo dõi trạng thái trong mục Tài khoản.</p>
            <button onClick={() => { setCheckoutStep("cart"); setFullName(""); setPhone(""); setProvince(""); setDistrict(""); setWard(""); setStreetAddress(""); onClose(); }} className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-100">
              Tiếp tục mua sắm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
