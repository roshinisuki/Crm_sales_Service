"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  save: "M5 13l4 4L19 7",
  bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
};

const rules = [
  {
    key: "quotation_sent",
    label: "Quotation Sent",
    description: "Notify when a quotation is sent to customer",
    events: ["email_customer", "whatsapp_customer", "notify_salesmanager"],
  },
  {
    key: "po_created",
    label: "Purchase Order Created",
    description: "Notify when a PO is created from a deal",
    events: ["email_customer", "notify_admin", "notify_salesmanager"],
  },
  {
    key: "po_approved",
    label: "PO Approved",
    description: "Notify when a PO is approved",
    events: ["email_customer", "whatsapp_customer"],
  },
  {
    key: "negotiation_completed",
    label: "Negotiation Completed",
    description: "Notify when a negotiation is finalized",
    events: ["email_customer", "notify_salesmanager"],
  },
  {
    key: "sample_dispatched",
    label: "Sample Dispatched",
    description: "Notify when a sample is dispatched",
    events: ["email_customer", "whatsapp_customer", "notify_sales_executive"],
  },
  {
    key: "discount_approval_required",
    label: "Discount Approval Required",
    description: "Notify managers when discount approval is needed",
    events: ["notify_salesmanager", "notify_admin"],
  },
  {
    key: "approval_decision",
    label: "Approval Decision",
    description: "Notify the requester when their approval is decided",
    events: ["email_requester"],
  },
];

const eventLabels: Record<string, string> = {
  email_customer: "Email Customer",
  whatsapp_customer: "WhatsApp Customer",
  notify_admin: "Notify Admin",
  notify_salesmanager: "Notify Sales Manager",
  notify_sales_executive: "Notify Sales Executive",
  email_requester: "Email Requester",
};

export default function NotificationRulesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-configs");
      const data = await res.json();
      if (data.success) {
        const map: Record<string, string> = {};
        (data.data || []).forEach((c: any) => { map[c.key] = c.value; });
        setConfig(map);
      }
    } catch {
      toast.error("Failed to load notification rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, []);

  const isEnabled = (ruleKey: string, eventKey: string) => {
    const key = `notif_${ruleKey}_${eventKey}`;
    return config[key] === "true";
  };

  const toggle = (ruleKey: string, eventKey: string) => {
    const key = `notif_${ruleKey}_${eventKey}`;
    setConfig(c => ({ ...c, [key]: c[key] === "true" ? "false" : "true" }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { key: string; value: string }[] = [];
      rules.forEach(r => {
        r.events.forEach(e => {
          const key = `notif_${r.key}_${e}`;
          updates.push({ key, value: config[key] === "true" ? "true" : "false" });
        });
      });

      const res = await fetch("/api/system-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Notification rules saved");
      } else {
        toast.error(data.message || "Failed to save");
      }
    } catch {
      toast.error("Failed to save notification rules");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="text-center py-12 text-gray-400">Loading notification rules...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <Ico d={icons.back} size={16} /> Back to Settings
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure which notifications are sent for each business event</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          <Ico d={icons.save} size={16} /> {saving ? "Saving..." : "Save Rules"}
        </button>
      </div>

      <div className="space-y-3">
        {rules.map(r => (
          <div key={r.key} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Ico d={icons.bell} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{r.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5 mb-3">{r.description}</p>
                <div className="flex flex-wrap gap-2">
                  {r.events.map(e => (
                    <button
                      key={e}
                      onClick={() => toggle(r.key, e)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        isEnabled(r.key, e)
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {eventLabels[e] || e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
