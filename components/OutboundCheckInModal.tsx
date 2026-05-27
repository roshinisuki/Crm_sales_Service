"use client";

import { useState, useEffect } from "react";
import { getCustomersAction } from "@/app/actions/customers";
import { checkInOutboundAction } from "@/app/actions/visits";

interface OutboundCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loggedInUser: { name: string; id: string } | null;
}

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

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [purpose, setPurpose] = useState("Sales Pitch");
  const [notes, setNotes] = useState("");

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      fetchGPS();
      setErrorMsg("");
      setSelectedCustomerId("");
      setPurpose("Sales Pitch");
      setNotes("");
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

  const fetchGPS = () => {
    setLocation(null);
    setLocError("");
    setLocLoading(true);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocLoading(false);
        },
        (err) => {
          console.error("GPS Error:", err);
          setLocError("GPS permission denied or unavailable. You can still check in.");
          setLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocError("Geolocation not supported by this browser.");
      setLocLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!selectedCustomerId) {
      setErrorMsg("Please select a customer.");
      setFormLoading(false);
      return;
    }

    try {
      const res = await checkInOutboundAction({
        customerId: selectedCustomerId,
        purpose,
        notes: notes.trim(),
        checkInLat: location?.lat,
        checkInLng: location?.lng,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Failed to register field visit.");
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
            <h2 className="text-base font-bold text-slate-800">Log Outbound Field Visit</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Capturing verified onsite customer visits</p>
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

            {/* Select Customer */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Target Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                disabled={loading}
                required
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

            {/* Purpose & Host */}
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
                  <option value="Sales Pitch">Sales Pitch</option>
                  <option value="Follow-up Meeting">Follow-up Meeting</option>
                  <option value="Subscription Renewal">Subscription Renewal</option>
                  <option value="Demo">Demo</option>
                  <option value="Support Visit">Support Visit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Executive Name
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
                  System Check-In Time
                </label>
                <input
                  type="text"
                  readOnly
                  value={new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
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

            {/* GPS Location Tracker */}
            <div className="p-4 border rounded-2xl bg-slate-50 border-slate-200/80 flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">GPS Verification Coordinates</p>
                {locLoading && (
                  <p className="text-xs text-slate-600 flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin shrink-0"></span>
                    Capturing verified GPS coordinates...
                  </p>
                )}
                {location && (
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0"></span>
                    Coordinates locked: {location.lat.toFixed(6)}° N, {location.lng.toFixed(6)}° E
                  </p>
                )}
                {locError && (
                  <p className="text-xs font-medium text-amber-600">
                    ⚠️ {locError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={fetchGPS}
                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-[10px] font-bold text-slate-700 transition-colors shrink-0"
              >
                Retry GPS
              </button>
            </div>

            {/* Initial Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Initial Notes / Remarks (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add details on client arrival status, location details, etc..."
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
              {formLoading ? "Recording Visit..." : "Log Check-In"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
