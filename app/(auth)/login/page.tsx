"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  checkLoginType,
  sendFirstLoginOtp,
  verifyFirstLoginOtp,
  completeFirstLogin,
  loginWithPassword,
} from "@/app/actions/auth";
import Logo from "@/components/Logo";
import { useLogoTheme } from "@/lib/use-logo-theme";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";

// ── Icons ───────────────────────────────────────────────────────────────────
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" style={{ color: "var(--brand-primary, #2090FF)" }} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Strength bar ──────────────────────────────────────────────────────────────
function getStrength(p: string): { level: number; label: string; color: string } {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[!@#$%^&*]/.test(p)) score++;
  if (score <= 1) return { level: score, label: "Weak", color: "#ba1a1a" };
  if (score === 2) return { level: score, label: "Fair", color: "#e6a817" };
  if (score === 3) return { level: score, label: "Good", color: "#2e7d32" };
  return { level: score, label: "Strong", color: "var(--brand-primary, #2090FF)" };
}

// ── Inactivity Timeout ───────────────────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function useInactivityLogout(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: NodeJS.Timeout;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.location.href = "/login?reason=timeout";
      }, INACTIVITY_TIMEOUT_MS);
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [enabled]);
}

// ── Carousel Slides ───────────────────────────────────────────────────────────
const SLIDES = [
  {
    src: "/login-slides/factory.png",
    headline: "Built for manufacturing. Designed for growth.",
    sub: "SUKI CRM — Where the factory floor meets the boardroom.",
  },
  {
    src: "/login-slides/sales.png",
    headline: "Turn every conversation into a closed deal.",
    sub: "SUKI CRM — Intelligent B2B sales, end to end.",
  },
  {
    src: "/login-slides/warehouse.png",
    headline: "From dispatch to delivery, every touchpoint tracked.",
    sub: "SUKI CRM — Operational clarity at enterprise scale.",
  },
];

