import React from "react";
import { Heart, LogIn, LogOut, MonitorSmartphone, Scale, ShoppingBag, User } from "lucide-react";
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
  onProfileClick?: () => void;
}

function NavCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-stone-900/20 bg-[linear-gradient(135deg,#b98746,#6f8b6d)] px-1 text-[10px] font-bold text-stone-950">
      {count}
    </span>
  );
}

export default function Navbar({
  cartCount,
  onCartClick,
  comparedCount,
  onCompareClick,
  onAICompanionClick: _onAICompanionClick,
  favoritesCount,
  onFavoritesClick,
  authSession,
  onAuthClick,
  onLogoutClick,
  onProfileClick,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 md:px-8">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 rounded-2xl border border-stone-900/10 bg-white/90 px-4 py-3 shadow-[0_16px_50px_rgba(112,82,48,0.14)] backdrop-blur-xl md:px-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-amber-700/20 bg-amber-700/10 text-amber-800">
            <MonitorSmartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-editorial-text/48">Tech store</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-extrabold text-editorial-text md:text-xl">Lamania</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {!authSession ? (
            <button
              onClick={onAuthClick}
              className="hidden items-center gap-2 rounded-full border border-stone-900/10 bg-white/65 px-4 py-2.5 text-sm font-semibold text-editorial-text transition hover:border-amber-700/30 hover:bg-amber-700/10 sm:inline-flex"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </button>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              {authSession.user.role === "customer" && onProfileClick && (
                <button
                  onClick={onProfileClick}
                  className="flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/65 px-4 py-2.5 text-sm font-semibold text-editorial-text transition hover:border-amber-700/30 hover:bg-amber-700/10"
                >
                  <User className="h-4 w-4" />
                  Tài khoản
                </button>
              )}
              <button
                onClick={onLogoutClick}
                className="flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/65 px-4 py-2.5 text-sm font-semibold text-editorial-text transition hover:border-amber-700/30 hover:bg-amber-700/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}

          <button
            onClick={onCompareClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/74 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"
            title="Compare products"
          >
            <Scale className="h-4.5 w-4.5" />
            <NavCount count={comparedCount} />
          </button>

          <button
            onClick={onFavoritesClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/74 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"
            title="Favorites"
          >
            <Heart className={`h-4.5 w-4.5 ${favoritesCount > 0 ? "fill-rose-500 text-rose-500" : ""}`} />
            <NavCount count={favoritesCount} />
          </button>

          <button
            onClick={onCartClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/74 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"
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
