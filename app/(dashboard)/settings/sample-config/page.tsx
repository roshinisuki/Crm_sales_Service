"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import PageContainer from "@/components/PageContainer";
import { Save, FlaskConical } from "lucide-react";

export default function SampleConfigSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    autoGenerateCode: true,
    codePrefix: "SMP",
    codeStartNumber: 1,
    defaultStatus: "New",
    requireProductLink: false,
    requireRfqLink: false,
    enableFeedbackModal: true,
    enableRevisionWorkflow: true,
    notifyOnApproval: true,
    notifyOnRejection: true,
    notifyOnRevision: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-configs");
      const data = await res.json();
      if (data.success) {
        const found = data.data.find((c: any) => c.key === "sampleConfig");
        if (found) {
          setConfig(JSON.parse(found.value));
        }
      }
    } catch {
      toast.error("Failed to load sample configuration");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/system-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ key: "sampleConfig", value: JSON.stringify(config) }],
        }),
      });
      const data = await res.json();
      if (data.success) toast.success("Sample configuration saved");
      else toast.error(data.message || "Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FlaskConical size={24} className="text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900">Sample Configuration</h1>
        </div>
        <p className="text-slate-500">Configure sample management workflow, auto-coding, and notification preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Auto-coding */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Auto-Coding</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Auto-Generate Code</label>
              <select
                value={config.autoGenerateCode ? "true" : "false"}
                onChange={(e) => update("autoGenerateCode", e.target.value === "true")}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Code Prefix</label>
              <input
                type="text"
                value={config.codePrefix}
                onChange={(e) => update("codePrefix", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Start Number</label>
              <input
                type="number"
                value={config.codeStartNumber}
                onChange={(e) => update("codeStartNumber", parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>
        </div>

        {/* Workflow */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Workflow Settings</h2>
          <div className="space-y-3">
            {[
              { key: "requireProductLink", label: "Require product link on sample creation" },
              { key: "requireRfqLink", label: "Require RFQ link on sample creation" },
              { key: "enableFeedbackModal", label: "Enable customer feedback modal" },
              { key: "enableRevisionWorkflow", label: "Enable revision workflow (Revision status)" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(config as any)[item.key]}
                  onChange={(e) => update(item.key, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/20"
                />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Notification Preferences</h2>
          <div className="space-y-3">
            {[
              { key: "notifyOnApproval", label: "Notify when sample is approved" },
              { key: "notifyOnRejection", label: "Notify when sample is rejected" },
              { key: "notifyOnRevision", label: "Notify when sample is sent for revision" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(config as any)[item.key]}
                  onChange={(e) => update(item.key, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]/20"
                />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
