"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProposalAction } from "@/app/actions/proposals";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { ArrowLeft, Save } from "lucide-react";

export default function NewProposalPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);

  const [form, setForm] = useState({
    customerId: "",
    dealId: "",
    title: "",
    description: "",
    value: "",
    validUntil: "",
    proposalPdfUrl: "",
  });

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await fetch("/api/customers?limit=100");
        const data = await res.json();
        if (data.success) setCustomers(data.data || []);
      } catch {}
    };
    const loadDeals = async () => {
      try {
        const res = await fetch("/api/deals?limit=100");
        const data = await res.json();
        if (data.success) setDeals(data.data || []);
      } catch {}
    };
    loadCustomers();
    loadDeals();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.title || !form.validUntil) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await createProposalAction({
        customerId: form.customerId,
        dealId: form.dealId || undefined,
        title: form.title,
        description: form.description || undefined,
        value: parseFloat(form.value) || 0,
        validUntil: new Date(form.validUntil).toISOString(),
        proposalPdfUrl: form.proposalPdfUrl || undefined,
      });
      if (res.success) {
        toast.success("Proposal created successfully");
        router.push("/proposals");
      } else {
        toast.error(res.message || "Failed to create proposal");
      }
    } catch {
      toast.error("Failed to create proposal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-4">
          <ArrowLeft size={18} /> Back to Proposals
        </button>
        <h1 className="text-2xl font-bold text-slate-900">New Proposal</h1>
        <p className="text-slate-500 mt-1">Create a new proposal for a customer</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer *</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Deal (Optional)</label>
              <select
                value={form.dealId}
                onChange={(e) => setForm({ ...form, dealId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="">Select deal (optional)</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.dealName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Enter proposal title"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description / Terms</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Enter proposal description and terms"
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Value</label>
              <input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Valid Until *</label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">PDF URL (Optional)</label>
            <input
              type="url"
              value={form.proposalPdfUrl}
              onChange={(e) => setForm({ ...form, proposalPdfUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => router.push("/proposals")} className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              <Save size={18} />
              {saving ? "Creating..." : "Create Proposal"}
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
