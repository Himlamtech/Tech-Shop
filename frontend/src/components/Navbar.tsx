import React from "react";
import { BrainCircuit, Heart, LogIn, LogOut, Scale, ShoppingBag, ShieldCheck, Sparkles } from "lucide-react";
import { AuthSession } from "../types";

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  comparedCount: number;
  onCompareClick: () => void;
  onAICompanionClick: () => void;
  favoritesCount: number;
  onFavoritesClick: () => void;
  authSession: AuthSession | null;
  onAuthClick: () => void;
  onLogoutClick: () => void;
}

function NavCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-slate-950 bg-[linear-gradient(135deg,#55d6ff,#7d6bff)] px-1 text-[10px] font-bold text-slate-950">
      {count}
    </span>
  );
}

export default function Navbar({
  cartCount,
  onCartClick,
  comparedCount,
  onCompareClick,
  onAICompanionClick,
  favoritesCount,
  onFavoritesClick,
  authSession,
  onAuthClick,
  onLogoutClick,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-slate-950/55 px-4 py-3 shadow-[0_24px_70px_rgba(2,6,23,0.45)] backdrop-blur-xl md:px-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(76,130,255,0.2),rgba(85,214,255,0.12))] text-cyan-200 shadow-[0_0_30px_rgba(76,130,255,0.2)]">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-editorial-text/48">
              <span>TechShop</span>
              <span className="hidden md:inline">AI Commerce</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="serif text-lg font-bold tracking-[-0.04em] text-editorial-text md:text-xl">Premium Hardware</span>
              <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-editorial-text/55 lg:inline-flex">
                Live catalog
              </span>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold text-emerald-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure checkout ready
          </div>
          <button
            id="nav-ai-button"
            onClick={onAICompanionClick}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/18"
          >
            <Sparkles className="h-4 w-4" />
            AI Advisor
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {!authSession ? (
            <button
              onClick={onAuthClick}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/30 hover:bg-cyan-400/10 sm:inline-flex"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </button>
          ) : (
            <button
              onClick={onLogoutClick}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-editorial-text transition hover:border-cyan-400/30 hover:bg-cyan-400/10 sm:inline-flex"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}

          <button
            onClick={onCompareClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-editorial-text/74 transition hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-editorial-text"
            title="Compare products"
          >
            <Scale className="h-4.5 w-4.5" />
            <NavCount count={comparedCount} />
          </button>

          <button
            onClick={onFavoritesClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-editorial-text/74 transition hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-editorial-text"
            title="Favorites"
          >
            <Heart className={`h-4.5 w-4.5 ${favoritesCount > 0 ? "fill-rose-400 text-rose-400" : ""}`} />
            <NavCount count={favoritesCount} />
          </button>

          <button
            onClick={onCartClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-editorial-text/74 transition hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-editorial-text"
            title="Shopping cart"
          >
            <ShoppingBag className="h-4.5 w-4.5" />
            <NavCount count={cartCount} />
          </button>
        </div>
      </div>
    </header>
  );
}
