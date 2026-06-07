import React from "react";
import { Star, Scale, Sparkles, ShoppingCart, Heart } from "lucide-react";
import { Product } from "../types";

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  isCompared: boolean;
  onToggleCompare: (product: Product) => void;
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
  key?: string | number | any;
}

export default function ProductCard({
  product,
  onViewDetails,
  onAddToCart,
  isCompared,
  onToggleCompare,
  isFavorite,
  onToggleFavorite
}: ProductCardProps) {
  return (
    <div
      id={`product-card-${product.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/92 shadow-[0_18px_55px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_65px_rgba(37,99,235,0.14)]"
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-100 via-white to-violet-100 opacity-70" />

      <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between">
        <span className="flex items-center gap-1 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[10px] font-semibold text-blue-700 shadow-sm backdrop-blur">
          <Sparkles className="w-3 h-3" />
          {product.tag}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 text-editorial-text shadow-sm transition-all duration-200 hover:bg-rose-50"
          title={isFavorite ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-editorial-text/70"}`} />
        </button>
      </div>

      <div
        onClick={() => onViewDetails(product)}
        className="relative cursor-pointer overflow-hidden px-5 pt-16"
      >
        <div className="relative rounded-[24px] bg-gradient-to-br from-slate-100 via-white to-sky-50 pt-[72%] shadow-inner">
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-grow flex-col p-5 md:p-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-editorial-text/70">
            {product.category}
          </span>
          <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{product.rating}</span>
            <span className="text-editorial-text/45">({product.reviewsCount})</span>
          </div>
        </div>

        <h3
          onClick={() => onViewDetails(product)}
          className="serif mb-2 cursor-pointer text-xl font-bold tracking-tight text-editorial-dark transition-colors hover:text-blue-700"
        >
          {product.name}
        </h3>

        <p className="mb-4 line-clamp-2 text-sm leading-6 text-editorial-text/65">
          {product.description}
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {product.features.slice(0, 2).map((feature, idx) => (
            <span
              key={idx}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-editorial-text/72"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            <p className="text-[11px] text-editorial-text/45">Gia uu dai</p>
            <p className="serif text-2xl font-extrabold tracking-tight text-editorial-dark">${product.price}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleCompare(product)}
              title={isCompared ? "Remove from comparison board" : "Add to comparison board"}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 ${
                isCompared
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-editorial-text/65 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              <Scale className="w-4 h-4" />
            </button>

            <button
              onClick={() => onAddToCart(product)}
              className="flex items-center gap-2 rounded-full bg-editorial-dark px-4 py-2.5 text-[11px] font-semibold text-white transition-all duration-200 hover:bg-blue-600 shadow-lg shadow-slate-900/10"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Them vao gio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
