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
};

const approvalTypes = [
  {
    key: "Discount",
    label: "Discount Approval",
    description: "Approve discounts on deals above a certain percentage",
    fields: [
      { key: "threshold_percent", label: "Discount % Threshold", type: "number", default: "10", help: "Discounts above this % require manager approval" },
      { key: "auto_approve_below", label: "Auto-approve below %", type: "number", default: "5", help: "Discounts below this % are auto-approved" },
    ],
  },
  {
    key: "Quotation",
    label: "Quotation Approval",
    description: "Approve quotations above a certain value",
    fields: [
      { key: "threshold_amount", label: "Amount Threshold (₹)", type: "number", default: "500000", help: "Quotations above this amount require approval" },
    ],
  },
  {
    key: "Negotiation",
    label: "Negotiation Approval",
    description: "Approve negotiation outcomes with price changes",
    fields: [
      { key: "threshold_change_percent", label: "Price Change % Threshold", type: "number", default: "15", help: "Price reductions above this % require approval" },
    ],
  },
  {
    key: "PO",
    label: "Purchase Order Approval",
    description: "Approve purchase orders before sending to ERP",
    fields: [
      { key: "threshold_amount", label: "PO Amount Threshold (₹)", type: "number", default: "1000000", help: "POs above this amount require approval" },
      { key: "require_all", label: "Require approval for all POs", type: "checkbox", default: "false", help: "If checked, all POs require approval regardless of amount" },
    ],
  },
];

const approverRoles = ["Admin", "SalesManager"];

export default function ApprovalMatrixPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approvers, setApprovers] = useState<Record<string, string[]>>({});

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-configs");
      const data = await res.json();
      if (data.success) {
        const map: Record<string, string> = {};
        (data.data || []).forEach((c: any) => { map[c.key] = c.value; });
        setConfig(map);
        // Parse approvers
        const ap: Record<string, string[]> = {};
        approvalTypes.forEach(t => {
          const key = `approval_matrix_${t.key}_approvers`;
          ap[t.key] = map[key] ? JSON.parse(map[key]) : ["SalesManager"];
        });
        setApprovers(ap);
      }
    } catch {
      toast.error("Failed to load approval matrix");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, []);

  const getConfigKey = (typeKey: string, fieldKey: string) => `approval_matrix_${typeKey}_${fieldKey}`;

  const handleFieldChange = (typeKey: string, fieldKey: string, value: string) => {
    setConfig(c => ({ ...c, [getConfigKey(typeKey, fieldKey)]: value }));
  };

  const toggleApprover = (typeKey: string, role: string) => {
    setApprovers(a => {
      const current = a[typeKey] || [];
      const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
      return { ...a, [typeKey]: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { key: string; value: string }[] = [];
      approvalTypes.forEach(t => {
        t.fields.forEach(f => {
          const key = getConfigKey(t.key, f.key);
          const value = config[key] ?? f.default;
          updates.push({ key, value });
        });
        updates.push({
          key: `approval_matrix_${t.key}_approvers`,
          value: JSON.stringify(approvers[t.key] || ["SalesManager"]),
        });
      });

      const res = await fetch("/api/system-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Approval matrix saved");
      } else {
        toast.error(data.message || "Failed to save");
      }
    } catch {
      toast.error("Failed to save approval matrix");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="text-center py-12 text-gray-400">Loading approval matrix...</div>
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
          <h1 className="text-2xl font-bold text-gray-900">Approval Matrix</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure approval thresholds and approvers for each approval type</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          <Ico d={icons.save} size={16} /> {saving ? "Saving..." : "Save Matrix"}
        </button>
      </div>

      <div className="space-y-4">
        {approvalTypes.map(t => (
          <div key={t.key} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900">{t.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {t.fields.map(f => {
                const key = getConfigKey(t.key, f.key);
                const value = config[key] ?? f.default;
                return (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                    {f.type === "checkbox" ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={value === "true"}
                          onChange={e => handleFieldChange(t.key, f.key, e.target.checked ? "true" : "false")}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">Enabled</span>
                      </label>
                    ) : (
                      <input
                        type="number"
                        value={value}
                        onChange={e => handleFieldChange(t.key, f.key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    <p className="text-xs text-gray-400 mt-1">{f.help}</p>
                  </div>
                );
              })}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Approver Roles</label>
              <div className="flex gap-2">
                {approverRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => toggleApprover(t.key, role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      (approvers[t.key] || []).includes(role)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
