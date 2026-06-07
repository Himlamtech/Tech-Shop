import React, { useEffect, useState } from "react";
import { LoaderCircle, LogIn, UserPlus, X } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  mode: "login" | "register";
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { email: string; password: string }) => void;
  onModeChange: (mode: "login" | "register") => void;
}

export default function AuthDialog({
  open,
  mode,
  busy,
  error,
  onClose,
  onSubmit,
  onModeChange,
}: AuthDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
      return;
    }
    setEmail((current) => current.trim());
  }, [open]);

  if (!open) {
    return null;
  }

  const title = mode === "login" ? "Dang nhap TechShop" : "Tao tai khoan moi";
  const description = mode === "login"
    ? "Su dung mot tai khoan cho ca customer, staff va admin."
    : "Dang ky tai khoan customer moi va nhan session ngay sau khi tao.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.22)] md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Xac thuc</p>
            <h2 className="serif mt-2 text-3xl font-extrabold tracking-tight text-editorial-dark">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-editorial-text/65">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-editorial-text/65 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Dong hop thoai dang nhap"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-semibold text-editorial-text/65">
          <button
            onClick={() => onModeChange("login")}
            className={`rounded-xl px-4 py-3 transition ${mode === "login" ? "bg-white text-editorial-dark shadow-sm" : "hover:text-editorial-dark"}`}
          >
            Dang nhap
          </button>
          <button
            onClick={() => onModeChange("register")}
            className={`rounded-xl px-4 py-3 transition ${mode === "register" ? "bg-white text-editorial-dark shadow-sm" : "hover:text-editorial-dark"}`}
          >
            Dang ky
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ email: email.trim(), password });
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-editorial-dark">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
              placeholder="admin@techshop.local"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-editorial-dark">Mat khau</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
              placeholder="Nhap toi thieu 8 ky tu"
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-editorial-dark px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Dang xu ly
              </>
            ) : mode === "login" ? (
              <>
                <LogIn className="h-4 w-4" />
                Dang nhap
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Tao tai khoan
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
