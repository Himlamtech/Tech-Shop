import React from "react";
import { Heart, ShoppingBag, X } from "lucide-react";
import { Product } from "../types";

interface FavoritesProps {
  items: Product[];
  onRemoveFavorite: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onClose: () => void;
}

export default function Favorites({ items, onRemoveFavorite, onAddToCart, onClose }: FavoritesProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col border-l border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-rose-600">Wishlist</p>
            <h2 className="serif mt-1 text-2xl font-extrabold text-editorial-dark">{items.length} san pham yeu thich</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-editorial-text/60 transition hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Heart className="h-10 w-10 text-editorial-text/25" />
            <h3 className="mt-4 text-xl font-bold text-editorial-dark">Chua co san pham nao duoc luu</h3>
            <p className="mt-2 text-sm leading-6 text-editorial-text/60">Nhan tim tren card san pham de tao shortlist nhanh cho buoi demo.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {items.map((product) => (
              <div key={product.id} className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex gap-4">
                  <img src={product.image} alt={product.name} className="h-20 w-20 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-editorial-text/45">{product.category}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold text-editorial-dark">{product.name}</p>
                    <p className="mt-2 text-sm text-blue-700">${product.price.toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button onClick={() => onAddToCart(product)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-editorial-dark px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">
                    <ShoppingBag className="h-4 w-4" />
                    Them vao gio
                  </button>
                  <button onClick={() => onRemoveFavorite(product)} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">
                    Bo luu
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
