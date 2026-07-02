"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetLink } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await sendPasswordResetLink(email.trim());
    setLoading(false);
    if (!res.success) {
      setError(res.message || "Failed to send reset link.");
      return;
    }
    setSuccess(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f9fb] font-sans p-6">
      <div className="w-full max-w-[440px] bg-white rounded-[16px] border border-[#e2e8f0] shadow-[0px_2px_8px_rgba(11,31,58,0.06)] px-8 py-10 sm:px-12 sm:py-12">
        
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#f0f4ff] flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--brand-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3l8.44-8.44A6 6 0 0115 7h.01z" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-[24px] font-semibold text-[#191c1e] mb-2 tracking-[-0.01em]">Forgot Password</h2>
          <p className="text-[14px] text-[#44474d] leading-[20px]">
            {success ? "Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder." : "Enter your email address and we'll send you a link to reset your password."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">
            {error}
          </div>
        )}

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">Email Address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#75777e] pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                    <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input id="email" type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all" />
              </div>
            </div>

            <button type="submit" disabled={loading || !email}
              className="w-full py-3.5 px-6 rounded-[8px] bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-[14px] font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending…
                </>
              ) : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <div className="flex justify-center mt-6">
            <Link href="/login" className="py-3 px-6 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] font-semibold hover:bg-[#f8fafc] transition-colors">
              Return to Login
            </Link>
          </div>
        )}

        {!success && (
          <div className="mt-8 text-center">
            <Link href="/login" className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#44474d] hover:text-[var(--brand-primary)] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Back to log in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
