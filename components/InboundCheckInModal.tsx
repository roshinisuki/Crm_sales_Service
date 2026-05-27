"use client";

import { useState, useEffect } from "react";
import { getCustomersAction, createCustomerAction } from "@/app/actions/customers";
import { checkInInboundAction } from "@/app/actions/visits";

interface InboundCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loggedInUser: { name: string; id: string } | null;
}

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

  const [mode, setMode] = useState<"select" | "create">("select");

  // Selection form
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [purpose, setPurpose] = useState("Sales Meeting");
  const [notes, setNotes] = useState("");

  // Quick Customer Creation form
  const [newCustCode, setNewCustCode] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustCity, setNewCustCity] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      setErrorMsg("");
      setSelectedCustomerId("");
      setPurpose("Sales Meeting");
      setNotes("");
      setMode("select");
      // Reset new customer form
      setNewCustCode(`CST-${Math.floor(1000 + Math.random() * 9000)}`);
      setNewCustName("");
      setNewCustEmail("");
      setNewCustPhone("");
      setNewCustCity("");
    }
  }, [isOpen]);

  const loadCustomers = async () => {
    setLoading(true);
    const res = await getCustomersAction();
    if (res.success && res.data) {
      setCustomers(res.data);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    try {
      let finalCustomerId = selectedCustomerId;

      // 1. If in create mode, register new customer first
      if (mode === "create") {
        if (!newCustCode || !newCustName) {
          setErrorMsg("Customer Code and Name are required.");
          setFormLoading(false);
          return;
        }

        const createRes = await createCustomerAction({
          customerCode: newCustCode.trim(),
          name: newCustName.trim(),
          email: newCustEmail.trim() || null,
          phone: newCustPhone.trim() || null,
          city: newCustCity.trim() || null,
          status: "Prospect", // Walk-in starts as Prospect
        });

        if (!createRes.success) {
          setErrorMsg(createRes.message || "Failed to create new customer.");
          setFormLoading(false);
          return;
        }
        finalCustomerId = createRes.data.id;
      }

      if (!finalCustomerId) {
        setErrorMsg("Please select or create a customer.");
        setFormLoading(false);
        return;
      }

      // 2. Perform Check-in
      const checkinRes = await checkInInboundAction({
        customerId: finalCustomerId,
        purpose,
        notes: notes.trim(),
      });

      if (checkinRes.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(checkinRes.message || "Failed to register check-in.");
      }
    } catch (err) {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-800">Register Customer Inbound Visit</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Capturing front-desk customer arrivals</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600 text-center animate-shake">
                {errorMsg}
              </div>
            )}

            {/* Toggle Mode */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setMode("select"); setErrorMsg(""); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === "select" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                Existing Customer
              </button>
              <button
                type="button"
                onClick={() => { setMode("create"); setErrorMsg(""); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === "create" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                + Register New Customer
              </button>
            </div>

            {/* Select Customer */}
            {mode === "select" ? (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Select Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={loading}
                  required={mode === "select"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium transition-all"
                >
                  <option value="">-- Choose customer from master list --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customerCode}) {c.city ? `- ${c.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-2xl space-y-3.5">
                <p className="text-[11px] font-bold text-[#1a6bff] uppercase tracking-wider">New Customer Details</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Code *</label>
                    <input
                      type="text"
                      value={newCustCode}
                      onChange={(e) => setNewCustCode(e.target.value)}
                      required={mode === "create"}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      required={mode === "create"}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone</label>
                    <input
                      type="text"
                      placeholder="9876543210"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Chennai"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Purpose & Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Purpose of Visit
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none text-slate-700 font-semibold"
                >
                  <option value="Sales Meeting">Sales Meeting</option>
                  <option value="Subscription Discussion">Subscription Discussion</option>
                  <option value="Support">Support</option>
                  <option value="Demo">Demo</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Host Name (You)
                </label>
                <input
                  type="text"
                  readOnly
                  value={loggedInUser?.name || "Loading..."}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200/60 text-sm text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* System Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Check-In Time
                </label>
                <input
                  type="text"
                  readOnly
                  value={new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200/60 text-sm text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Assigned Date
                </label>
                <input
                  type="text"
                  readOnly
                  value={new Date().toLocaleDateString("en-IN")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200/60 text-sm text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* Initial Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Initial Notes / Remarks (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add any initial observations or expectations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 resize-none font-medium"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0D2137] hover:bg-[#153456] transition-colors shadow-sm disabled:opacity-75"
            >
              {formLoading ? "Saving Visit..." : "Submit Check-In"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
