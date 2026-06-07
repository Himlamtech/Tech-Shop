import React from "react";
import { ShoppingBag, Sparkles, Scale, Heart, ShieldCheck, Search, LogIn, LogOut, Shield, UserCircle2 } from "lucide-react";
import { AuthUser } from "../types";

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  comparedCount: number;
  onCompareClick: () => void;
  onAICompanionClick: () => void;
  favoritesCount: number;
  onFavoritesClick: () => void;
  authUser: AuthUser | null;
  authBusy: boolean;
  onAuthClick: () => void;
  onLogoutClick: () => void;
}

export default function Navbar({
  cartCount,
  onCartClick,
  comparedCount,
  onCompareClick,
  onAICompanionClick,
  favoritesCount,
  onFavoritesClick,
  authUser,
  authBusy,
  onAuthClick,
  onLogoutClick,
}: NavbarProps) {
  const isPrivileged = authUser?.role === "admin" || authUser?.role === "staff";

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/78 backdrop-blur-xl shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-violet-500 text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="serif text-xl md:text-2xl font-extrabold tracking-tight text-editorial-dark">TechShop</span>
            <span className="text-[11px] text-editorial-text/60 truncate">Nen tang mua sam cong nghe mem mai va thong minh hon</span>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl items-center gap-3 rounded-full border border-editorial-text/10 bg-editorial-bg/80 px-4 py-2.5 shadow-inner shadow-white/80">
          <Search className="w-4 h-4 text-editorial-text/40" />
          <span className="text-sm text-editorial-text/45">Tim dien thoai, laptop, phu kien...</span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {authUser ? (
            <div className="hidden xl:flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-left shadow-sm">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isPrivileged ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                {isPrivileged ? <Shield className="h-4 w-4" /> : <UserCircle2 className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="max-w-[180px] truncate text-xs font-semibold text-editorial-dark">{authUser.email}</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/45">{authUser.role}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-semibold text-editorial-dark shadow-sm transition hover:border-blue-200 hover:text-blue-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Dang nhap</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Chinh hang</span>
          </div>

          <button
            id="nav-ai-button"
            onClick={onAICompanionClick}
            className="group relative flex h-10 items-center gap-2 rounded-full border border-editorial-dark bg-editorial-dark px-4 text-[11px] font-semibold text-white shadow-lg shadow-blue-900/10 transition-all duration-300 hover:border-blue-600 hover:bg-blue-600"
          >
            <Sparkles className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-12" />
            <span>AI tu van</span>
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
            </span>
          </button>

          <button
            id="nav-compare-button"
            onClick={onCompareClick}
            disabled={comparedCount === 0}
            className={`flex h-10 items-center gap-2 rounded-full border px-4 text-[11px] font-semibold transition-all duration-300 ${
              comparedCount > 0
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400"
                : "border-editorial-text/10 bg-transparent text-editorial-text/35 cursor-not-allowed"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>So sanh</span>
            {comparedCount > 0 && (
              <span className="border-l border-blue-200 pl-2 text-[10px] font-bold font-mono">{comparedCount}</span>
            )}
          </button>

          <button
            id="nav-favorites-button"
            onClick={onFavoritesClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-editorial-text/12 bg-white text-editorial-text shadow-sm transition-all duration-300 hover:border-rose-200 hover:bg-rose-50"
            title="View my wishlist favorites"
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${favoritesCount > 0 ? "fill-red-500 text-red-500" : "text-editorial-text"}`} />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[9px] font-bold text-white h-4">
                {favoritesCount}
              </span>
            )}
          </button>

          <button
            id="nav-cart-button"
            onClick={onCartClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-editorial-text/12 bg-white text-editorial-text shadow-sm transition-all duration-300 hover:bg-editorial-dark hover:text-white"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full border border-white bg-editorial-dark px-1 text-[9px] font-bold text-white h-4">
                {cartCount}
              </span>
            )}
          </button>

          {authUser ? (
            <button
              onClick={onLogoutClick}
              disabled={authBusy}
              className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[11px] font-semibold text-editorial-text shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dang xuat</span>
            </button>
          ) : (
            <button
              onClick={onAuthClick}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-editorial-text shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 md:hidden"
              aria-label="Dang nhap"
            >
              <LogIn className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
