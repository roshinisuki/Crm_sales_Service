"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { PageShell } from "@/components/ui/PageShell";
import { getSystemConfigsAction, updateSystemConfigsAction } from "@/app/actions/systemConfigs";
import { getCurrencySettingsAction, updatePreferredCurrencyAction, updateBaseCurrencyAction, refreshRatesAction, getExchangeRatesAction } from "@/app/actions/currency";
import { getUsersAction } from "@/app/actions/users";
import { updateCompanyVariantAction } from "@/app/actions/auth";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check: "M5 13l4 4L19 7",
};

interface ToggleProps { label: string; description?: string; checked?: boolean; onChange?: (checked: boolean) => void; defaultChecked?: boolean }
function Toggle({ label, description, checked: controlledChecked, onChange, defaultChecked }: ToggleProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked;
  const handleToggle = () => {
    if (onChange) onChange(!isChecked);
    else setInternalChecked(!isChecked);
  };
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={handleToggle}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none cursor-pointer ${isChecked ? "bg-[var(--primary)]" : "bg-slate-200"}`}
        aria-checked={isChecked}
        role="switch"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${isChecked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

interface CardProps { title: string; icon: string; children: React.ReactNode }
function Card({ title, icon, children }: CardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
          <Ico d={icon} size={16} className="text-slate-600" />
        </div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [prefs, setPrefs] = useState({
    emailFollowUp: true,
    emailVisitorCheckIn: false,
    inAppVisitUpdate: true,
    notifyOnDealStatus: true,
    notifyOnCallLog: true
  });

  const [companyVariant, setCompanyVariant] = useState<number>(user?.company?.variant || user?.variant || 1);
  const [updatingVariant, setUpdatingVariant] = useState(false);

  // Lead Ingestion configurations states
  const [users, setUsers] = useState<any[]>([]);
  const [leadsApiKey, setLeadsApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [leadsAssignmentMode, setLeadsAssignmentMode] = useState("ROUND_ROBIN");
  const [leadsDefaultAssigneeId, setLeadsDefaultAssigneeId] = useState("");
  const [savingLeads, setSavingLeads] = useState(false);

  // Currency settings
  const [preferredCurrency, setPreferredCurrency] = useState("INR");
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [refreshingRates, setRefreshingRates] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const apiUrl = `${origin}/api/leads`;

  const codeSnippet = `<!-- Suki CRM Lead Ingestion Snippet -->
<form id="suki-lead-form" style="max-width: 400px; font-family: sans-serif; display: flex; flex-direction: column; gap: 12px;">
  <div>
    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Full Name *</label>
    <input type="text" name="name" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;" />
  </div>
  <div>
    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Email Address</label>
    <input type="email" name="email" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;" />
  </div>
  <div>
    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Phone Number</label>
    <input type="tel" name="phone" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;" />
  </div>
  <div>
    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">City</label>
    <input type="text" name="city" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;" />
  </div>
  <div>
    <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Message</label>
    <textarea name="message" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; min-height: 80px;"></textarea>
  </div>
  <button type="submit" style="background: #D44D4D; color: white; padding: 10px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
    Submit Enquiry
  </button>
</form>

<script>
  document.getElementById('suki-lead-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      city: formData.get('city'),
      message: formData.get('message'),
      leadSource: 'Website'
    };

    try {
      const response = await fetch('${apiUrl}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '${leadsApiKey || "YOUR_API_KEY"}'
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.success) {
        alert('Thank you! Your enquiry has been received.');
        e.target.reset();
      } else {
        alert('Submission failed: ' + result.message);
      }
    } catch (err) {
      console.error('Error submitting lead:', err);
      alert('Could not submit enquiry. Please try again.');
    }
  });
