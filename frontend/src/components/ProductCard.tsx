import React from "react";
import { ArrowUpRight, Heart, Scale, ShoppingCart, Star } from "lucide-react";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getAiFitScore(product: Product) {
  const reviewsBoost = Math.min(product.reviewsCount, 40) * 0.4;
  const stockBoost = Math.min(product.stock ?? 0, 25) * 0.3;
  return Math.min(99, Math.round(product.rating * 16 + reviewsBoost + stockBoost));
}

export default function ProductCard({
  product,
  onViewDetails,
  onAddToCart,
  isCompared,
  onToggleCompare,
  isFavorite,
  onToggleFavorite,
}: ProductCardProps) {
  const aiFitScore = getAiFitScore(product);

  return (
    <article
      id={`product-card-${product.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[8px] border border-stone-900/10 bg-white shadow-[0_16px_42px_rgba(112,82,48,0.10)] transition duration-300 hover:-translate-y-1 hover:border-amber-700/20 hover:shadow-[0_24px_60px_rgba(112,82,48,0.18)]"
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(185,135,70,0.7),transparent)] opacity-70" />

      <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-700/20 bg-amber-700/10 px-3 py-1 text-[11px] font-semibold text-amber-900">
            {product.tag}
          </span>
          <span className="rounded-full border border-stone-900/10 bg-white/75 px-3 py-1 text-[11px] text-editorial-text/58">
            {product.brand || "Lamania"}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/80 text-editorial-text/72 backdrop-blur transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"
          title={isFavorite ? "Remove from favorites" : "Save to favorites"}
        >
          <Heart className={`h-4.5 w-4.5 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
      </div>

      <button onClick={() => onViewDetails(product)} className="relative block overflow-hidden border-b border-stone-900/10 pt-[74%] text-left">
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(35,31,26,0.04),rgba(35,31,26,0.7))]" />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
          <div className="rounded-full border border-stone-900/10 bg-white/80 px-3 py-1.5 text-[11px] text-editorial-text/70 backdrop-blur">
            {product.category}
          </div>
          <div className="rounded-full border border-amber-700/20 bg-amber-700/12 px-3 py-1.5 text-[11px] font-semibold text-amber-900 backdrop-blur">
            Match {aiFitScore}%
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/45">{product.brand || "Lamania"}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-editorial-text">{product.name}</h3>
          </div>
          <div className="rounded-2xl border border-stone-900/10 bg-white/65 px-3 py-2 text-right">
            <div className="flex items-center justify-end gap-1 text-amber-600">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-sm font-semibold text-editorial-text">{product.rating.toFixed(1)}</span>
            </div>
            <p className="mt-1 text-[11px] text-editorial-text/45">{product.reviewsCount} reviews</p>
          </div>
        </div>

        <p className="mt-3 line-clamp-3 text-sm leading-6 text-editorial-text/64">{product.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {product.features.slice(0, 3).map((feature, idx) => (
            <span
              key={idx}
              className="rounded-full border border-stone-900/10 bg-white/65 px-3 py-1.5 text-xs text-editorial-text/62"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-[22px] border border-stone-900/10 bg-stone-100/65 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/46">Price</p>
            <p className="mt-1 text-2xl font-semibold text-editorial-text">{formatCurrency(product.price)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-editorial-text/46">Specs</p>
            <p className="mt-1 text-sm font-medium text-editorial-text/74">{product.specs.slice(0, 2).map((spec) => spec.value).join(" • ") || "Detailed in drawer"}</p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onToggleCompare(product)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                isCompared
                  ? "border-amber-700/30 bg-amber-700/12 text-amber-900"
                  : "border-stone-900/10 bg-white/65 text-editorial-text/74 hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"
              }`}
            >
              <Scale className="h-4 w-4" />
              Compare
            </button>
            <button
              onClick={() => onViewDetails(product)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-900/10 bg-white/65 px-4 py-3 text-sm font-semibold text-editorial-text/74 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"
            >
              <ArrowUpRight className="h-4 w-4" />
              View detail
            </button>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#fffaf0,#ead6b8)] px-4 py-3.5 text-sm font-semibold text-stone-950 transition hover:brightness-105"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}
