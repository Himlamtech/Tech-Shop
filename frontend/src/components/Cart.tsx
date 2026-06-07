import React, { useState } from "react";
import { X, Trash2, ShoppingBag, ArrowRight, CheckCircle2, Lock, Loader2, Truck, BadgePercent, CreditCard } from "lucide-react";
import { CartItem } from "../types";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClose: () => void;
  onClearCart: () => void;
}

export default function Cart({ items, onUpdateQuantity, onRemoveItem, onClose, onClearCart }: CartProps) {
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "processing" | "success">("cart");
  const [address, setAddress] = useState("");
  const [fullName, setFullName] = useState("");

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal > 500 ? 0 : 25;
  const discount = subtotal > 1200 ? 50 : 0;
  const total = subtotal + shipping - discount;

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !address) return;
    setCheckoutStep("processing");
    setTimeout(() => {
      setCheckoutStep("success");
      onClearCart();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/50 p-0 sm:p-4 backdrop-blur-sm">
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-white/60 bg-editorial-bg shadow-[0_30px_80px_rgba(15,23,42,0.22)] md:h-[95vh] md:rounded-[32px] md:border md:border-white/70">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-6 py-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-editorial-dark">Gio hang cua ban</h2>
              <p className="text-sm text-editorial-text/55">Tom tat don hang, thong tin nhan hang va thanh toan mo phong</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-editorial-text transition hover:bg-editorial-dark hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {checkoutStep === "cart" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                  <ShoppingBag className="h-8 w-8 text-editorial-text/28" />
                </div>
                <h3 className="serif mt-6 text-2xl font-bold text-editorial-dark">Gio hang dang trong</h3>
                <p className="mt-2 max-w-sm text-sm leading-7 text-editorial-text/60">Hay chon san pham noi bat, them vao gio va tiep tuc demo luong mua sam tren frontend.</p>
                <button onClick={onClose} className="mt-6 rounded-full bg-editorial-dark px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">Tiep tuc mua sam</button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6 space-y-4">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-4 rounded-[28px] border border-white/70 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[22px] bg-slate-100">
                        <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-editorial-text/45">{item.product.category}</p>
                            <h4 className="mt-1 text-base font-bold text-editorial-dark line-clamp-1">{item.product.name}</h4>
                            <p className="mt-1 text-sm text-editorial-text/58 line-clamp-1">{item.product.features[0]}</p>
                          </div>
                          <button onClick={() => onRemoveItem(item.product.id)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-editorial-text/55 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-sm text-editorial-text/45">Don gia</p>
                            <p className="text-lg font-bold text-editorial-dark">${item.product.price}</p>
                          </div>
                          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2">
                            <button onClick={() => onUpdateQuantity(item.product.id, -1)} disabled={item.quantity <= 1} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-editorial-dark shadow-sm disabled:opacity-40">-</button>
                            <span className="w-8 text-center text-sm font-semibold text-editorial-dark">{item.quantity}</span>
                            <button onClick={() => onUpdateQuantity(item.product.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-editorial-dark shadow-sm">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/70 bg-white/88 px-5 py-5 backdrop-blur md:px-6 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: Truck, title: "Van chuyen", text: shipping === 0 ? "Mien phi giao hang" : `Phi giao hang $${shipping}` },
                      { icon: BadgePercent, title: "Uu dai", text: discount > 0 ? `Da giam $${discount}` : "Chua co khuyen mai" },
                      { icon: CreditCard, title: "Thanh toan", text: "Mo phong checkout nhanh" }
                    ].map((item) => (
                      <div key={item.title} className="rounded-[22px] bg-slate-50 p-4">
                        <item.icon className="h-4 w-4 text-blue-600" />
                        <p className="mt-2 text-sm font-bold text-editorial-dark">{item.title}</p>
                        <p className="mt-1 text-xs text-editorial-text/55">{item.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[26px] bg-slate-50 p-5 space-y-3 text-sm">
                    <div className="flex justify-between text-editorial-text/60"><span>Tam tinh</span><span>${subtotal}</span></div>
                    <div className="flex justify-between text-editorial-text/60"><span>Phi giao hang</span><span>{shipping === 0 ? "Free" : `$${shipping}`}</span></div>
                    <div className="flex justify-between text-editorial-text/60"><span>Giam gia</span><span>{discount > 0 ? `-$${discount}` : "$0"}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-editorial-dark"><span>Tong cong</span><span>${total}</span></div>
                  </div>

                  <form onSubmit={handleCheckoutSubmit} className="grid gap-3">
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ho va ten nguoi nhan" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white" />
                    <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dia chi giao hang" className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white" />
                    <button type="submit" className="flex items-center justify-center gap-2 rounded-[20px] bg-editorial-dark px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-600">
                      <span>Tien hanh dat hang</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  <div className="flex items-center justify-center gap-2 text-xs text-editorial-text/45">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Thong tin thanh toan chi la mo phong cho demo giao dien</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {checkoutStep === "processing" && (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <h3 className="serif mt-6 text-2xl font-bold text-editorial-dark">Dang xu ly don hang</h3>
            <p className="mt-2 max-w-sm text-sm leading-7 text-editorial-text/60">He thong dang xac nhan thong tin nguoi nhan, mo phong thanh toan va tao ma don hang.</p>
          </div>
        )}

        {checkoutStep === "success" && (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="serif mt-6 text-2xl font-bold text-editorial-dark">Dat hang thanh cong</h3>
            <p className="mt-2 text-sm text-editorial-text/55">Ma don tham khao: #TS-{Math.floor(100000 + Math.random() * 900000)}</p>
            <p className="mt-3 max-w-sm text-sm leading-7 text-editorial-text/62">Frontend da mo phong thanh toan thanh cong va don hang da san sang cho luong theo doi tiep theo.</p>
            <button
              onClick={() => {
                setCheckoutStep("cart");
                setAddress("");
                setFullName("");
                onClose();
              }}
              className="mt-6 rounded-full bg-editorial-dark px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Tiep tuc mua sam
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
