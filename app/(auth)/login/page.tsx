"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ── Icons ────────────────────────────────────────────────────────────────────
function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#75777e]">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

// ── Left Panel ────────────────────────────────────────────────────────────────
function LeftPanel() {
  return (
    <div className="hidden lg:flex w-1/2 bg-[#0b1f3a] flex-col justify-center items-center p-12 text-center relative overflow-hidden">
      {/* Background radial gradient for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.03)_0%,transparent_80%)]" />

      <div className="relative z-10 max-w-md flex flex-col items-center">
        {/* Brand Logo */}
        <img src="/logo.png" alt="Suki CRM Logo" className="w-[88px] h-[88px] object-contain mb-10" />

        <h1 className="text-[40px] font-semibold text-white mb-6 leading-[1.15] tracking-tight font-sans">
          Welcome to<br />Suki CRM
        </h1>
        <p className="text-[#7587a7] text-base leading-[24px] mb-12 font-medium">
          Secure access to your customer ecosystem. Manage relationships,
          analyze data, and grow your brand with enterprise-grade precision.
        </p>

        <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[13px] font-semibold text-white/90">Sign in with your official company email.</span>
        </div>
      </div>
    </div>
  );
}

// ── Auth Page ────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const router = useRouter();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "MarketingExecutive",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const endpoint = isLogin ? "/user/login" : "/user/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.message || "Authentication failed");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setErrorMsg("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex bg-[#f7f9fb] font-sans">
      <LeftPanel />

      <div className="flex flex-1 items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-[460px] flex flex-col items-center">
          
          {/* Card */}
          <div className="w-full bg-white rounded-[16px] border border-[#e2e8f0] shadow-[0px_2px_8px_rgba(11,31,58,0.04)] px-8 py-10 sm:px-12 sm:py-12 mb-8">
            <h2 className="text-[24px] font-semibold text-[#191c1e] mb-2 tracking-[-0.01em]">
              {isLogin ? "Internal Portal Login" : "Create Account"}
            </h2>
            <p className="text-[14px] text-[#44474d] mb-8 leading-[20px]">
              {isLogin ? "Enter your credentials to continue." : "Set up your workspace to get started."}
            </p>

            {errorMsg && (
              <div className="mb-6 p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              
              {!isLogin && (
                <>
                  <div>
                    <label htmlFor="name" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">Full Name</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"><UserIcon /></span>
                      <input id="name" type="text" required value={formData.name} onChange={handleChange} placeholder="John Doe" 
                             className="w-full pl-11 pr-4 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#75777e] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">Your Role</label>
                    <div className="relative">
                      <select id="role" required value={formData.role} onChange={handleChange} 
                              className="w-full px-4 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all appearance-none">
                        <option value="MarketingExecutive">Marketing Executive</option>
                        <option value="MarketingLead">Marketing Lead</option>
                        <option value="Admin">Admin</option>
                        <option value="Customer">Customer</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="email" className="block text-[12px] font-semibold text-[#191c1e] mb-2 tracking-[0.05em] uppercase">
                  {isLogin ? "Company Email" : "Email Address"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"><MailIcon /></span>
                  <input id="email" type="email" required value={formData.email} onChange={handleChange} placeholder="name@company.com" 
                         className="w-full pl-11 pr-4 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-[12px] font-semibold text-[#191c1e] tracking-[0.05em] uppercase">Password</label>
                  {isLogin && (
                    <a href="#" className="text-[13px] font-medium text-[#44474d] hover:text-[#0b1f3a] transition-colors">Forgot Password?</a>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"><LockIcon /></span>
                  <input id="password" type={showPassword ? "text" : "password"} required value={formData.password} onChange={handleChange} placeholder="••••••••" 
                         className="w-full pl-11 pr-12 py-3 rounded-[8px] border border-[#e2e8f0] bg-white text-[#191c1e] text-[14px] placeholder:text-[#c4c6ce] tracking-widest focus:outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-[#0b1f3a]/20 transition-all font-mono" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#75777e] hover:text-[#191c1e] transition-colors">
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="remember" className="w-4 h-4 rounded-[4px] border-[#c4c6ce] text-[#0b1f3a] focus:ring-[#0b1f3a]" />
                  <label htmlFor="remember" className="text-[13px] text-[#44474d] cursor-pointer">Keep me signed in for 30 days</label>
                </div>
              )}

              <button type="submit" disabled={loading} 
                      className="w-full mt-4 py-3.5 px-6 rounded-[8px] bg-[#0b1f3a] hover:bg-[#152e52] text-white text-[14px] font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? (
                  <><svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{isLogin ? "Authenticating…" : "Creating account…"}</>
                ) : (
                  <>
                    {isLogin ? "Login to Ecosystem" : "Create Account"} 
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>
            </form>

            {/* Support / Toggle Link */}
            <div className="mt-8 pt-8 border-t border-[#eceef0] text-center">
              <p className="text-[13px] text-[#44474d] mb-1">
                {isLogin ? "Need assistance or lost access?" : "Already have an account?"}
              </p>
              <button 
                onClick={() => { setIsLogin(!isLogin); setErrorMsg(""); }} 
                className="text-[13px] font-semibold text-[#191c1e] hover:text-[#0b1f3a] transition-colors"
              >
                {isLogin ? "Contact IT Support" : "Sign in to existing account"}
              </button>
            </div>
          </div>

          {/* Dots Indicator (Decorative) */}
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#e0e3e5]"></div>
            <div className="w-3 h-3 rounded-full bg-[#e0e3e5]"></div>
            <div className="w-3 h-3 rounded-full bg-[#e0e3e5]"></div>
          </div>
        </div>
      </div>
    </main>
  );
}
