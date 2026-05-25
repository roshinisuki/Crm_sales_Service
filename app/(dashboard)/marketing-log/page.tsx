"use client";

import { useState, useEffect } from "react";
import { getMarketingLogsAction, checkInAction, checkOutAction } from "@/app/actions/marketingLogs";
import { getCustomersAction } from "@/app/actions/customers";
import { MarketingLog, Customer } from "@/types";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x: "M6 18L18 6M6 6l12 12",
  map_pin: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  check_circle: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
};

export default function VisitsPage() {
  const [logs, setLogs] = useState<MarketingLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    purpose: "",
    notes: "",
  });

  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    if (isModalOpen) {
      setLocation(null);
      setLocError("");
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => setLocError("Failed to fetch GPS location. Please enable location services.")
        );
      } else {
        setLocError("Geolocation is not supported by your browser.");
      }
    }
  }, [isModalOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, custRes] = await Promise.all([
        getMarketingLogsAction(),
        getCustomersAction(),
      ]);
      if (logsRes.success) setLogs(logsRes.data || []);
      if (custRes.success) setCustomers(custRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckout = async (id: string) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await checkOutAction({
          id: id,
          checkOutLat: pos.coords.latitude,
          checkOutLng: pos.coords.longitude,
          notes: "Checked out successfully from premises.",
        });
        if (res.success) {
          loadData();
        } else {
          alert(res.message || "Failed to check out");
        }
      } catch (err) {
        alert("Failed to process checkout");
      }
    }, () => {
      alert("Failed to get location. Please enable GPS.");
    });
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!formData.customerId || !formData.purpose) {
      setErrorMsg("Please select a customer and specify a purpose.");
      setFormLoading(false);
      return;
    }

    if (!location) {
      setErrorMsg("Please wait for GPS location to be fetched or enable location services.");
      setFormLoading(false);
      return;
    }

    try {
      const res = await checkInAction({
        customerId: formData.customerId,
        purpose: formData.purpose,
        notes: formData.notes,
        checkInLat: location.lat,
        checkInLng: location.lng,
      });
      if (res.success) {
        setIsModalOpen(false);
        loadData();
      } else {
        setErrorMsg(res.message || "Failed to check in");
      }
    } catch (err) {
      setErrorMsg("Failed to process check in");
    } finally {
      setFormLoading(false);
    }
  };

  const filtered = logs.filter((l) => {
    const custName = l.customer?.name.toLowerCase() || "";
    const term = search.toLowerCase();
    return custName.includes(term) || l.customerId.includes(term);
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Marketing Visits</h1>
          <p className="text-sm text-slate-500 mt-1">Track executive field visits, check-ins, and meeting notes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0D2137] text-white rounded-xl text-sm font-medium hover:bg-[#1a365d] transition-colors shadow-sm"
        >
          <Ico d={icons.plus} size={16} />
          Log Check-In Visit
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Ico d={icons.map_pin} size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{logs.length}</p>
            <p className="text-xs font-semibold text-slate-500">Today's Visits</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Ico d={icons.calendar} size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {logs.filter(l => l.checkOutTime).length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Completed Sessions</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Ico d={icons.clock} size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {logs.filter(l => !l.checkOutTime).length}
            </p>
            <p className="text-xs font-semibold text-slate-500">Active Visits</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Ico d={icons.search} size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Search visits by customer..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Purpose / Remarks</th>
                <th className="px-6 py-4">Timings</th>
                <th className="px-6 py-4">GPS Track</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                    Loading visit sessions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                    No marketing visits logged.
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{v.customer?.name || "Unknown Account"}</p>
                      <p className="text-xs text-slate-500">{v.customer?.customerCode || v.customerId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">{v.purpose || "Field Visit"}</p>
                      <p className="text-xs text-slate-400 mt-1">{v.notes || "No notes added"}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div className="flex flex-col gap-1">
                        <span>Check In: <span className="font-semibold text-slate-700">{new Date(v.checkInTime).toLocaleTimeString()}</span></span>
                        {v.checkOutTime ? (
                          <span>Check Out: <span className="font-semibold text-slate-700">{new Date(v.checkOutTime).toLocaleTimeString()}</span></span>
                        ) : (
                          <span className="text-blue-600 font-bold">Currently Onsite</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      In: {v.checkInLat.toFixed(4)}, {v.checkInLng.toFixed(4)}
                      {v.checkOutLat && ` | Out: ${v.checkOutLat.toFixed(4)}, ${v.checkOutLng?.toFixed(4)}`}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!v.checkOutTime && (
                        <button 
                          onClick={() => handleCheckout(v.id)}
                          className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                        >
                          Check Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-slate-800">New Onsite Visit Check-In</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <Ico d={icons.x} size={20} />
              </button>
            </div>

            <form onSubmit={handleCheckIn}>
              <div className="p-6 overflow-y-auto space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">
                    {errorMsg}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Customer Account <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    required
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Purpose of Visit <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    placeholder="e.g. Contract Renewal Demo" 
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Check-In Notes</label>
                  <textarea 
                    rows={3} 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Onsite discussion remarks..." 
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none resize-none"
                  ></textarea>
                </div>
                <div className={`p-4 border rounded-xl ${location ? "bg-emerald-50 border-emerald-100" : locError ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-200"}`}>
                  <p className={`text-xs font-bold flex items-center gap-1.5 ${location ? "text-emerald-950" : locError ? "text-red-900" : "text-slate-600"}`}>
                    {!location && !locError && <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></span>}
                    {location && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>}
                    {location 
                      ? `Verified Location coordinates: ${location.lat.toFixed(4)}° N, ${location.lng.toFixed(4)}° E`
                      : locError 
                        ? locError
                        : "Fetching GPS location..."}
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[#0D2137] hover:bg-[#1a365d] transition-colors shadow-sm disabled:opacity-75"
                >
                  {formLoading ? "Recording..." : "Check In Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