function ImageCarousel() {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const goTo = useCallback((idx: number) => {
    if (idx === active) return;
    setFading(true);
    setTimeout(() => {
      setActive(idx);
      setFading(false);
    }, 450);
  }, [active]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActive(prev => {
        const next = (prev + 1) % SLIDES.length;
        return next;
      });
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleDot = (idx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    goTo(idx);
    timerRef.current = setInterval(() => {
      setActive(prev => (prev + 1) % SLIDES.length);
    }, 4000);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity"
          style={{
            opacity: i === active ? 1 : 0,
            transitionDuration: "900ms",
            transitionTimingFunction: "ease-in-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.src}
            alt={slide.headline}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.85) 100%)",
            }}
          />
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 p-7 z-10">
        <p
          className="text-white leading-snug mb-1.5"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontSize: "15px",
            fontWeight: 400,
            letterSpacing: "0.01em",
          }}
        >
          {SLIDES[active].headline}
        </p>
        <p className="text-white/50 text-[12px] tracking-wide mb-5">
          {SLIDES[active].sub}
        </p>

        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDot(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === active ? "14px" : "4px",
                height: "4px",
                borderRadius: "9999px",
                backgroundColor: i === active ? "var(--brand-primary, #2090FF)" : "rgba(255,255,255,0.35)",
                transition: "width 300ms ease, background-color 300ms ease",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dark input styles ─────────────────────────────────────────────────────────
const inputClass =
  "w-full px-4 py-3 rounded-[8px] border border-[#2C2C2A] bg-[#1A1A1A] text-white text-[14px] placeholder:text-[#5F5E5A] focus:outline-none focus:border-[var(--brand-primary,#2090FF)] focus:ring-1 focus:ring-[var(--brand-primary,#2090FF)]/30 transition-all";

// ── Login accent (theme-aware) ─────────────────────────────────────────────
const ACCENT_HEX = "var(--brand-primary, #2090FF)";
const ACCENT_HOVER = "var(--brand-primary-hover, #C55308)";

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
type Stage = "email" | "otp" | "setPassword" | "password";

function LoginContent() {
  const logoTheme = useLogoTheme();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const activated = searchParams.get("activated") === "true";
  const timedOut = searchParams.get("reason") === "timeout";

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const { startLoading } = useGlobalLoading();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useInactivityLogout(false);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Auto-submit when all 6 OTP digits filled
  useEffect(() => {
    if (otp.every(d => d !== "") && stage === "otp") {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const strength = getStrength(password);
  const passwordsMatch = password !== "" && password === confirmPassword;

  // ── STEP 0: Check email → route to correct flow ──
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await checkLoginType(email.trim());
    setLoading(false);
    if (!res.success) { setError(res.message ?? "Something went wrong."); return; }
    if (res.data?.isFirstLogin) {
      await handleSendOtp();
    } else {
      setStage("password");
    }
  }

  // ── Send / Resend OTP ──
  async function handleSendOtp() {
    setError(""); setLoading(true);
    const res = await sendFirstLoginOtp(email.trim());
    setLoading(false);
    if (!res.success) { setError(res.message ?? "Failed to send code."); return; }
    setInfo(res.message);
    setOtp(["", "", "", "", "", ""]);
    setResendCooldown(60);
    setStage("otp");
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }

  // ── OTP digit input handler ──
  function handleOtpChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  // ── STEP 2: Verify OTP ──
  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length < 6) return;
    setError(""); setLoading(true);
    const res = await verifyFirstLoginOtp(email.trim(), code);
    setLoading(false);
    if (!res.success) { setError(res.message ?? "Verification failed."); setOtp(["", "", "", "", "", ""]); otpRefs.current[0]?.focus(); return; }
    setStage("setPassword");
  }

  // ── STEP 3: Complete first login ──
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) { setError("Passwords do not match."); return; }
    if (strength.level < 2) { setError("Password is too weak."); return; }
    setError(""); setLoading(true);
    const res = await completeFirstLogin(email.trim(), otp.join(""), password, rememberMe);
    setLoading(false);
    if (res && res.success && res.redirectUrl) {
      startLoading("Signing you in...");
      window.location.href = res.redirectUrl;
    } else if (res && !res.success) { 
      setError(res.message ?? "Failed to activate account."); 
    }
  }

  // ── Normal login ──
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await loginWithPassword(email.trim(), password, rememberMe);
    setLoading(false);
    if (res && res.success && res.redirectUrl) {
      startLoading("Signing you in...");
      window.location.href = res.redirectUrl;
    } else if (res && !res.success) { 
      setError(res.message ?? "Login failed."); 
    }
  }

  // ── Shared UI pieces ──
  const ErrorBox = () => error ? (
    <div className="mb-5 p-3 rounded-[8px] bg-[#3a1212] border border-[#6b2020] text-[13px] text-[#ff9898] font-medium text-center">{error}</div>
  ) : null;

  const InfoBox = () => info ? (
    <div className="mb-5 p-3 rounded-[8px] bg-[#1a2e1a] border border-[#2e5c2e] text-[13px] text-[#7dc97d] font-medium text-center">{info}</div>
  ) : null;

  const SubmitBtn = ({ label, loadingLabel }: { label: string; loadingLabel: string }) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full mt-4 py-3.5 px-6 rounded-[8px] text-[14px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      style={{ backgroundColor: ACCENT_HEX, color: "#0A0A0A" }}
      onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT_HOVER; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT_HEX; }}
    >
      {loading ? <><Spinner />{loadingLabel}</> : <>{label}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>}
    </button>
  );

  const BackBtn = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[13px] text-[#5F5E5A] hover:text-white mb-6 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );

  const Banners = () => (
    <>
      {resetSuccess && (
        <div className="mb-5 p-3 rounded-[8px] bg-[#1a2e1a] border border-[#2e5c2e] flex items-center gap-3 text-[13px] text-[#7dc97d]">
          <CheckIcon />
          <div>
            <p className="font-semibold">Password updated successfully</p>
            <p className="text-[12px] opacity-80">You can now sign in with your new password.</p>
          </div>
        </div>
      )}
      {activated && (
        <div className="mb-5 p-3 rounded-[8px] bg-[#1a2e1a] border border-[#2e5c2e] flex items-center gap-3 text-[13px] text-[#7dc97d]">
          <CheckIcon />
          <div>
            <p className="font-semibold">Account activated successfully!</p>
            <p className="text-[12px] opacity-80">Welcome to SUKI CRM. Sign in with your email and new password.</p>
          </div>
        </div>
      )}
      {timedOut && (
        <div className="mb-5 p-3 rounded-[8px] bg-[#2e2010] border border-[#5c3d10] flex items-center gap-3 text-[13px] text-[#e6a817]">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">Session expired</p>
            <p className="text-[12px] opacity-80">You were logged out due to 30 minutes of inactivity.</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 lg:p-8"
      style={{
        backgroundColor: "#0D0D0D",
        backgroundImage: "url('/login-bg.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay on the outer page */}
      <div className="fixed inset-0 bg-black/60 pointer-events-none" />

      {/* Centered card container holding both panels */}
      <div
        className="relative z-10 w-full flex overflow-hidden rounded-2xl shadow-2xl"
        style={{ maxWidth: "960px", minHeight: "580px" }}
      >
        {/* LEFT: Image Carousel (55%) */}
        <div
          className="hidden lg:block relative flex-none"
          style={{ width: "55%" }}
        >
          <ImageCarousel />
        </div>

        {/* RIGHT: Form Panel */}
        <div
          className="flex-1 flex items-center justify-center px-6 py-10"
          style={{ backgroundColor: "#0A0A0A" }}
        >
          <div className="w-full max-w-[380px] flex flex-col">
          {/* Logo mark */}
          <div className="flex items-center justify-center mb-10">
            <Logo theme={logoTheme} variant="full" size={48} />
          </div>

          <Banners />

          {/* STAGE: EMAIL */}
          {stage === "email" && (
            <>
              <div className="mb-7">
                <h2 className="text-white mb-2 leading-snug" style={{ fontSize: "18px", fontWeight: 400 }}>
                  Sign in to SUKI CRM
                </h2>
                <p className="text-[13px] text-white leading-[1.5]">
                  Enter your registered email address to continue.
                </p>
              </div>
              <ErrorBox />
              <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="block text-[11px] font-medium text-white mb-2 tracking-[0.08em] uppercase">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={inputClass}
                  />
                </div>
                <SubmitBtn label="Continue" loadingLabel="Checking…" />
              </form>
              <div className="pt-8 text-center">
                <p className="text-[12px] text-white">Need help? Contact IT Support</p>
                <p className="text-[11px] text-[#2E2E2C] mt-3">© {new Date().getFullYear()} SUKI CRM. All rights reserved.</p>
              </div>
            </>
          )}

          {/* STAGE: OTP */}
          {stage === "otp" && (
            <>
              <BackBtn onClick={() => { setStage("email"); setError(""); setInfo(""); }} />
              <div className="mb-6">
                <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: 400 }}>Verify your email</h2>
                <p className="text-[13px] text-white leading-[1.5]">
                  We sent a 6-digit code to <span className="text-white">{email}</span>. Enter it below to activate your account.
                </p>
              </div>
              <InfoBox />
              <ErrorBox />
              <div className="flex gap-2.5 justify-center mb-6">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-10 h-12 text-center text-[20px] font-bold text-white rounded-[8px] border-2 border-[#2C2C2A] bg-[#1A1A1A] focus:outline-none focus:border-[var(--brand-primary,#2090FF)] focus:ring-1 focus:ring-[var(--brand-primary,#2090FF)]/30 transition-all font-mono"
                  />
                ))}
              </div>
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.some(d => d === "")}
                className="w-full py-3.5 px-6 rounded-[8px] text-[14px] font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--brand-primary, #2090FF)", color: "#0A0A0A" }}
              >
                {loading ? <><Spinner />Verifying…</> : "Verify Code"}
              </button>
              <div className="mt-5 text-center">
                {resendCooldown > 0 ? (
                  <p className="text-[13px] text-white">Resend available in <span className="text-white">{resendCooldown}s</span></p>
                ) : (
                  <button onClick={handleSendOtp} disabled={loading} className="text-[13px] hover:underline disabled:opacity-50" style={{ color: "var(--brand-primary, #2090FF)" }}>Resend Code</button>
                )}
              </div>
              <div className="pt-8 text-center">
                <p className="text-[11px] text-[#2E2E2C]">© {new Date().getFullYear()} SUKI CRM. All rights reserved.</p>
              </div>
            </>
          )}

          {/* STAGE: SET PASSWORD */}
          {stage === "setPassword" && (
            <>
              <div className="mb-6">
                <div className="w-8 h-8 rounded-full bg-[#1a2e1a] flex items-center justify-center mb-4">
                  <svg className="w-4 h-4 text-[#7dc97d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: 400 }}>Set your password</h2>
                <p className="text-[13px] text-white leading-[1.5]">Create a strong password to secure your SUKI CRM account.</p>
              </div>
              <ErrorBox />
              <form onSubmit={handleSetPassword} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="new-password" className="block text-[11px] font-medium text-white mb-2 tracking-[0.08em] uppercase">New Password</label>
                  <div className="relative">
                    <input id="new-password" type={showPassword ? "text" : "password"} required autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, A-Z, 0-9, !@#$" className={`${inputClass} pr-12`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5F5E5A] hover:text-white transition-colors"><EyeIcon visible={showPassword} /></button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map(l => (
                          <div key={l} className="h-1 flex-1 rounded-full transition-all" style={{ background: strength.level >= l ? strength.color : "#2C2C2A" }} />
                        ))}
                      </div>
                      <p className="text-[11px]" style={{ color: strength.color }}>Strength: <strong>{strength.label}</strong></p>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-[11px] font-medium text-white mb-2 tracking-[0.08em] uppercase">Confirm Password</label>
                  <div className="relative">
                    <input id="confirm-password" type={showConfirm ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className={`${inputClass} pr-12`} style={{ borderColor: confirmPassword ? passwordsMatch ? "#2e7d32" : "#ba1a1a" : "#2C2C2A" }} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5F5E5A] hover:text-white transition-colors"><EyeIcon visible={showConfirm} /></button>
                  </div>
                  {confirmPassword && (
                    <p className={`mt-1.5 text-[11px] font-medium ${passwordsMatch ? "text-[#7dc97d]" : "text-[#ff9898]"}`}>
                      {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                    <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${rememberMe ? "border-[var(--brand-primary,#2090FF)]" : "border-[#2C2C2A] bg-[#1A1A1A]"}`} style={{ backgroundColor: rememberMe ? "var(--brand-primary, #2090FF)" : "" }}>
                      {rememberMe && <svg className="w-3 h-3 text-[#0A0A0A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <span className="text-[13px] text-white">Remember me for <strong className="text-white">7 days</strong></span>
                </label>
                <SubmitBtn label="Activate Account" loadingLabel="Activating…" />
              </form>
              <div className="pt-6 text-center">
                <p className="text-[11px] text-[#2E2E2C]">© {new Date().getFullYear()} SUKI CRM. All rights reserved.</p>
              </div>
            </>
          )}

          {/* STAGE: PASSWORD LOGIN */}
          {stage === "password" && (
            <>
              <BackBtn onClick={() => { setStage("email"); setError(""); setPassword(""); }} />
              <div className="mb-6">
                <h2 className="text-white mb-2" style={{ fontSize: "18px", fontWeight: 400 }}>Welcome back</h2>
                <p className="text-[13px] text-white leading-[1.5]">Signing in as <span className="text-white">{email}</span></p>
              </div>
              <ErrorBox />
              <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="login-password" className="text-[11px] font-medium text-white tracking-[0.08em] uppercase">Password</label>
                    <Link href="/forgot-password" className="text-[13px] transition-colors" style={{ color: "var(--brand-primary, #2090FF)" }}>Forgot?</Link>
                  </div>
                  <div className="relative">
                    <input id="login-password" type={showPassword ? "text" : "password"} required autoFocus value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={`${inputClass} pr-12 font-mono tracking-widest`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5F5E5A] hover:text-white transition-colors"><EyeIcon visible={showPassword} /></button>
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                    <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${rememberMe ? "border-[var(--brand-primary,#2090FF)]" : "border-[#2C2C2A] bg-[#1A1A1A]"}`} style={{ backgroundColor: rememberMe ? "var(--brand-primary, #2090FF)" : "" }}>
                      {rememberMe && <svg className="w-3 h-3 text-[#0A0A0A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <span className="text-[13px] text-white">Remember me for <strong className="text-white">7 days</strong></span>
                </label>
                <SubmitBtn label="Sign In" loadingLabel="Authenticating…" />
              </form>
              <div className="pt-6 text-center">
                <p className="text-[11px] text-[#2E2E2C]">© {new Date().getFullYear()} SUKI CRM. All rights reserved.</p>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0D0D0D" }}>
        <div className="w-8 h-8 border-2 border-[#0A0A0A]/20 border-t-[#0A0A0A] rounded-full animate-spin" />
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