</script>`;
  
  useEffect(() => {
    // Load active users for default assignee dropdown
    getUsersAction().then((res) => {
      if (res.success && res.data) {
        setUsers(res.data.filter((u: any) => u.isActive));
      }
    });

    // Load system configurations
    getSystemConfigsAction().then((res) => {
      if (res.success && res.data) {
        setLeadsApiKey(res.data.leads_api_key);
        setLeadsAssignmentMode(res.data.leads_assignment_mode);
        setLeadsDefaultAssigneeId(res.data.leads_default_assignee_id);
      }
    });

    // Load currency settings
    getCurrencySettingsAction().then((res) => {
      if (res.success && res.data) {
        setPreferredCurrency(res.data.preferredCurrency);
        setBaseCurrency(res.data.baseCurrency);
      }
    });
    getExchangeRatesAction().then((res) => {
      if (res.success && res.data) setExchangeRates(res.data);
    });
  }, []);

  const handleSaveCurrency = async () => {
    setSavingCurrency(true);
    try {
      const res = await updatePreferredCurrencyAction(preferredCurrency);
      if (res.success) {
        toast.success("Currency preference saved. All amounts will now display in " + preferredCurrency + ".");
      } else {
        toast.error(res.message || "Failed to save currency preference.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleSaveBaseCurrency = async () => {
    setSavingCurrency(true);
    try {
      const res = await updateBaseCurrencyAction(baseCurrency);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message || "Failed to update base currency.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleRefreshRates = async () => {
    setRefreshingRates(true);
    try {
      const res = await refreshRatesAction(baseCurrency);
      if (res.success) {
        toast.success("Exchange rates refreshed successfully.");
        setExchangeRates(res.data || []);
      } else {
        toast.error(res.message || "Failed to refresh rates.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setRefreshingRates(false);
    }
  };

  const handleSaveLeadsConfig = async () => {
    setSavingLeads(true);
    try {
      const res = await updateSystemConfigsAction({
        leads_api_key: leadsApiKey,
        leads_assignment_mode: leadsAssignmentMode,
        leads_default_assignee_id: leadsDefaultAssigneeId,
      });
      if (res.success) {
        toast.success("Lead API configurations updated successfully.");
      } else {
        toast.error(res.message || "Failed to update API configurations.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setSavingLeads(false);
    }
  };

  const handleRegenerateApiKey = () => {
    if (confirm("Are you sure you want to regenerate the API key? External forms using the old key will stop working.")) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let key = "suki_";
      for (let i = 0; i < 24; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setLeadsApiKey(key);
      toast.info("New key generated. Please save preferences to apply changes.");
    }
  };
  
  useEffect(() => {
    if (!authLoading && user) {
      fetch("/api/notification-preferences")
        .then(res => res.json())
        .then(res => {
          if (res.success && res.data) {
            setPrefs({
              emailFollowUp: res.data.emailFollowUp,
              emailVisitorCheckIn: res.data.emailVisitorCheckIn,
              inAppVisitUpdate: res.data.inAppVisitUpdate,
              notifyOnDealStatus: res.data.notifyOnDealStatus,
              notifyOnCallLog: res.data.notifyOnCallLog
            });
          }
        })
        .catch(console.error);
    }
  }, [user, authLoading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs)
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Settings saved successfully.");
      } else {
        toast.error("Failed to save settings.");
      }
    } catch (err) {
      toast.error("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const calculateStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    return score;
  };
  
  const pwScore = calculateStrength(pwForm.next);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    
    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords do not match."); return; }
    if (pwScore < 3) { setPwError("Password must be at least 8 characters, 1 uppercase, and 1 number."); return; }
    
    setPwLoading(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next })
      });
      const data = await res.json();
      
      if (data.success) {
        setPwSuccess("Password updated successfully.");
        setPwForm({ current: "", next: "", confirm: "" });
      } else {
        setPwError(data.message || "Failed to update password.");
      }
    } catch (err) {
      setPwError("An error occurred. Please try again.");
    } finally {
      setPwLoading(false);
    }
  };

  const canAccessSettings = user?.role === "Admin" || user?.role === "SalesManager";

  useEffect(() => {
    if (!authLoading && !canAccessSettings) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router, canAccessSettings]);

  useEffect(() => {
    if (user?.company?.variant) {
      setCompanyVariant(user.company.variant);
    } else if (user?.variant) {
      setCompanyVariant(user.variant);
    }
  }, [user?.company?.variant, user?.variant]);

  const handleUpdateVariant = async (variant: number) => {
    setUpdatingVariant(true);
    try {
      const res = await updateCompanyVariantAction(variant);
      if (res.success) {
        toast.success(res.message);
        setCompanyVariant(variant);
        // Reload the page to apply new variant to sidebar
        window.location.reload();
      } else {
        toast.error(res.message || "Failed to switch variant");
      }
    } catch (err) {
      toast.error("An error occurred while switching variant");
    } finally {
      setUpdatingVariant(false);
    }
  };

  if (authLoading || !canAccessSettings) return null;

  return (
    <PageShell
      title="Settings"
      subtitle="Manage system preferences, security, and notification options."
    >
      <PageContainer className="space-y-4 p-0">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* General Settings */}
        <Card title="General" icon={icons.settings}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Organisation Name</label>
              <input
                type="text"
                defaultValue=" SUKI  Software Pvt. Ltd."
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Default Timezone</label>
              <select className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer">
                <option>Asia/Kolkata (IST +5:30)</option>
                <option>UTC+0 (GMT)</option>
                <option>America/New_York (EST)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Currency Display</label>
              <select
                value={preferredCurrency}
                onChange={e => setPreferredCurrency(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
              <button
                onClick={handleSaveCurrency}
                disabled={savingCurrency}
                className="mt-2 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {savingCurrency ? "Saving..." : "Save Currency"}
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">CRM Variant</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((v) => (
                  <button
                    key={v}
                    onClick={() => handleUpdateVariant(v)}
                    disabled={updatingVariant || companyVariant === v}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      companyVariant === v
                        ? "bg-[var(--primary)] text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    } disabled:opacity-70`}
                  >
                    Variant {v}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Switching reloads the page and changes the sidebar modules.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-70 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </Card>

        {/* Security */}
        <Card title="Change Password" icon={icons.lock}>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {pwError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
                {pwSuccess}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Password</label>
              <input
                type="password"
                required
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
              <input
                type="password"
                required
                value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
              <div className="flex items-center gap-2 mt-2">
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${pwScore >= 1 ? (pwScore >= 3 ? 'bg-emerald-500' : pwScore >= 2 ? 'bg-amber-400' : 'bg-red-400') : 'bg-slate-200'}`} />
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${pwScore >= 2 ? (pwScore >= 3 ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-slate-200'}`} />
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${pwScore >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-12 text-right">
                  {pwScore === 0 ? "None" : pwScore === 1 ? "Weak" : pwScore === 2 ? "Medium" : "Strong"}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                placeholder="Repeat new password"
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-70 cursor-pointer"
            >
              {pwLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </Card>

        {/* Notifications */}
        <Card title="Notifications" icon={icons.bell}>
          <Toggle 
            label="Email Alerts" 
            description="Receive email on follow-up reminders and overdue tasks." 
            checked={prefs.emailFollowUp} 
            onChange={(c) => setPrefs(p => ({ ...p, emailFollowUp: c }))} 
          />
          <Toggle 
            label="New Visitor Check-in" 
            description="Alert on every new office visitor check-in." 
            checked={prefs.emailVisitorCheckIn} 
            onChange={(c) => setPrefs(p => ({ ...p, emailVisitorCheckIn: c }))} 
          />
          <Toggle 
            label="In-App Visit Updates" 
            description="Receive in-app alerts for visit updates." 
            checked={prefs.inAppVisitUpdate} 
            onChange={(c) => setPrefs(p => ({ ...p, inAppVisitUpdate: c }))} 
          />
          <Toggle 
            label="Deal Status Updates" 
            description="Receive alerts on deal assignment, creation, and status progression." 
            checked={prefs.notifyOnDealStatus} 
            onChange={(c) => setPrefs(p => ({ ...p, notifyOnDealStatus: c }))} 
          />
          <Toggle 
            label="Call Logging Alerts" 
            description="Receive alerts when new calls are logged with customers." 
            checked={prefs.notifyOnCallLog} 
            onChange={(c) => setPrefs(p => ({ ...p, notifyOnCallLog: c }))} 
          />
        </Card>

        {/* Compliance & Privacy */}
        <Card title="Compliance & Privacy" icon={icons.shield}>
          <Toggle label="Require GPS for Check-in" description="Marketing executives must share location on field visits." defaultChecked={true} />
          <Toggle label="Log All API Actions" description="Record every data-modification action in the audit log." defaultChecked={true} />
          <Toggle label="Restrict Admin Features" description="Limit User Master & Audit Log to Admin role only." defaultChecked={true} />
          <Toggle label="Two-Factor Authentication" description="Require 2FA for all Admin role accounts." defaultChecked={false} />
          <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-xs font-bold text-amber-900">Data Retention Policy</p>
            <p className="text-[11px] text-amber-700 mt-1">Audit logs are retained for 90 days. Contact your administrator to configure custom retention policies.</p>
          </div>
        </Card>

        {/* Lead Ingestion API & Auto-Assignment Configs */}
        <Card title="Lead Ingestion API & Auto-Assignment" icon={icons.shield}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">API Endpoint URL</label>
              <input
                type="text"
                readOnly
                value={apiUrl}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 font-mono select-all focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">API Key (LEADS_API_KEY)</label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={leadsApiKey}
                  onChange={(e) => setLeadsApiKey(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateApiKey}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Regen
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Auto-Assignment Mode</label>
              <select
                value={leadsAssignmentMode}
                onChange={(e) => setLeadsAssignmentMode(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
              >
                <option value="ROUND_ROBIN">Round-Robin Assignment (Balanced Load)</option>
                <option value="DEFAULT_POOL">Triage Pool (Assign to Default User)</option>
              </select>
            </div>

            {leadsAssignmentMode === "DEFAULT_POOL" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Default Assignee</label>
                <select
                  value={leadsDefaultAssigneeId}
                  onChange={(e) => setLeadsDefaultAssigneeId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                >
                  <option value="">-- Select default triage assignee --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleSaveLeadsConfig}
              disabled={savingLeads}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-70 cursor-pointer"
            >
              {savingLeads ? "Saving API Settings..." : "Save API & Assignment Config"}
            </button>

            {/* Widget Copy Code block */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700">Web Form Integration Widget</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(codeSnippet);
                    toast.success("Widget code copied to clipboard!");
                  }}
                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[var(--primary)] border border-red-200/60 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Copy Snippet
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                Copy and paste this HTML form and script block into your company's landing page or external website.
              </p>
              <textarea
                readOnly
                value={codeSnippet}
                className="w-full h-32 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono focus:outline-none"
              />
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
    </PageShell>
  );
}
