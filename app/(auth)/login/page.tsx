"use client";

import { useState, useRef, useEffect } from "react";
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

// ── Icons ───────────────────────────────────────────────────────────────────
function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
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
    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
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
  return { level: score, label: "Strong", color: "#1565c0" };
}

// ── Inactivity Timeout ───────────────────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function useInactivityLogout(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: NodeJS.Timeout;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Clear cookie by navigating to login with timeout param
        window.location.href = "/login?reason=timeout";
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // start timer

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [enabled]);
}

// ── Left Panel ────────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex w-1/2 bg-black flex-col justify-center items-center p-12 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.03)_0%,transparent_80%)]" />
      <div className="relative z-10 max-w-md flex flex-col items-center">
        <img src="/logo.png" alt="SUKI CRM" className="w-[144px] h-[144px] object-contain mb-10" />
        <h1 className="text-[40px] font-semibold text-white mb-6 leading-[1.15] tracking-tight">Welcome to<br /> SUKI  CRM</h1>
        <p className="text-[#7587a7] text-base leading-[24px] mb-12 font-medium">
          Secure access to your customer ecosystem. Manage relationships, analyze data, and grow your brand with enterprise-grade precision.
        </p>
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.03]">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[13px] font-semibold text-white/90">Enterprise-grade secure authentication</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
type Stage = "email" | "otp" | "setPassword" | "password";

