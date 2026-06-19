"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = { back: "M10 19l-7-7m0 0l7-7m-7 7h18" };

export default function NewNegotiationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    contactId: "",
    quotationId: "",
    dealId: "",
    initialAmount: "",
    customerDemands: "",
    internalNotes: "",
    assignedUserId: "",
  });

  useEffect(() => {
    fetch("/api/customer-master").then(res => res.json()).then(data => { if (data.success) setCustomers(data.data || []); });
    fetch("/api/quotations").then(res => res.json()).then(data => { if (data.success) setQuotations(data.data || []); });
    fetch("/api/deals").then(res => res.json()).then(data => { if (data.success) setDeals(data.data || []); });
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });

    const qCustomerId = searchParams.get("customerId");
    const qQuotationId = searchParams.get("quotationId");
    const qDealId = searchParams.get("dealId");
    if (qCustomerId) setForm(f => ({ ...f, customerId: qCustomerId }));
    if (qQuotationId) setForm(f => ({ ...f, quotationId: qQuotationId }));
    if (qDealId) setForm(f => ({ ...f, dealId: qDealId }));
  }, [searchParams]);

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/contacts?customerId=${form.customerId}`).then(res => res.json()).then(data => {
        if (data.success) setContacts(data.data || []);
      });
    } else {
      setContacts([]);
    }
  }, [form.customerId]);

  // Auto-fill initialAmount from selected quotation
  useEffect(() => {
    if (form.quotationId) {
      const q = quotations.find((x: any) => x.id === form.quotationId);
      if (q && q.finalAmount && !form.initialAmount) {
        setForm(f => ({ ...f, initialAmount: String(q.finalAmount) }));
      }
    }
  }, [form.quotationId, quotations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast.error("Please select a customer"); return; }
    if (!form.initialAmount) { toast.error("Initial amount is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/negotiations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Negotiation created");
        router.push(`/negotiations/${data.data.id}`);
      } else {
        toast.error(data.message || "Failed to create negotiation");
      }
    } catch {
      toast.error("Failed to create negotiation");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.customerCode?.toLowerCase().includes(q);
  });

  const filteredQuotations = form.customerId
    ? quotations.filter((q: any) => q.customerId === form.customerId)
    : quotations;
  const filteredDeals = form.customerId
    ? deals.filter((d: any) => d.customerId === form.customerId)
    : deals;

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/negotiations")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
          <Ico d={icons.back} size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New Negotiation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Start a new price negotiation</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer *</label>
            <input
              type="text"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all mb-2"
            />
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value, contactId: "" })}
              required
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all cursor-pointer"
            >
              <option value="">-- Select Customer --</option>
              {filteredCustomers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact</label>
            <select
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
              disabled={!form.customerId}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="">-- Select Contact --</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Linked Quotation</label>
            <select
              value={form.quotationId}
              onChange={(e) => setForm({ ...form, quotationId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all cursor-pointer"
            >
              <option value="">-- None --</option>
              {filteredQuotations.map((q: any) => (
                <option key={q.id} value={q.id}>{q.quotationCode} - {q.finalAmount ? `$${q.finalAmount}` : ""}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Selecting a quotation auto-fills the initial amount.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Linked Deal</label>
            <select
              value={form.dealId}
              onChange={(e) => setForm({ ...form, dealId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all cursor-pointer"
            >
              <option value="">-- None --</option>
              {filteredDeals.map((d: any) => (
                <option key={d.id} value={d.id}>{d.dealName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Initial Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.initialAmount}
              onChange={(e) => setForm({ ...form, initialAmount: e.target.value })}
              placeholder="0.00"
              required
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label>
            <select
              value={form.assignedUserId}
              onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all cursor-pointer"
            >
              <option value="">-- Unassigned --</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Demands</label>
          <textarea
            value={form.customerDemands}
            onChange={(e) => setForm({ ...form, customerDemands: e.target.value })}
            rows={3}
            placeholder="What the customer is asking for (price, terms, conditions)..."
            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Internal Notes</label>
          <textarea
            value={form.internalNotes}
            onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
            rows={3}
            placeholder="Internal notes (not shared with customer)..."
            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.push("/negotiations")} className="px-5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[#D44D4D] hover:bg-[#C94F4F] transition-colors cursor-pointer disabled:opacity-60">
            {saving ? "Saving..." : "Create Negotiation"}
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
