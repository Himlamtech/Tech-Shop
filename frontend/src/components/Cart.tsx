import React, { useState } from "react";
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, CheckCircle2, ChevronRight, Lock, Loader2 } from "lucide-react";
import { CartItem } from "../types";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClose: () => void;
  onClearCart: () => void;
}

export default function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClose,
  onClearCart
}: CartProps) {
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "processing" | "success">("cart");
  const [address, setAddress] = useState("");
  const [fullName, setFullName] = useState("");

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal > 500 ? 0 : 25;
  const total = subtotal + shipping;

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !address) return;

    setCheckoutStep("processing");

    // Secure procedural checkout latency
    setTimeout(() => {
      setCheckoutStep("success");
      onClearCart();
    }, 2800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-editorial-text/45 backdrop-blur-sm p-0 sm:p-4">
      {/* Dimmed backdrop closes frame on tap */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Main Drawer Container */}
      <div className="w-full max-w-md h-full md:h-[95vh] rounded-none md:rounded-l-3xl bg-editorial-bg border border-editorial-text/20 flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header Bar */}
        <div className="px-6 py-5 border-b border-editorial-text/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4.5 h-4.5 text-editorial-text shrink-0" />
            <h2 className="serif text-lg font-bold text-editorial-text">Shopping Basket</h2>
          </div>

          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-editorial-accent/35 border border-editorial-text/15 text-editorial-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Box with Steps */}
        {checkoutStep === "cart" && (
          <div className="flex-grow flex flex-col overflow-hidden">
            
            {/* Basket Items List */}
            {items.length === 0 ? (
              <div className="flex-grow flex flex-col justify-center items-center p-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-editorial-paper flex items-center justify-center border border-editorial-text/15">
                  <ShoppingBag className="w-6 h-6 text-editorial-text/40" />
                </div>
                <div className="space-y-1">
                  <p className="serif text-base font-bold text-editorial-text">Your basket is empty</p>
                  <p className="text-xs text-editorial-text/60 max-w-[240px] leading-relaxed">Explore our catalog of futuristic devices and begin configuring items today.</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-[10px] uppercase tracking-wider font-bold bg-editorial-text text-editorial-bg rounded-full px-5 py-3 border border-editorial-text hover:bg-transparent hover:text-editorial-text transition-colors duration-250 cursor-pointer"
                >
                  Retrieve Catalog
                </button>
              </div>
            ) : (
              <div className="flex-grow overflow-y-auto p-6 space-y-4">
                {items.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex gap-4 p-4 rounded-xl bg-editorial-paper border border-editorial-text/10 hover:border-editorial-text/25 transition-all duration-200 animate-in fade-in"
                  >
                    {/* Visual */}
                    <div className="w-16 h-16 rounded-lg border border-editorial-text/15 overflow-hidden shrink-0 bg-editorial-bg">
                      <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover opacity-95" />
                    </div>

                    {/* Metadata descriptors */}
                    <div className="flex-grow min-w-0">
                      <p className="text-[8px] font-bold text-editorial-text/50 uppercase tracking-widest font-mono">
                        {item.product.category}
                      </p>
                      <h4 className="serif text-xs font-bold text-editorial-text truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-xs font-bold text-editorial-text font-mono mt-1">
                        ${item.product.price}
                      </p>

                      {/* Quantity Increments */}
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, -1)}
                          disabled={item.quantity <= 1}
                          className="w-6 h-6 rounded-full bg-editorial-bg hover:bg-editorial-accent border border-editorial-text/15 text-xs font-mono flex items-center justify-center text-editorial-text cursor-pointer disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="text-xs font-semibold text-editorial-text font-mono px-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded-full bg-editorial-bg hover:bg-editorial-accent border border-editorial-text/15 text-xs font-mono flex items-center justify-center text-editorial-text cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Trash Delete Frame */}
                    <button
                      onClick={() => onRemoveItem(item.product.id)}
                      className="h-8 w-8 text-editorial-text/50 hover:text-red-850 rounded-full hover:bg-editorial-accent/30 border border-transparent hover:border-editorial-text/10 flex items-center justify-center shrink-0 self-center transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Subtotal Checkouts Block at footer */}
            {items.length > 0 && (
              <div className="bg-editorial-accent/35 border-t border-editorial-text/15 p-6 space-y-6">
                
                {/* Secure Shipping calculation ledger */}
                <div className="space-y-2 text-xs text-editorial-text leading-none font-sans">
                  <div className="flex justify-between">
                    <span className="opacity-70">Subtotal</span>
                    <span className="font-semibold font-mono">${subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Priority Shipping</span>
                    <span className="font-semibold font-mono">
                      {shipping === 0 ? "FREE" : `$${shipping}`}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-editorial-text/15 pt-3 text-sm">
                    <span className="serif font-bold">Basket Total</span>
                    <span className="serif font-bold text-base">${total}</span>
                  </div>
                </div>

                {/* Shipping Input fields */}
                <form onSubmit={handleCheckoutSubmit} className="space-y-3 font-sans">
                  <div className="space-y-1">
                    <label className="text-[9px] text-editorial-text/60 font-bold uppercase tracking-wider font-mono">Consignee Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full text-xs bg-editorial-paper border border-editorial-text/15 hover:border-editorial-text/30 focus:border-editorial-text focus:outline-none rounded-xl px-4 py-2.5 transition-colors text-editorial-text"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-editorial-text/60 font-bold uppercase tracking-wider font-mono">Delivery Coordinates</label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 123 Editorial Boulevard, Suite 40"
                      className="w-full text-xs bg-editorial-paper border border-editorial-text/15 hover:border-editorial-text/30 focus:border-editorial-text focus:outline-none rounded-xl px-4 py-2.5 transition-colors text-editorial-text"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-editorial-text hover:bg-editorial-text/90 text-editorial-bg font-bold text-[10px] py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 tracking-widest font-mono uppercase shadow-none transition-colors duration-250 cursor-pointer"
                  >
                    <span>Transmit Secure Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="flex items-center justify-center gap-1.5 text-[8px] text-editorial-text/45 uppercase font-mono tracking-widest font-normal">
                  <Lock className="w-3 h-3 opacity-60" />
                  <span>Integrated 256-Bit SSL protection</span>
                </div>
              </div>
            )}

          </div>
        )}

        {/* PROCESSING LOADER STEP */}
        {checkoutStep === "processing" && (
          <div className="flex-grow flex flex-col justify-center items-center p-8 space-y-4 text-center animate-in fade-in">
            <Loader2 className="w-10 h-10 text-editorial-text animate-spin opacity-80" />
            <div className="space-y-1">
              <h3 className="serif text-base font-bold text-editorial-text uppercase tracking-widest">Contacting Banking Gateway</h3>
              <p className="text-xs text-editorial-text/60 max-w-[260px] leading-relaxed">
                Authorizing payment security, registering delivery details, and submitting elements configuration...
              </p>
            </div>
          </div>
        )}

        {/* ORDER SUCCESS STEP */}
        {checkoutStep === "success" && (
          <div className="flex-grow flex flex-col justify-center items-center p-10 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-none bg-editorial-accent/30 text-editorial-text border border-editorial-text/15">
              <CheckCircle2 className="w-8 h-8 opacity-90" />
            </div>

            <div className="space-y-2">
              <h3 className="serif text-xl font-bold text-editorial-text">Commission Confirmed</h3>
              <p className="text-xs text-editorial-text/60 font-mono">Order Reference: #AE-{Math.floor(100000 + Math.random() * 900000)}</p>
              <p className="text-xs text-editorial-text/75 max-w-[280px] leading-relaxed">
                Payment has been verified successfully. Your premium hardware is currently scheduled, packed with precision calibration, and dispatched!
              </p>
            </div>

            <button
              onClick={() => {
                setCheckoutStep("cart");
                setAddress("");
                setFullName("");
                onClose();
              }}
              className="text-[10px] uppercase tracking-widest font-bold bg-editorial-text text-editorial-bg border border-editorial-text py-3 px-6 rounded-none hover:bg-transparent hover:text-editorial-text transition-colors duration-250 cursor-pointer"
            >
              Resume Shopping
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
