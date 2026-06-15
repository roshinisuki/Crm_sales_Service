"use client";

import { useState, useEffect } from "react";
import { getUnifiedOfficeVisitsAction, createVisitorAction, checkoutVisitorAction, promoteVisitorToCustomerAction } from "@/app/actions/visitors";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import InboundCheckInModal from "@/components/InboundCheckInModal";
import CheckOutModal from "@/components/CheckOutModal";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Users, Clock, Building } from "lucide-react";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x: "M6 18L18 6M6 6l12 12",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
};

// Purpose-based custom badge styling helper
function PurposeStatusBadge({ purpose, status, outcome }: { purpose: string; status: string; outcome: string }) {
  const isCheckedIn = status === "CHECKED_IN";
  
  if (isCheckedIn) {
    return (
      <span className="inline-flex items-center justify-center w-32 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 truncate animate-pulse">
        In Premises
      </span>
    );
  }

  let badge = null;
  const p = purpose ? purpose.toLowerCase() : "";
  const o = outcome || "";

  if (p.includes("support")) {
    if (o.toLowerCase().includes("resolved")) badge = { text: "Resolved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else if (o.toLowerCase().includes("resolving")) badge = { text: "Resolving", color: "bg-amber-50 text-amber-700 border-amber-200" };
    else badge = { text: "Enquired to IT", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (p.includes("subscription") || p.includes("renewal")) {
    if (o.toLowerCase().includes("renewed")) badge = { text: "Renewed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else if (o.toLowerCase().includes("processing")) badge = { text: "Renewal Processing", color: "bg-amber-50 text-amber-700 border-amber-200" };
    else badge = { text: "Renewal Requested", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (p.includes("sales") || p.includes("follow-up")) {
    if (o === "Converted") badge = { text: "Converted", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else if (o === "Not Interested") badge = { text: "Not Interested", color: "bg-red-50 text-red-700 border-red-200" };
    else badge = { text: o || "Interested", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (p.includes("demo")) {
    if (o.toLowerCase().includes("completed")) badge = { text: "Demo Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    else badge = { text: "Demo Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200" };
  } else if (o.includes("Walk-in Guest")) {
    badge = { text: "Walk-in Guest", color: "bg-slate-100 text-slate-600 border-slate-200" };
  } else if (o) {
    badge = { text: o, color: "bg-slate-100 text-slate-600 border-slate-200" };
  }

  if (!badge) return null;

  return (
    <span className={`inline-flex items-center justify-center w-32 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${badge.color} truncate`}>
      {badge.text}
    </span>
  );
}

export default function OfficeVisitsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "premises" | "out">("all");
  
  // Inbound Customer check-in modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Customer Checkout Modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [activeCheckoutVisit, setActiveCheckoutVisit] = useState<any>(null);

  const loadVisits = async () => {
    setLoading(true);
    try {
      const res = await getUnifiedOfficeVisitsAction();
      if (res.success && res.data) {
        setVisits(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  const handleOpenRegisterPrompt = () => {
    setIsCustomerModalOpen(true);
  };

  const handleCheckoutGuest = async (id: string) => {
    try {
      const res = await checkoutVisitorAction({ id });
      if (res.success) {
        toast.success("Guest checked out successfully.");
        loadVisits();
      } else {
        toast.error(res.message || "Failed to checkout guest");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCheckoutCustomer = (v: any) => {
    setActiveCheckoutVisit({
      id: v.id,
      customerId: v.customerId,
      customerName: v.name,
      customerCode: v.customerCode || "—",
      visitType: "Inbound",
      purpose: v.purpose,
      checkInTime: v.checkInTime,
    });
    setIsCheckoutModalOpen(true);
  };

  const handlePromoteGuest = async (id: string) => {
    if (!confirm("Are you sure you want to promote this guest walk-in to a CRM Lead? This will automatically assign them to an executive.")) return;
    try {
      const res = await promoteVisitorToCustomerAction(id);
      if (res.success) {
        toast.success(res.message || "Guest promoted successfully!");
        loadVisits();
      } else {
        toast.error(res.message || "Failed to promote guest");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };


  // Filter & Search Logic
  const filtered = visits.filter((v) => {
    // 1. Search term
    const term = search.toLowerCase();
    const matchesSearch = 
      v.name.toLowerCase().includes(term) ||
      (v.company && v.company.toLowerCase().includes(term)) ||
      (v.customerCode && v.customerCode.toLowerCase().includes(term)) ||
      (v.contact && v.contact.includes(term)) ||
      v.purpose.toLowerCase().includes(term);

    // 2. Status Tab
    let matchesTab = true;
    if (activeTab === "premises") {
      matchesTab = !v.checkOutTime;
    } else if (activeTab === "out") {
      matchesTab = !!v.checkOutTime;
    }

    return matchesSearch && matchesTab;
  });

  return (
    <PageContainer>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Office Visits</h1>
          <p className="text-sm text-slate-500 mt-1">Manage office walk-ins, CRM customers arrival queue, and guest entries.</p>
        </div>
        <button 
          onClick={handleOpenRegisterPrompt}
          className="flex items-center gap-2 px-4 py-2 bg-[#D44D4D] text-white rounded-xl text-sm font-medium hover:bg-[#C94F4F] transition-colors shadow-sm cursor-pointer"
        >
          <Ico d={icons.plus} size={16} />
          Register Office Visit
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
        <SummaryCard 
          label="Total Entries" 
          value={visits.length} 
          icon={<Users size={20} />} 
          variant="slate" 
          subtitle="Today's total"
        />
        <SummaryCard 
          label="In Premises" 
          value={visits.filter((v) => !v.checkOutTime).length} 
          icon={<Clock size={20} />} 
          variant="amber" 
          subtitle="Currently inside"
        />
        <SummaryCard 
          label="Checked Out" 
          value={visits.filter((v) => v.checkOutTime).length} 
          icon={<Building size={20} />} 
          variant="green" 
          subtitle="Visit completed"
        />
      </div>


      {/* Main Workspace Card */}
      <div className="crm-card overflow-hidden flex flex-col">
        
        {/* Table Filters Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
          
          {/* Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl w-fit shrink-0">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
            >
              All Logs ({visits.length})
            </button>
            <button
              onClick={() => setActiveTab("premises")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "premises" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
            >
              In Premises ({visits.filter(v => !v.checkOutTime).length})
            </button>
            <button
              onClick={() => setActiveTab("out")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "out" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
            >
              Checked Out ({visits.filter(v => v.checkOutTime).length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md w-full">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Ico d={icons.search} size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Search by name, contact, company, purpose..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D44D4D]/20 focus:border-[#D44D4D] transition-all"
            />
          </div>

        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr className="crm-tr border-b border-slate-200/60">
                <th className="crm-th whitespace-nowrap">Visitor / Client</th>
                <th className="crm-th whitespace-nowrap">Type</th>
                <th className="crm-th whitespace-nowrap">Purpose</th>
                <th className="crm-th whitespace-nowrap">Host Name</th>
                <th className="crm-th whitespace-nowrap">Start / End Visit</th>
                <th className="crm-th whitespace-nowrap">Outcome Status</th>
                <th className="crm-th text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-slate-500 font-medium">
                    Loading unified office logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-slate-500 font-semibold">
                    No entries logged matching selection criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const checkInText = new Date(v.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const checkOutText = v.checkOutTime 
                    ? new Date(v.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : "Still inside";

                  return (
                    <tr key={v.id} className="crm-tr hover:bg-slate-50/40 transition-colors group">
                      <td className="crm-td whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${v.type === "Customer" ? "bg-red-100 text-[#800000]" : "bg-slate-100 text-slate-700"}`}>
                            {v.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{v.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                              {v.contact} {v.company ? `| ${v.company}` : ""} {v.customerCode ? `(${v.customerCode})` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="crm-td whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${v.type === "Customer" ? "bg-red-50 text-[#D44D4D] border border-red-100" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                          {v.type}
                        </span>
                      </td>
                      <td className="crm-td font-semibold text-slate-600 whitespace-nowrap">{v.purpose}</td>
                      <td className="crm-td font-medium text-slate-600 whitespace-nowrap">{v.hostName}</td>
                      <td className="crm-td font-semibold text-slate-500 whitespace-nowrap">
                        <p>Started: {checkInText}</p>
                        <p className={`text-[10px] font-bold mt-0.5 ${!v.checkOutTime ? "text-amber-500 animate-pulse" : "text-slate-400"}`}>
                          {!v.checkOutTime ? "● Active In Office" : `Ended: ${checkOutText}`}
                        </p>
                      </td>
                      <td className="crm-td whitespace-nowrap">
                        <PurposeStatusBadge purpose={v.purpose} status={v.status} outcome={v.outcome} />
                      </td>
                      <td className="crm-td text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {v.followUpStatus && (
                            <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                              v.followUpStatus === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              Follow-up: {v.followUpStatus}
                            </span>
                          )}
                          {v.type === "Guest" && (user?.role === "Admin" || user?.role === "SalesManager") && (
                            <button
                              onClick={() => handlePromoteGuest(v.id)}
                              className="text-[10px] font-extrabold text-[#D44D4D] hover:text-white hover:bg-[#D44D4D] border border-slate-200 hover:border-transparent px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider shadow-xs cursor-pointer mr-1"
                            >
                              Promote to Lead
                            </button>
                          )}
                          {!v.checkOutTime && (
                            <button
                              onClick={() => {
                                  if (v.type === "Customer") {
                                    handleOpenCheckoutCustomer(v);
                                  } else {
                                    handleCheckoutGuest(v.id);
                                  }
                              }}
                              className="text-[10px] font-extrabold text-white bg-[#D44D4D] hover:bg-[#C94F4F] px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wider shadow-sm cursor-pointer"
                            >
                              End Visit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>



      {/* ── 2. CRM CUSTOMER INBOUND MODAL ── */}
      <InboundCheckInModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={loadVisits}
        loggedInUser={user ? { name: user.name, id: user.id } : null}
      />



      {/* ── 4. CRM CUSTOMER CHECK-OUT MODAL ── */}
      <CheckOutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => {
          setIsCheckoutModalOpen(false);
          setActiveCheckoutVisit(null);
        }}
        onSuccess={loadVisits}
        visit={activeCheckoutVisit}
      />

    </PageContainer>
  );
}