function LoginContent() {
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
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Inactivity auto-logout — only active after login (stage won't be email on dashboard)
  // We attach it here but it only fires after 30min of no activity
  useInactivityLogout(false); // enabled=false on login page itself — runs on dashboard via layout

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
      window.location.href = res.redirectUrl;
    } else if (res && !res.success) { 
      setError(res.message ?? "Login failed."); 
    }
  }

  // ── Shared UI pieces ──
  const ErrorBox = () => error ? (
    <div className="mb-5 p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">{error}</div>
  ) : null;

  const InfoBox = () => info ? (
    <div className="mb-5 p-3 rounded-[8px] bg-[#e6f4ea] border border-[#a8d5b0] text-[13px] text-[#2e7d32] font-medium text-center">{info}</div>
  ) : null;

  const SubmitBtn = ({ label, loadingLabel }: { label: string; loadingLabel: string }) => (
    <button type="submit" disabled={loading}
      className="w-full mt-4 py-3.5 px-6 rounded-[8px] bg-[#C2601A] hover:bg-[#A84F16] text-black text-[14px] font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
      {loading ? <><Spinner />{loadingLabel}</> : <>{label}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>}
    </button>
  );

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen flex bg-[#f7f9fb] font-sans">
      <LeftPanel />

      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[460px]">

          {/* ── Success Banner (after password reset) ── */}
          {resetSuccess && (
            <div className="mb-6 p-4 rounded-[10px] bg-[#e6f4ea] border border-[#a8d5b0] flex items-center gap-3">
              <CheckIcon />
              <div>
                <p className="text-[13px] font-semibold text-[#2e7d32]">Password updated successfully</p>
                <p className="text-[12px] text-[#2e7d32]/80">You can now sign in with your new password.</p>
              </div>
            </div>
          )}

          {/* ── Account Activated Banner ── */}
          {activated && (
            <div className="mb-6 p-4 rounded-[10px] bg-[#e6f4ea] border border-[#a8d5b0] flex items-center gap-3">
              <CheckIcon />
              <div>
                <p className="text-[13px] font-semibold text-[#2e7d32]">Account activated successfully!</p>
                <p className="text-[12px] text-[#2e7d32]/80">Welcome to  SUKI  CRM. Sign in with your email and new password.</p>
              </div>
            </div>
          )}

          {/* ── Timeout Banner ── */}
          {timedOut && (
            <div className="mb-6 p-4 rounded-[10px] bg-[#fff8e1] border border-[#ffe082] flex items-center gap-3">
              <svg className="w-4 h-4 text-[#f59e0b] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-[13px] font-semibold text-[#92400e]">Session expired</p>
                <p className="text-[12px] text-[#92400e]/80">You were logged out due to 30 minutes of inactivity.</p>
              </div>
            </div>
          )}

          <div className="w-full bg-white rounded-[16px] border border-[#e2e8f0] shadow-[0px_2px_8px_rgba(11,31,58,0.06)] px-8 py-10 sm:px-12 sm:py-12">

            {/* ── STAGE: EMAIL ─────────────────────────────── */}
            {stage === "email" && (
              <>
                <div className="mb-8">
                  <h2 className="text-[24px] font-semibold text-[#191c1e] mb-2 tracking-[-0.01em]">Sign in to  SUKI  CRM</h2>
                  <p className="text-[14px] text-[#44474d] leading-[20px]">Enter your registered email address to continue.</p>
                </div>
                <ErrorBox />
                <form onSubmit={handleEmailSubmit} className="space-y-5" noValidate>
                  <div>
                    <label htmlFor="email" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">Email Address</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"><MailIcon /></span>
                      <input id="email" type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full pl-11 pr-4 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all" />
                    </div>
                  </div>
                  <SubmitBtn label="Continue" loadingLabel="Checking…" />
                </form>
              </>
            )}

            {/* ── STAGE: OTP ───────────────────────────────── */}
            {stage === "otp" && (
              <>
                <button onClick={() => { setStage("email"); setError(""); setInfo(""); }} className="flex items-center gap-1.5 text-[13px] text-[#44474d] hover:text-[#0b1f3a] mb-6 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <div className="mb-6">
                  <h2 className="text-[24px] font-semibold text-[#191c1e] mb-2 tracking-[-0.01em]">Verify your email</h2>
                  <p className="text-[14px] text-[#44474d] leading-[20px]">
                    We sent a 6-digit code to <strong className="text-[#191c1e]">{email}</strong>. Enter it below to activate your account.
                  </p>
                </div>
                <InfoBox />
                <ErrorBox />
                <div className="flex gap-3 justify-center mb-6">
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
                      className="w-12 h-14 text-center text-[22px] font-bold text-[#0b1f3a] rounded-[10px] border-2 border-[#e2e8f0] bg-white focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all font-mono"
                    />
                  ))}
                </div>
                <button onClick={handleVerifyOtp} disabled={loading || otp.some(d => d === "")}
                  className="w-full py-3.5 px-6 rounded-[8px] bg-[#0b1f3a] hover:bg-[#152e52] text-white text-[14px] font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? <><Spinner />Verifying…</> : "Verify Code"}
                </button>
                <div className="mt-5 text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-[13px] text-[#75777e]">Resend available in <span className="font-semibold text-[#0b1f3a]">{resendCooldown}s</span></p>
                  ) : (
                    <button onClick={handleSendOtp} disabled={loading} className="text-[13px] font-semibold text-[#0b1f3a] hover:underline disabled:opacity-50">
                      Resend Code
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── STAGE: SET PASSWORD (first login) ────────── */}
            {stage === "setPassword" && (
              <>
                <div className="mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#e6f4ea] flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h2 className="text-[24px] font-semibold text-[#191c1e] mb-2 tracking-[-0.01em]">Set your password</h2>
                  <p className="text-[14px] text-[#44474d] leading-[20px]">Create a strong password to secure your  SUKI  CRM account.</p>
                </div>
                <ErrorBox />
                <form onSubmit={handleSetPassword} className="space-y-5" noValidate>
                  <div>
                    <label htmlFor="new-password" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">New Password</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"><LockIcon /></span>
                      <input id="new-password" type={showPassword ? "text" : "password"} required autoFocus value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Min 8 chars, A-Z, 0-9, !@#$"
                        className="w-full pl-11 pr-12 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777e] hover:text-[#191c1e]"><EyeIcon visible={showPassword} /></button>
                    </div>
                    {password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map(l => (
                            <div key={l} className="h-1.5 flex-1 rounded-full transition-all" style={{ background: strength.level >= l ? strength.color : "#e0e3e5" }} />
                          ))}
                        </div>
                        <p className="text-[12px]" style={{ color: strength.color }}>Strength: <strong>{strength.label}</strong></p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">Confirm Password</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"><LockIcon /></span>
                      <input id="confirm-password" type={showConfirm ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className={`w-full pl-11 pr-12 py-3 rounded-[8px] border bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:ring-2 transition-all ${confirmPassword ? (passwordsMatch ? "border-[#2e7d32] focus:border-[#2e7d32] focus:ring-[#2e7d32]/20" : "border-[#ba1a1a] focus:border-[#ba1a1a] focus:ring-[#ba1a1a]/20") : "border-[#e2e8f0] focus:border-[#0b1f3a] focus:ring-[#0b1f3a]/20"}`} />
                      <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777e] hover:text-[#191c1e]"><EyeIcon visible={showConfirm} /></button>
                    </div>
                    {confirmPassword && (
                      <p className={`mt-1.5 text-[12px] font-medium ${passwordsMatch ? "text-[#2e7d32]" : "text-[#ba1a1a]"}`}>
                        {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                      </p>
                    )}
                  </div>
                  {/* Remember Me */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                      <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${rememberMe ? "bg-[#0b1f3a] border-[#0b1f3a]" : "border-[#c4c6ce] bg-white"}`}>
                        {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <span className="text-[13px] text-[#44474d]">Remember me for <strong className="text-[#191c1e]">7 days</strong></span>
                  </label>
                  <SubmitBtn label="Activate Account" loadingLabel="Activating…" />
                </form>
              </>
            )}

            {/* ── STAGE: NORMAL PASSWORD LOGIN ─────────────── */}
            {stage === "password" && (
              <>
                <button onClick={() => { setStage("email"); setError(""); setPassword(""); }} className="flex items-center gap-1.5 text-[13px] text-[#44474d] hover:text-[#0b1f3a] mb-6 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                  Back
                </button>
                <div className="mb-6">
                  <h2 className="text-[24px] font-semibold text-[#191c1e] mb-1 tracking-[-0.01em]">Welcome back</h2>
                  <p className="text-[14px] text-[#44474d]">Signing in as <strong className="text-[#191c1e]">{email}</strong></p>
                </div>
                <ErrorBox />
                <form onSubmit={handlePasswordLogin} className="space-y-5" noValidate>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="login-password" className="text-[12px] font-semibold text-[#191c1e] tracking-[0.05em] uppercase">Password</label>
                      <Link href="/forgot-password" className="text-[13px] font-medium text-[#44474d] hover:text-[#0b1f3a] transition-colors">Forgot Password?</Link>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"><LockIcon /></span>
                      <input id="login-password" type={showPassword ? "text" : "password"} required autoFocus value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-12 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all font-mono tracking-widest" />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777e] hover:text-[#191c1e] transition-colors"><EyeIcon visible={showPassword} /></button>
                    </div>
                  </div>
                  {/* Remember Me */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                      <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${rememberMe ? "bg-[#0b1f3a] border-[#0b1f3a]" : "border-[#c4c6ce] bg-white"}`}>
                        {rememberMe && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <span className="text-[13px] text-[#44474d]">Remember me for <strong className="text-[#191c1e]">7 days</strong></span>
                  </label>
                  <SubmitBtn label="Sign In" loadingLabel="Authenticating…" />
                </form>
              </>
            )}

            {/* ── Footer ───────────────────────────────────── */}
            {stage === "email" && (
              <div className="mt-8 pt-8 border-t border-[#eceef0] text-center space-y-2">
                <p className="text-[13px] text-[#44474d]">Need assistance or lost access?</p>
                <p className="text-[13px] font-semibold text-[#191c1e] mt-1">Contact IT Support</p>
              </div>
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
      <main className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
        <div className="w-8 h-8 border-4 border-[#0b1f3a] border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
