"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { completeCustomerActivation } from "@/app/actions/auth";

function ActivateContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordsMatch = password !== "" && password === confirmPassword;

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Invalid Link</h1>
        <p className="text-slate-500 mb-6">The activation link is invalid or missing the security token.</p>
        <Link href="/login" className="px-6 py-2 bg-[#0D2137] text-white rounded-lg font-medium">Return to Login</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Account Activated!</h1>
        <p className="text-slate-500 mb-6">Your customer portal account is now active.</p>
        <Link href="/login" className="px-6 py-2 bg-[#0D2137] text-white rounded-lg font-medium inline-block hover:bg-[#1a365d] transition-colors">
          Sign In Now
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setError("");
    setLoading(true);
    const res = await completeCustomerActivation(token as string, password);
    setLoading(false);

    if (!res.success) {
      setError(res.message || "Failed to activate account.");
    } else {
      setSuccess(true);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Activate Your Account</h1>
      <p className="text-slate-500 mb-8">Set your password to access the Suki Software customer portal.</p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
          <input 
            type={showPassword ? "text" : "password"} 
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className={`w-full px-4 py-3 rounded-xl border bg-slate-50 focus:outline-none focus:ring-2 transition-colors ${confirmPassword ? (passwordsMatch ? "border-emerald-500 focus:ring-emerald-500/30" : "border-red-500 focus:ring-red-500/30") : "border-slate-200 focus:ring-blue-500/30"}`}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !password || !confirmPassword}
          className="w-full py-3 bg-[#0D2137] hover:bg-[#1a365d] text-white rounded-xl font-semibold transition-colors disabled:opacity-70 flex items-center justify-center"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : "Activate & Set Password"}
        </button>
      </form>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <Suspense fallback={<div className="flex justify-center"><svg className="animate-spin h-8 w-8 text-[#0D2137]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>}>
          <ActivateContent />
        </Suspense>
      </div>
    </main>
  );
}
