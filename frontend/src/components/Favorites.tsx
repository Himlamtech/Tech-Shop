import React from "react";
import { Heart, ShoppingBag, Trash2, X } from "lucide-react";
import { Product } from "../types";

interface FavoritesProps {
  items: Product[];
  onRemoveFavorite: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onClose: () => void;
}

export default function Favorites({ items, onRemoveFavorite, onAddToCart, onClose }: FavoritesProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 p-0 md:p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden rounded-none border-l border-white/10 bg-[linear-gradient(180deg,rgba(8,13,27,0.96),rgba(6,9,20,0.96))] shadow-[0_30px_100px_rgba(2,6,23,0.75)] md:h-[95vh] md:rounded-[32px] md:border">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/45">Saved list</p>
            <h2 className="mt-1 text-xl font-semibold text-editorial-text">Favorites</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-editorial-text/60 transition hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-editorial-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03]">
                <Heart className="h-8 w-8 text-editorial-text/30" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-editorial-text">No saved products yet</h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-editorial-text/55">Save standout devices here while you compare, research, or build a future cart.</p>
              <button onClick={onClose} className="mt-6 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/30 hover:bg-cyan-400/10">
                Browse products
              </button>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                {items.map((product) => (
                  <div key={product.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex gap-4">
                      <div className="h-20 w-20 overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/40">
                        <img src={product.image} alt={product.name} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/45">{product.category}</p>
                        <h4 className="mt-1 text-sm font-semibold text-editorial-text">{product.name}</h4>
                        <p className="mt-1 text-base font-semibold text-editorial-text">${product.price}</p>
                        <button onClick={() => onAddToCart(product)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
                          <ShoppingBag className="h-4 w-4" />
                          Add to cart
                        </button>
                      </div>
                      <button onClick={() => onRemoveFavorite(product)} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-editorial-text/50 transition hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-200" title="Remove from favorites">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 bg-slate-950/35 px-6 py-4 text-center text-[11px] uppercase tracking-[0.18em] text-editorial-text/38">
                {items.length} saved product{items.length > 1 ? "s" : ""} ready for compare or checkout
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
