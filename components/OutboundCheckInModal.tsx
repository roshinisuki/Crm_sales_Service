"use client";

import { useState, useEffect, useCallback } from "react";
import { getCustomersAction } from "@/app/actions/customers";
import { checkInOutboundAction } from "@/app/actions/visits";

interface OutboundCheckInModalProps {
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

export default function OutboundCheckInModal({
  isOpen,
  onClose,
  onSuccess,
  loggedInUser,
}: OutboundCheckInModalProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Section 1 — Target
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [visitLocation, setVisitLocation] = useState("");

  // Section 2 — Purpose
  const [purpose, setPurpose] = useState("Sales Meeting");

  // Section 3 — GPS (Silent)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");

  // Section 4 — Notes
  const [notes, setNotes] = useState("");

  const fetchGPS = useCallback(() => {
    setLocation(null);
    setLocError("");
    setLocLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); },
        err => { setLocError("GPS capture failed. You may retry or proceed without location."); setLocLoading(false); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocError("Geolocation not supported by this browser.");
      setLocLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSelectedCustomerId("");
    setVisitLocation("");
    setPurpose("Sales Meeting");
    setNotes("");
    setErrorMsg("");
  }, []);

  useEffect(() => {
    if (isOpen) {
      reset();
      fetchGPS();
      setLoading(true);
      getCustomersAction().then(res => {
        if (res.success && res.data) setCustomers(res.data);
        setLoading(false);
      });
    }
  }, [isOpen, reset, fetchGPS]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) { setErrorMsg("Please select a target customer."); return; }
    setFormLoading(true);
    setErrorMsg("");

    const fullMetadata = {
      ...(visitLocation ? { visitLocation } : {}),
    };

    const metadataStr = Object.keys(fullMetadata).length > 0 
      ? "\n\nVisit Metadata:\n" + Object.entries(fullMetadata).map(([k, v]) => `${k}: ${v}`).join("\n") 
      : "";

    try {
      const res = await checkInOutboundAction({
        customerId: selectedCustomerId,
        purpose,
        notes: (notes.trim() + metadataStr).trim() || undefined,
        checkInLat: location?.lat,
        checkInLng: location?.lng,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Failed to register field visit.");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] text-slate-700 font-medium transition-all";
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">📍 Field Check-In</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Record an outbound customer visit</p>
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

            {/* ── Section 1: Visit Target ── */}
            <div>
              <p className="text-[10px] font-black text-[#C94F4F] uppercase tracking-widest mb-2.5">1 · Visit Target</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Target Customer <span className="text-red-400">*</span></label>
                  <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} disabled={loading} required className={inputCls}>
                    <option value="">-- Select customer from list --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? ` · ${c.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Visit Location / Address</label>
                  <input type="text" placeholder="Area, landmark or address..." value={visitLocation} onChange={e => setVisitLocation(e.target.value)} className={inputCls} />
                </div>
              </div>
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

            {/* ── Section 3: GPS Verification ── */}
            <div>
              <p className="text-[10px] font-black text-[#C94F4F] uppercase tracking-widest mb-2.5">3 · GPS Verification</p>
              <div className="p-3.5 border rounded-2xl bg-slate-50 border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Coordinates</p>
                  {locLoading && (
                    <p className="text-xs text-slate-600 flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin shrink-0" />
                      Capturing GPS coordinates...
                    </p>
                  )}
                  {location && (
                    <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                      Locked: {location.lat.toFixed(5)}°N, {location.lng.toFixed(5)}°E
                    </p>
                  )}
                  {locError && <p className="text-xs font-medium text-amber-600">⚠️ {locError}</p>}
                </div>
                <button type="button" onClick={fetchGPS} className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-[10px] font-bold text-slate-700 transition-colors shrink-0">
                  Retry GPS
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* ── Section 4: Notes ── */}
            <div>
              <p className="text-[10px] font-black text-[#C94F4F] uppercase tracking-widest mb-2.5">4 · Notes</p>
              <textarea rows={3} placeholder="Optional context or remarks..." value={notes} onChange={e => setNotes(e.target.value)}
                className={inputCls + " resize-none"} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={formLoading || locLoading} className="px-7 py-2.5 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-75 flex items-center gap-2 cursor-pointer">
              {formLoading ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />Recording...</>
              ) : "📍 Field Check-In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
