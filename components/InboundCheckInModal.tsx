"use client";

import { useState, useEffect, useCallback } from "react";
import { getCustomersAction, createCustomerAction } from "@/app/actions/customers";
import { checkInInboundAction } from "@/app/actions/visits";

interface InboundCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loggedInUser: { name: string; id: string } | null;
}

const PURPOSE_OPTIONS = [
  { value: "New Enquiry",            label: "🔍 New Enquiry" },
  { value: "Product Demo",           label: "🎯 Product Demo" },
  { value: "Pricing Discussion",     label: "💰 Pricing Discussion" },
  { value: "Support",                label: "⚠️ Complaint / Support" },
  { value: "Sales Meeting",          label: "🤝 Sales Meeting" },
  { value: "Other",                  label: "📋 Other" },
];

export default function InboundCheckInModal({
  isOpen,
  onClose,
  onSuccess,
  loggedInUser,
}: InboundCheckInModalProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Section 1 — Visitor Identity
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustCode, setNewCustCode] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");

  // Section 2 — Purpose
  const [purpose, setPurpose] = useState("New Enquiry");

  // Section 3 — Notes
  const [notes, setNotes] = useState("");

  const reset = useCallback(() => {
    setMode("select");
    setSelectedCustomerId("");
    setPurpose("New Enquiry");
    setNotes("");
    setNewCustCode(`CST-${Math.floor(1000 + Math.random() * 9000)}`);
    setNewCustName("");
    setNewCustPhone("");
    setNewCustEmail("");
    setErrorMsg("");
  }, []);

  useEffect(() => {
    if (isOpen) {
      reset();
      setLoading(true);
      getCustomersAction().then(res => {
        if (res.success && res.data) setCustomers(res.data);
        setLoading(false);
      });
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    try {
      let finalCustomerId = selectedCustomerId;

      if (mode === "create") {
        if (!newCustName) {
          setErrorMsg("Customer Name is required.");
          setFormLoading(false);
          return;
        }
        const createRes = await createCustomerAction({
          customerCode: newCustCode.trim(),
          name: newCustName.trim(),
          email: newCustEmail.trim() || null,
          phone: newCustPhone.trim() || null,
          city: null,
          status: "New",
        });
        if (!createRes.success) {
          setErrorMsg(createRes.message || "Failed to create new customer.");
          setFormLoading(false);
          return;
        }
        finalCustomerId = createRes.data?.id || "";
      }

      if (!finalCustomerId) {
        setErrorMsg("Please select or create a customer.");
        setFormLoading(false);
        return;
      }

      // Auto-filled default values passed silently
      const res = await checkInInboundAction({
        customerId: finalCustomerId,
        purpose,
        notes: notes.trim() || undefined,
        priority: "Normal",
        meetingType: "Walk-in",
        source: "Walk-in",
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Failed to register check-in.");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1";
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] text-slate-700 font-medium transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">🏢 Office Visit Check-In</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Register a customer's inbound office visit</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto flex-1 space-y-5">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 text-center">
                {errorMsg}
              </div>
            )}

            {/* ── Section 1: Visitor Identity ── */}
            <div>
              <p className="text-[10px] font-black text-[#C94F4F] uppercase tracking-widest mb-2.5">1 · Customer</p>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-3">
                <button type="button" onClick={() => { setMode("select"); setErrorMsg(""); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === "select" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  Existing Customer
                </button>
                <button type="button" onClick={() => { setMode("create"); setErrorMsg(""); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === "create" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  + New Walk-In
                </button>
              </div>

              {mode === "select" ? (
                <div>
                  <label className={labelCls}>Select Customer <span className="text-red-400">*</span></label>
                  <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} disabled={loading} required
                    className={inputCls}>
                    <option value="">-- Choose from customer list --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? ` · ${c.city}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedCustomer && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600">
                        {selectedCustomer.status}
                      </span>
                      {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50/40 border border-red-100 rounded-2xl p-4 space-y-3">
                  <div>
                    <label className={labelCls}>Full Name <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="John Doe" value={newCustName} onChange={e => setNewCustName(e.target.value)} required={mode === "create"} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" placeholder="customer@example.com" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input type="text" placeholder="9876543210" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Section 2: Purpose ── */}
            <div>
              <p className="text-[10px] font-black text-[#C94F4F] uppercase tracking-widest mb-2.5">2 · Purpose of Visit</p>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                required
                className={inputCls}
              >
                {PURPOSE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Section 3: Notes ── */}
            <div>
              <p className="text-[10px] font-black text-[#C94F4F] uppercase tracking-widest mb-2.5">3 · Notes</p>
              <textarea rows={3} placeholder="Optional context or remarks..." value={notes} onChange={e => setNotes(e.target.value)} className={inputCls + " resize-none"} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={formLoading} className="px-7 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D44D4D] hover:bg-[#C94F4F] transition-colors shadow-sm disabled:opacity-75 flex items-center gap-2 cursor-pointer">
              {formLoading ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />Saving...</>
              ) : "✓ Start Visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
