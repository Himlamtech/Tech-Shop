import React from "react";
import { ShoppingBag, Sparkles, Scale, Heart, ShieldCheck } from "lucide-react";
import { Product } from "../types";

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  comparedCount: number;
  onCompareClick: () => void;
  onAICompanionClick: () => void;
  favoritesCount: number;
  onFavoritesClick: () => void;
}

export default function Navbar({
  cartCount,
  onCartClick,
  comparedCount,
  onCompareClick,
  onAICompanionClick,
  favoritesCount,
  onFavoritesClick
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-editorial-bg/90 backdrop-blur-md border-b border-editorial-text/15">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
        {/* Editorial Logo Frame */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:block cap-text text-[9px] opacity-40 select-none">
            CURATION 04 / TECH
          </div>
          <div className="h-6 w-[1px] bg-editorial-text/10 hidden lg:block" />
          <div className="flex flex-col select-none">
            <span className="serif font-bold text-xl md:text-2xl text-editorial-text tracking-tight animate-pulse">THE ARCHIVE</span>
            <span className="cap-text text-[8px] opacity-65 tracking-[0.2em] -mt-1">AETHER TECH REPOSITORY</span>
          </div>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2 md:gap-3.5">
          {/* Real Trust Badging */}
          <div className="hidden lg:flex items-center gap-1.5 text-[9px] text-editorial-text cap-text py-1 px-3.5 border border-editorial-text/10 bg-editorial-accent/25 rounded-full">
            <ShieldCheck className="w-3 h-3 text-emerald-750 opacity-90 animate-pulse" />
            <span>Secure Access</span>
          </div>

          {/* AI Advisor Button */}
          <button
            id="nav-ai-button"
            onClick={onAICompanionClick}
            className="group relative flex items-center gap-2 bg-editorial-text text-editorial-bg border border-editorial-text py-1.5 px-4 uppercase text-[10px] font-semibold tracking-wider rounded-full hover:bg-transparent hover:text-editorial-text transition-all duration-300 h-9"
          >
            <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform duration-300" />
            <span>Ask AI Croupier</span>
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-editorial-text opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-editorial-text"></span>
            </span>
          </button>

          {/* Comparison Panel Trigger */}
          <button
            id="nav-compare-button"
            onClick={onCompareClick}
            disabled={comparedCount === 0}
            className={`flex items-center gap-2 uppercase text-[10px] tracking-wider border font-semibold py-1.5 px-4 transition-all duration-305 h-9 rounded-full ${
              comparedCount > 0
                ? "bg-editorial-accent text-editorial-text border-editorial-text/30 hover:border-editorial-text cursor-pointer"
                : "bg-transparent text-editorial-text/35 border-editorial-text/10 cursor-not-allowed"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Compare</span>
            {comparedCount > 0 && (
              <span className="flex items-center justify-center px-1 border-l border-editorial-text/30 pl-2 text-[10px] font-bold font-mono">
                {comparedCount}
              </span>
            )}
          </button>

          {/* Wishlist Favorites trigger */}
          <button
            id="nav-favorites-button"
            onClick={onFavoritesClick}
            className="relative flex items-center justify-center w-9 h-9 rounded-full border border-editorial-text/25 bg-transparent text-editorial-text hover:bg-editorial-text hover:text-editorial-bg transition-all duration-250 cursor-pointer"
            title="View my wishlist favorites"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${favoritesCount > 0 ? "text-red-500 fill-red-500 scale-102" : "text-editorial-text"}`} />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold font-mono border border-editorial-bg">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Mini-Cart Link Button */}
          <button
            id="nav-cart-button"
            onClick={onCartClick}
            className="relative flex items-center justify-center w-9 h-9 rounded-full border border-editorial-text/25 bg-transparent text-editorial-text hover:bg-editorial-text hover:text-editorial-bg transition-all duration-250 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-editorial-text text-editorial-bg text-[9px] font-bold font-mono border border-editorial-bg">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
