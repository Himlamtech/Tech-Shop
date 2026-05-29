import React from "react";
import { X, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Product } from "../types";

interface FavoritesProps {
  items: Product[];
  onRemoveFavorite: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onClose: () => void;
}

export default function Favorites({
  items,
  onRemoveFavorite,
  onAddToCart,
  onClose,
}: FavoritesProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-editorial-text/45 backdrop-blur-sm p-0 sm:p-4">
      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Main Drawer Shell with soft corners */}
      <div className="w-full max-w-md h-full md:h-[95vh] rounded-none md:rounded-2xl bg-editorial-bg border border-editorial-text/20 flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header Block with rounded button */}
        <div className="px-6 py-5 border-b border-editorial-text/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4.5 h-4.5 text-red-500 fill-red-500 shrink-0" />
            <h2 className="serif text-lg font-bold text-editorial-text">My Wishlist</h2>
          </div>

          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-editorial-accent/35 border border-editorial-text/15 text-editorial-text transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-grow flex flex-col overflow-hidden">
          {items.length === 0 ? (
            <div className="flex-grow flex flex-col justify-center items-center p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-editorial-paper flex items-center justify-center border border-editorial-text/15">
                <Heart className="w-6 h-6 text-editorial-text/30" />
              </div>
              <div className="space-y-1">
                <p className="serif text-base font-bold text-editorial-text">Wishlist is empty</p>
                <p className="text-xs text-editorial-text/60 max-w-[240px] leading-relaxed">
                  Save your favorite futuristic gadgets here to compare or order them later.
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-[10px] uppercase tracking-wider font-bold bg-editorial-text text-editorial-bg rounded-full px-5 py-3 border border-editorial-text hover:bg-transparent hover:text-editorial-text transition-colors duration-250 cursor-pointer"
              >
                Explore Catalog
              </button>
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {items.map((product) => (
                <div
                  key={product.id}
                  className="flex gap-4 p-4 rounded-xl bg-editorial-paper border border-editorial-text/10 hover:border-editorial-text/25 transition-all duration-200 animate-in fade-in"
                >
                  {/* Image thumbnail preview with soft corners */}
                  <div className="w-16 h-16 rounded-lg border border-editorial-text/15 overflow-hidden shrink-0 bg-editorial-bg">
                    <img
                      src={product.image}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-95"
                    />
                  </div>

                  {/* Context block */}
                  <div className="flex-grow min-w-0">
                    <p className="text-[8px] font-bold text-editorial-text/50 uppercase tracking-widest font-mono">
                      {product.category}
                    </p>
                    <h4 className="serif text-xs font-bold text-editorial-text truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs font-bold text-editorial-text font-mono mt-0.5">
                      ${product.price}
                    </p>

                    {/* Action buttons inside item card */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          onAddToCart(product);
                          // Optionally keep or close
                        }}
                        className="flex items-center gap-1 bg-editorial-text hover:bg-editorial-text/90 text-editorial-bg font-semibold text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>Add To Basket</span>
                      </button>
                    </div>
                  </div>

                  {/* Remove buttons with soft circle outline */}
                  <button
                    onClick={() => onRemoveFavorite(product)}
                    className="h-8 w-8 text-red-550 hover:text-red-650 hover:bg-red-50 hover:border-red-200 border border-transparent rounded-full flex items-center justify-center shrink-0 self-center transition-all cursor-pointer"
                    title="Remove from favorites list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info message */}
        {items.length > 0 && (
          <div className="bg-editorial-accent/25 border-t border-editorial-text/15 p-5 text-center text-[9px] text-editorial-text/50 font-mono tracking-wider max-w-sm mx-auto">
            YOU HAVE saved {items.length} CURATED DESIGNS FOR CONVENIENT COMPILATION.
          </div>
        )}

      </div>
    </div>
  );
}
