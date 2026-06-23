"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
};

export default function NewSamplePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    contactId: "",
    productId: "",
    rfqId: "",
    quantity: "1",
    specifications: "",
    assignedUserId: "",
  });

  useEffect(() => {
    fetch("/api/customer-master").then(res => res.json()).then(data => {
      if (data.success) setCustomers(data.data || []);
    });
    fetch("/api/catalogue/products").then(res => res.json()).then(data => {
      if (data.success) setProducts(data.data || []);
    });
    fetch("/api/users").then(res => res.json()).then(data => {
      if (data.success) setUsers(data.data || []);
    });
    fetch("/api/rfq").then(res => res.json()).then(data => {
      if (data.success) setRfqs(data.data || []);
    });

    // Pre-fill from query params
    const qCustomerId = searchParams.get("customerId");
    const qProductId = searchParams.get("productId");
    const qRfqId = searchParams.get("rfqId");
    if (qCustomerId) setForm(f => ({ ...f, customerId: qCustomerId }));
    if (qProductId) setForm(f => ({ ...f, productId: qProductId }));
    if (qRfqId) setForm(f => ({ ...f, rfqId: qRfqId }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (!form.productId) {
      toast.error("Please select a product");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Sample request created successfully");
        router.push(`/samples/${data.data.id}`);
      } else {
        toast.error(data.message || "Failed to create sample request");
      }
    } catch {
      toast.error("Failed to create sample request");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c: any) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.customerCode?.toLowerCase().includes(q);
  });

  const filteredProducts = products.filter((p: any) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.productCode?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q);
  });

  const filteredRfqs = form.customerId
    ? rfqs.filter((r: any) => r.customerId === form.customerId)
    : rfqs;

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/samples")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
          <Ico d={icons.back} size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New Sample Request</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a new product sample request</p>
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
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all mb-2"
            />
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value, contactId: "", rfqId: "" })}
              required
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
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
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer disabled:opacity-50"
            >
              <option value="">-- Select Contact --</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} {c.title ? `(${c.title})` : ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Product *</label>
            <input
              type="text"
              placeholder="Search product..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all mb-2"
            />
            <select
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
              required
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">-- Select Product --</option>
              {filteredProducts.map((p: any) => (
                <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity</label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Linked RFQ</label>
            <select
              value={form.rfqId}
              onChange={(e) => setForm({ ...form, rfqId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">-- None --</option>
              {filteredRfqs.map((r: any) => (
                <option key={r.id} value={r.id}>{r.rfqCode} - {r.customer?.name || ""}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned To</label>
            <select
              value={form.assignedUserId}
              onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">-- Unassigned --</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specifications / Notes</label>
          <textarea
            value={form.specifications}
            onChange={(e) => setForm({ ...form, specifications: e.target.value })}
            rows={4}
            placeholder="Enter sample specifications, requirements, or notes..."
            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/samples")}
            className="px-5 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Sample Request"}
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
