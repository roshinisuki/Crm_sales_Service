"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { activateAccountAction } from "@/app/actions/auth";

function Spinner({ small }: { small?: boolean }) {
  return (
    <svg className={`animate-spin text-white ${small ? "h-4 w-4" : "h-6 w-6"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function getStrength(p: string) {
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

function ActivateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strength = getStrength(password);
  const passwordsMatch = password !== "" && password === confirmPassword;

  // Validate the token by attempting a dry-run (we validate JWT on submit;
  // here we just check if the token string looks plausible)
  const validate = useCallback(async () => {
    if (!token) {
      setTokenError("No activation token found in this link. Please request a new invitation.");
      setValidating(false);
      return;
    }
    // Quick client-side sanity check — real validation happens on submit
    // We decode the JWT payload to check the `purpose` field
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("bad format");
      const decoded = JSON.parse(atob(parts[1]));
      if (decoded.purpose !== "ACCOUNT_ACTIVATION") throw new Error("wrong purpose");
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        setTokenError("This activation link has expired. Please contact your administrator for a new invitation.");
        setValidating(false);
        return;
      }
      setTokenValid(true);
    } catch {
      setTokenError("This activation link is invalid or has already been used.");
    }
    setValidating(false);
  }, [token]);

  useEffect(() => { validate(); }, [validate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) { setError("Passwords do not match."); return; }
    if (strength.level < 2) { setError("Password is too weak. Use at least 8 characters with uppercase and a number."); return; }
    setError(""); setLoading(true);
    const res = await activateAccountAction(token, password);
    setLoading(false);
    if (!res.success) { setError(res.message); return; }
    setSuccess(true);
    setTimeout(() => router.push("/login?activated=true"), 2500);
  }

  if (validating) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 rounded-full bg-[#0b1f3a] flex items-center justify-center">
          <Spinner />
        </div>
        <p className="text-[14px] text-[#44474d]">Validating your activation link…</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-[#ffdad6] flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#ba1a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-[20px] font-semibold text-[#191c1e] mb-2">Link Invalid or Expired</h2>
        <p className="text-[14px] text-[#44474d] leading-[22px] mb-6">{tokenError}</p>
        <div className="mt-5">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#44474d] hover:text-[#0b1f3a] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-[#e6f4ea] flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-[22px] font-semibold text-[#191c1e] mb-2">Account Activated!</h2>
        <p className="text-[14px] text-[#44474d]">Your password has been set. Redirecting to login…</p>
        <div className="flex justify-center mt-4">
          <div className="w-8 h-8 rounded-full bg-[#0b1f3a] flex items-center justify-center">
            <Spinner small />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold text-[#191c1e] mb-2 tracking-[-0.01em]">Activate your account</h1>
        <p className="text-[14px] text-[#44474d] leading-[20px]">
          Choose a strong password to secure your Suki CRM account. You only need to do this once.
        </p>
      </div>

      {/* Password requirements hint */}
      <div className="mb-5 p-3 rounded-[8px] bg-[#f0f4ff] border border-[#d0daf7] text-[12px] text-[#455f87] leading-[20px]">
        Password must be <strong>8+ characters</strong> with at least one <strong>uppercase letter</strong>, one <strong>number</strong>, and one <strong>special character</strong> (!@#$%^&*).
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* New Password */}
        <div>
          <label htmlFor="activate-password" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">New Password</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input id="activate-password" type={showPassword ? "text" : "password"} required autoFocus value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, A-Z, 0-9, !@#$"
              className="w-full pl-11 pr-12 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777e] hover:text-[#191c1e]">
              <EyeIcon visible={showPassword} />
            </button>
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

        {/* Confirm Password */}
        <div>
          <label htmlFor="activate-confirm" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">Confirm Password</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input id="activate-confirm" type={showConfirm ? "text" : "password"} required value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password"
              className={`w-full pl-11 pr-12 py-3 rounded-[8px] border bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:ring-2 transition-all ${confirmPassword ? (passwordsMatch ? "border-[#2e7d32] focus:border-[#2e7d32] focus:ring-[#2e7d32]/20" : "border-[#ba1a1a] focus:border-[#ba1a1a] focus:ring-[#ba1a1a]/20") : "border-[#e2e8f0] focus:border-[#0b1f3a] focus:ring-[#0b1f3a]/20"}`} />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777e] hover:text-[#191c1e]">
              <EyeIcon visible={showConfirm} />
            </button>
          </div>
          {confirmPassword && (
            <p className={`mt-1.5 text-[12px] font-medium ${passwordsMatch ? "text-[#2e7d32]" : "text-[#ba1a1a]"}`}>
              {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
            </p>
          )}
        </div>

        <button type="submit" disabled={loading || !passwordsMatch || strength.level < 2}
          className="w-full mt-4 py-3.5 px-6 rounded-[8px] bg-[#0b1f3a] hover:bg-[#152e52] text-white text-[14px] font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? <><Spinner small />Activating Account…</> : <>Activate My Account <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[#eceef0] text-center">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#44474d] hover:text-[#0b1f3a] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to Login
        </Link>
      </div>
    </>
  );
}

export default function ActivateAccountPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f9fb] p-6 font-sans">
      <div className="w-full max-w-[440px]">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Suki CRM" className="w-[60px] h-[60px] object-contain" />
        </div>
        <div className="bg-white rounded-[16px] border border-[#e2e8f0] shadow-[0px_2px_8px_rgba(11,31,58,0.06)] px-8 py-10 sm:px-12 sm:py-12">
          <Suspense fallback={
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-[#0b1f3a] flex items-center justify-center">
                <Spinner />
              </div>
              <p className="text-[14px] text-[#44474d]">Loading…</p>
            </div>
          }>
            <ActivateForm />
          </Suspense>
        </div>
        <p className="text-center text-[12px] text-[#75777e] mt-6">
          © {new Date().getFullYear()} Suki Software Pvt. Ltd.
        </p>
      </div>
    </main>
  );
}
