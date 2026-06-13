import React, { useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn, Smartphone, UserPlus, X } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  mode: "login" | "register";
  busy: boolean;
  error: string | null;
  phoneVerificationPending: boolean;
  onClose: () => void;
  onSubmit: (values: { email: string; password: string }) => void;
  onModeChange: (mode: "login" | "register") => void;
  onGoogleSignIn: () => void;
  onPhoneSendCode: (phoneNumber: string) => void;
  onPhoneVerifyCode: (otpCode: string) => void;
  onPhoneReset: () => void;
}

export default function AuthDialog({
  open,
  mode,
  busy,
  error,
  phoneVerificationPending,
  onClose,
  onSubmit,
  onModeChange,
  onGoogleSignIn,
  onPhoneSendCode,
  onPhoneVerifyCode,
  onPhoneReset,
}: AuthDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("+84");
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setPhoneNumber("+84");
      setOtpCode("");
      return;
    }
    setEmail((current) => current.trim());
  }, [open]);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  useEffect(() => {
    if (!phoneVerificationPending) {
      setOtpCode("");
    }
  }, [phoneVerificationPending]);

  if (!open) {
    return null;
  }

  const title = mode === "login" ? "Sign in to Lamania" : "Create account";
  const description = mode === "login"
    ? "Use your account for checkout, saved cart, and reviews."
    : "Create an account for faster checkout and order tracking.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/28 p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[8px] border border-stone-900/10 bg-white p-6 shadow-[0_30px_100px_rgba(112,82,48,0.42)] md:p-8">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(185,135,70,0.8),transparent)]" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-editorial-text/45">Authentication</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-editorial-text">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-editorial-text/62">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-900/10 bg-white/65 text-editorial-text/60 transition hover:border-amber-700/25 hover:bg-amber-700/10 hover:text-editorial-text"
            aria-label="Close authentication dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-2xl border border-stone-900/10 bg-stone-100/80 p-1 text-sm">
          <button onClick={() => onModeChange("login")} className={`rounded-xl px-4 py-3 font-semibold transition ${mode === "login" ? "bg-white text-stone-950" : "text-editorial-text/58 hover:bg-white/65 hover:text-editorial-text"}`}>
            Sign in
          </button>
          <button onClick={() => onModeChange("register")} className={`rounded-xl px-4 py-3 font-semibold transition ${mode === "register" ? "bg-white text-stone-950" : "text-editorial-text/58 hover:bg-white/65 hover:text-editorial-text"}`}>
            Register
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "register" && password !== confirmPassword) {
              return;
            }
            onSubmit({ email: email.trim(), password });
          }}
        >
          <label className="block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-editorial-text/48">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3.5 text-sm text-editorial-text outline-none transition placeholder:text-editorial-text/28 focus:border-amber-700/25 focus:bg-white/80"
            placeholder="you@lamania.local"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-editorial-text/48">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3.5 pr-12 text-sm text-editorial-text outline-none transition placeholder:text-editorial-text/28 focus:border-amber-700/25 focus:bg-white/80"
                placeholder="Use at least 8 characters"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-editorial-text/40 hover:text-editorial-text">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {mode === "register" && (
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-editorial-text/48">Confirm Password</span>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`w-full rounded-2xl border bg-stone-100/80 px-4 py-3.5 pr-12 text-sm text-editorial-text outline-none transition placeholder:text-editorial-text/28 focus:bg-white/80 ${
                    confirmPassword && confirmPassword !== password
                      ? "border-red-400/50 focus:border-red-400/70"
                      : "border-stone-900/10 focus:border-amber-700/25"
                  }`}
                  placeholder="Re-enter your password"
                />
                <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-editorial-text/40 hover:text-editorial-text">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </label>
          )}

          <button
            type="submit"
            disabled={busy || (mode === "register" && (!confirmPassword || confirmPassword !== password))}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#a8783f,#b98746)] px-5 py-4 text-sm font-semibold text-stone-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Processing
              </>
            ) : mode === "login" ? (
              <>
                <LogIn className="h-4 w-4" />
                Sign in with email
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create account
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-editorial-text/35">
          <div className="h-px flex-1 bg-white/10" />
          Or continue with
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mt-4 grid gap-3">
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-900/10 bg-white px-5 py-3.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="text-base leading-none">G</span>
            Continue with Google
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-stone-900/10 bg-stone-100/80 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-editorial-text">
            <Smartphone className="h-4 w-4" />
            Phone sign-in
          </div>
          <p className="mt-2 text-xs leading-5 text-editorial-text/55">
            Use full international format, for example <span className="font-semibold text-editorial-text/75">+84901234567</span>.
          </p>

          {!phoneVerificationPending ? (
            <div className="mt-4 space-y-3">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3.5 text-sm text-editorial-text outline-none transition placeholder:text-editorial-text/28 focus:border-amber-700/25 focus:bg-white/80"
                placeholder="+84901234567"
              />
              <button
                type="button"
                onClick={() => onPhoneSendCode(phoneNumber.trim())}
                disabled={busy || phoneNumber.trim().length < 8}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-700/25 bg-amber-700/10 px-5 py-3.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-700/15 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Send verification code
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <input
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                className="w-full rounded-2xl border border-stone-900/10 bg-stone-100/80 px-4 py-3.5 text-sm text-editorial-text outline-none transition placeholder:text-editorial-text/28 focus:border-amber-700/25 focus:bg-white/80"
                placeholder="Enter 6-digit OTP"
              />
              <button
                type="button"
                onClick={() => onPhoneVerifyCode(otpCode.trim())}
                disabled={busy || otpCode.trim().length < 6}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#34d399,#b98746)] px-5 py-3.5 text-sm font-semibold text-stone-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Verify code and sign in
              </button>
              <button
                type="button"
                onClick={onPhoneReset}
                disabled={busy}
                className="w-full rounded-2xl border border-stone-900/10 px-4 py-3 text-sm font-semibold text-editorial-text/72 transition hover:bg-white/65 disabled:cursor-wait disabled:opacity-60"
              >
                Use another phone number
              </button>
            </div>
          )}

          <div id="firebase-phone-recaptcha" className="mt-3 min-h-[1px]" />
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-700/20 bg-red-700/10 px-4 py-3 text-sm text-red-800">{error}</div>}
      </div>
    </div>
  );
}
