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
      className="group relative flex flex-col h-full rounded-2xl bg-editorial-paper border border-editorial-text/15 hover:border-editorial-text/45 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
    >
      {/* Editorial top decorative index marker line with rounded highlight */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-editorial-accent/30" />

      {/* Floating details and favorites ribbon */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pb-1">
        <span className="flex items-center gap-1 text-[9px] font-bold text-editorial-text bg-editorial-bg border border-editorial-text/25 px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm font-mono">
          <Sparkles className="w-2.5 h-2.5 text-editorial-text/75 shrink-0 animate-pulse" />
          {product.tag}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product);
          }}
          className="flex items-center justify-center w-8.5 h-8.5 rounded-full bg-editorial-bg/90 backdrop-blur-sm border border-editorial-text/15 hover:border-editorial-text/45 text-editorial-text shadow-sm transition-all duration-200 cursor-pointer"
          title={isFavorite ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite ? "text-red-500 fill-red-550" : "text-editorial-text"}`} />
        </button>
      </div>

      {/* Image Area */}
      <div
        onClick={() => onViewDetails(product)}
        className="relative pt-[72%] w-full bg-editorial-card overflow-hidden cursor-pointer border-b border-editorial-text/10"
      >
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-102 transition-transform duration-500 opacity-90 hover:opacity-100"
        />
        <div className="absolute inset-0 bg-editorial-text/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info Body Area */}
      <div className="flex flex-col flex-grow p-5 md:p-6 relative z-10 bg-editorial-paper">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[9px] font-bold text-editorial-text/60 uppercase tracking-widest font-mono">
            {product.category}
          </span>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-550 fill-yellow-500 shrink-0 opacity-85" />
            <span className="text-[11px] font-bold text-editorial-text font-mono">{product.rating}</span>
            <span className="text-[10px] text-editorial-text/50 font-sans">({product.reviewsCount})</span>
          </div>
        </div>

        <h3
          onClick={() => onViewDetails(product)}
          className="serif text-lg md:text-xl font-bold text-editorial-text hover:text-editorial-text/70 transition-colors line-clamp-1 mb-2 tracking-tight cursor-pointer"
        >
          {product.name}
        </h3>

        <p className="text-xs text-editorial-text/70 line-clamp-2 mb-4 font-sans leading-relaxed">
          {product.description}
        </p>

        {/* Feature Tags list with soft rounded edge styling */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {product.features.slice(0, 2).map((feature, idx) => (
            <span
              key={idx}
              className="text-[10px] text-editorial-text/80 font-sans bg-editorial-bg border border-editorial-text/10 rounded-full px-3 py-0.5 max-w-full truncate"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* Bottom Actions Frame */}
        <div className="mt-auto pt-4 border-t border-editorial-text/10 flex items-center justify-between gap-3">
          <div>
            <p className="text-[8px] text-editorial-text/45 font-mono tracking-widest uppercase">Spec Price</p>
            <p className="serif text-lg font-bold text-editorial-text">${product.price}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Compare Toggle Button */}
            <button
              onClick={() => onToggleCompare(product)}
              title={isCompared ? "Remove from comparison board" : "Add to comparison board"}
              className={`flex items-center justify-center w-8.5 h-8.5 rounded-full border transition-all duration-200 cursor-pointer ${
                isCompared
                  ? "bg-editorial-text border-editorial-text text-editorial-bg"
                  : "bg-transparent border-editorial-text/20 text-editorial-text/65 hover:text-editorial-text hover:border-editorial-text/50 hover:bg-editorial-accent/30"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </button>

            {/* Add to Cart Button */}
            <button
              onClick={() => onAddToCart(product)}
              className="flex items-center gap-1.5 bg-editorial-text hover:bg-editorial-text/85 text-editorial-bg font-semibold text-[10px] uppercase tracking-wider py-2 px-4 rounded-full transition-all duration-200 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
