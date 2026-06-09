import React, { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock, ShoppingBag, Trash2, X } from "lucide-react";
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
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "processing" | "success">("cart");
  const [address, setAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? item.product.price * item.quantity), 0);
  const shipping = subtotal > 500 ? 0 : 25;
  const total = subtotal + shipping;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !address) return;

    setCheckoutError(null);
    setCheckoutStep("processing");
    try {
      const result = await onCheckout(`${fullName} — ${address}`);
      setOrderReference(result.id);
      setCheckoutStep("success");
    } catch (error: any) {
      setCheckoutError(error?.message || "Checkout failed.");
      setCheckoutStep("cart");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 p-0 md:p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden rounded-none border-l border-white/10 bg-[linear-gradient(180deg,rgba(8,13,27,0.96),rgba(6,9,20,0.96))] shadow-[0_30px_100px_rgba(2,6,23,0.75)] md:h-[95vh] md:rounded-[32px] md:border">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/45">Basket</p>
            <h2 className="mt-1 text-xl font-semibold text-editorial-text">Secure checkout</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-editorial-text/60 transition hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-editorial-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {checkoutStep === "cart" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_0_40px_rgba(76,130,255,0.08)]">
                  <ShoppingBag className="h-8 w-8 text-editorial-text/35" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-editorial-text">Your basket is empty</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-editorial-text/55">Add products from the premium catalog to see shipping, totals, and AI-guided checkout in one place.</p>
                <button onClick={onClose} className="mt-6 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/30 hover:bg-cyan-400/10">
                  Continue shopping
                </button>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                  {items.map((item) => (
                    <div key={item.id || item.product.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/40">
                          <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">{item.product.category}</p>
                              <h4 className="mt-1 text-sm font-semibold text-editorial-text">{item.product.name}</h4>
                              <p className="mt-2 text-base font-semibold text-editorial-text">${item.product.price}</p>
                            </div>
                            <button onClick={() => onRemoveItem(item)} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-editorial-text/50 transition hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-200">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-4 flex items-center gap-2">
                            <button onClick={() => onUpdateQuantity(item, -1)} disabled={item.quantity <= 1} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/45 text-sm text-editorial-text transition hover:border-cyan-400/25 disabled:opacity-40">-</button>
                            <span className="min-w-8 text-center text-sm font-semibold text-editorial-text">{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(item, 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/45 text-sm text-editorial-text transition hover:border-cyan-400/25">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 bg-slate-950/35 p-6">
                  {requiresSignIn && (
                    <div className="mb-4 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      <p>Sign in with a customer account to synchronize items with backend checkout.</p>
                    </div>
                  )}

                  {checkoutError && <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{checkoutError}</div>}

                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="space-y-3 text-sm text-editorial-text/68">
                      <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold text-editorial-text">${subtotal.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Shipping</span><span className="font-semibold text-editorial-text">{shipping === 0 ? "Free" : `$${shipping}`}</span></div>
                      <div className="flex justify-between border-t border-white/10 pt-3 text-base"><span className="font-semibold text-editorial-text">Total</span><span className="font-semibold text-editorial-text">${total.toFixed(2)}</span></div>
                    </div>
                  </div>

                  <form onSubmit={handleCheckoutSubmit} className="mt-4 space-y-3">
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-cyan-400/25" />
                    <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shipping address" className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-editorial-text outline-none placeholder:text-editorial-text/28 focus:border-cyan-400/25" />

                    <div className="grid grid-cols-[auto_1fr] gap-3">
                      <button type="button" onClick={() => onClearCart()} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/25 hover:bg-cyan-400/10">
                        Clear
                      </button>
                      <button type="submit" disabled={requiresSignIn} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
                        Checkout
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-editorial-text/38">
                    <Lock className="h-3.5 w-3.5" />
                    256-bit secure payment flow
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {checkoutStep === "processing" && (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-300" />
            <h3 className="mt-5 text-xl font-semibold text-editorial-text">Processing secure order</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-editorial-text/55">Validating cart items, submitting payment, and pushing your order to the backend workflow.</p>
          </div>
        )}

        {checkoutStep === "success" && (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold text-editorial-text">Order confirmed</h3>
            <p className="mt-2 text-sm text-editorial-text/55">Reference: {orderReference}</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-editorial-text/58">Payment and shipping orchestration completed successfully. Your order is now registered in the backend system.</p>
            <button onClick={() => { setCheckoutStep("cart"); setAddress(""); setFullName(""); onClose(); }} className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
              Resume shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
