"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetLink } from "@/app/actions/auth";

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await sendPasswordResetLink(email.trim());
    setLoading(false);
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f9fb] p-6 font-sans">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Suki CRM" className="w-[60px] h-[60px] object-contain" />
        </div>

        <div className="bg-white rounded-[16px] border border-[#e2e8f0] shadow-[0px_2px_8px_rgba(11,31,58,0.06)] px-8 py-10 sm:px-12 sm:py-12">
          {!sent ? (
            <>
              <div className="mb-8">
                <h1 className="text-[24px] font-semibold text-[#191c1e] mb-2 tracking-[-0.01em]">Forgot your password?</h1>
                <p className="text-[14px] text-[#44474d] leading-[20px]">
                  Enter your registered email address and we&apos;ll send you a secure link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="reset-email" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
                        <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </span>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-11 pr-4 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3.5 px-6 rounded-[8px] bg-[#0b1f3a] hover:bg-[#152e52] text-white text-[14px] font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Spinner />Sending Reset Link…</>
                  ) : (
                    <>Send Reset Link
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#e6f4ea] flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-[22px] font-semibold text-[#191c1e] mb-3 tracking-[-0.01em]">Check your inbox</h2>
              <p className="text-[14px] text-[#44474d] leading-[22px] mb-6">
                If <strong className="text-[#191c1e]">{email}</strong> is registered with Suki CRM, a password reset link has been sent. The link expires in <strong>1 hour</strong>.
              </p>
              <p className="text-[13px] text-[#75777e]">Didn&apos;t receive it? Check your spam folder or</p>
              <button onClick={() => setSent(false)} className="text-[13px] font-semibold text-[#0b1f3a] hover:underline mt-1">
                Try again
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#eceef0] text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#44474d] hover:text-[#0b1f3a] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
