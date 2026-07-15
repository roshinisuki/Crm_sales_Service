"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { serviceModulesConfig } from "@/lib/config/serviceModuleConfig";
import ServiceModuleForm from "@/components/shared/ServiceModuleForm";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/lib/ui-utils";
import { Search, Plus, RefreshCw, ChevronLeft, X, Calendar, CheckCircle, AlertTriangle, Clock, CalendarDays } from "lucide-react";
import { SignaturePad, PhotoUploader } from "@/components/shared/ProofOfWork";
import { ServiceKPICard as KPICard, ServiceKPIGrid } from "@/components/shared/ServiceKPICard";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

const NOW = new Date();

function computeLiveStatus(visit: any): string {
  const statusName = visit.status?.name || visit.status || "Unknown";
  if ((statusName === "Scheduled" || statusName === "Assigned") && visit.scheduledDate) {
    if (new Date(visit.scheduledDate) < NOW) return "Overdue";
  }
  return statusName;
}

function getSourceInfo(visit: any): { type: string; code: string; href: string } | null {
  if (visit.request) return { type: "Request", code: `REQ-${visit.request.id.substring(0, 8).toUpperCase()}`, href: "/service/requests" };
  if (visit.complaint) return { type: "Complaint", code: `CMP-${visit.complaint.id.substring(0, 8).toUpperCase()}`, href: "/service/complaints" };
  if (visit.defect) return { type: "Defect", code: `DEF-${visit.defect.id.substring(0, 8).toUpperCase()}`, href: "/service/defects" };
  if (visit.installation) return { type: "Installation", code: `INS-${visit.installation.id.substring(0, 8).toUpperCase()}`, href: "/service/installations" };
  return null;
}


export default function ServiceVisitsPage() {
  const config = serviceModulesConfig.visits;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState<any>({});
  const [stats, setStats] = useState({ total: 0, scheduledToday: 0, upcomingThisWeek: 0, overdue: 0, completedThisMonth: 0 });
  const [kpiFilter, setKpiFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [engineerFilter, setEngineerFilter] = useState("");
  const [completeModal, setCompleteModal] = useState<any>(null);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("Resolved");
  const [reasonNextSteps, setReasonNextSteps] = useState("");
  const [followUpVisitNeeded, setFollowUpVisitNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [sparePartsUsed, setSparePartsUsed] = useState<{ productId: string; quantity: number }[]>([]);
  const [structuredParts, setStructuredParts] = useState<{ sparePartId: string; partName: string; quantity: number; unitCost: number }[]>([]);
  const [sparePartMaster, setSparePartMaster] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<{ url: string; caption?: string }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [returnedParts, setReturnedParts] = useState<{ sparePartId: string; partName: string; quantity: number; notes?: string }[]>([]);
  const [engineerHolding, setEngineerHolding] = useState<any[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [emailingReport, setEmailingReport] = useState(false);

  // Fetch catalogue products for spare parts dropdown
  useEffect(() => {
    fetch("/api/catalogue/products")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setProducts(json.data || []);
      })
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  // Fetch spare parts master data
  useEffect(() => {
    fetch("/api/service/spare-parts?active=true")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setSparePartMaster(json.data || []);
      })
      .catch((err) => console.error("Error fetching spare parts:", err));
  }, []);

  // Fetch engineer holding when complete modal opens
  useEffect(() => {
    if (completeModal?.engineer?.id) {
      fetch(`/api/service/inventory?engineerId=${completeModal.engineer.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setEngineerHolding(json.data || []);
        })
        .catch((err) => console.error("Error fetching engineer holding:", err));
    } else {
      setEngineerHolding([]);
    }
  }, [completeModal]);

  const [elapsedTimeText, setElapsedTimeText] = useState("");

  useEffect(() => {
    if (selectedRow && selectedRow.status === "In Progress" && selectedRow.checkInTime) {
      const updateTimer = () => {
        const checkIn = new Date(selectedRow.checkInTime).getTime();
        const diffMs = new Date().getTime() - checkIn;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setElapsedTimeText(`On-site for ${hours > 0 ? `${hours}h ` : ""}${mins} min`);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 60000);
      return () => clearInterval(interval);
    } else {
      setElapsedTimeText("");
    }
  }, [selectedRow]);

  const prefilledCustomerId = searchParams?.get("customerId") || "";
  const prefilledAssetId = searchParams?.get("customerAssetId") || "";
  const sourceType = searchParams?.get("sourceType") || "";
  const sourceId = searchParams?.get("sourceId") || "";

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/service/visits");
      if (res.ok) {
        const json = await res.json();
        const mappedData = json.map((item: any) => {
          const parent = item.request || item.complaint || item.defect || item.installation;
          const liveStatus = computeLiveStatus(item);
          const source = getSourceInfo(item);
          return {
            ...item,
            visitCode: `VST-${item.id.substring(0, 8).toUpperCase()}`,
            visitDate: item.scheduledDate,
            customer: item.customer || (parent ? { name: parent.customer?.name || "Unknown" } : { name: "Unknown" }),
            customerAsset: item.customerAsset || (parent ? { productName: parent.customerAsset?.productName } : null),
            engineer: { user: { name: item.engineer?.user?.name || "Unassigned" } },
            status: liveStatus,
            source: source ? `${source.type} ${source.code}` : "-",
            sourceInfo: source,
          };
        });
        setData(mappedData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRefData = async () => {
    try {
      const res = await fetch("/api/service/reference-data?module=visit");
      if (res.ok) {
        setRefData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/service/visits/stats");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRefData();
    fetchStats();
  }, []);

  useEffect(() => {
    if (prefilledCustomerId && sourceId) {
      setIsFormOpen(true);
    }
  }, [prefilledCustomerId, sourceId]);

  const handleCreateNew = async (formData: any) => {
    try {
      const createdById = user?.id || "user-1";
      const body: any = {
        title: formData.title || "Service Visit",
        notes: formData.notes,
        statusId: formData.statusId || refData.ServiceStatus?.[0]?.value,
        engineerId: formData.engineerId || refData.ServiceEngineer?.[0]?.value,
        scheduledDate: formData.visitDate || new Date().toISOString(),
        customerId: formData.customerId,
        customerAssetId: formData.assetId,
        createdById,
      };

      if (sourceType === "request" && sourceId) body.requestId = sourceId;
      if (sourceType === "complaint" && sourceId) body.complaintId = sourceId;
      if (sourceType === "defect" && sourceId) body.defectId = sourceId;
      if (sourceType === "installation" && sourceId) body.installationId = sourceId;

      const res = await fetch("/api/service/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchData();
        await fetchStats();
        setIsFormOpen(false);
        if (sourceType) router.replace("/service/visits");
      } else {
        const err = await res.json();
        toast.error(`Failed to create: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckIn = async (row: any) => {
    setCheckingIn(true);
    
    const triggerCheckIn = async (lat?: number, lng?: number, gpsCaptured = false) => {
      try {
        const res = await fetch(`/api/service/visits/${row.id}/check-in`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng, gpsCaptured }),
        });
        if (res.ok) {
          const updatedVisit = await res.json();
          // Find updated in data array
          await fetchData();
          setSelectedRow(null); // Return to list or refresh
          toast.success("Check-in successful! Your status has been updated to 'In Progress'.");
        } else {
          const err = await res.json();
          toast.error(`Check-in failed: ${err.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingIn(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          triggerCheckIn(position.coords.latitude, position.coords.longitude, true);
        },
        (error) => {
          console.warn("Geolocation denied or failed. Proceeding with stub.", error);
          triggerCheckIn(undefined, undefined, false);
        },
        { timeout: 8000 }
      );
    } else {
      triggerCheckIn(undefined, undefined, false);
    }
  };

  const handleComplete = async () => {
    if (!outcomeNotes.trim() || outcomeNotes.trim().length < 20) {
      toast.error("Work performed notes are required and must be at least 20 characters.");
      return;
    }
    
    const requiresNextSteps = ["Escalated", "Follow-up Required", "Parts Pending"].includes(selectedOutcome);
    if (requiresNextSteps && (!reasonNextSteps || reasonNextSteps.trim().length < 10)) {
      toast.error(`Reason / next steps details are required for outcome '${selectedOutcome}' (min 10 characters).`);
      return;
    }

    if (selectedOutcome === "Parts Pending" && sparePartsUsed.length === 0) {
      toast.error("At least one spare part item must be listed when the outcome is 'Parts Pending'.");
      return;
    }

    setCompleting(true);
    try {
      const body = {
        outcome: selectedOutcome,
        outcomeNotes: outcomeNotes.trim(),
        sparePartsUsed,
        structuredPartsUsed: structuredParts,
        returnedParts,
        reasonNextSteps: reasonNextSteps.trim(),
        followUpVisitNeeded,
        followUpDate: followUpVisitNeeded ? followUpDate : null,
        signatureUrl: signatureData,
        photoUrls,
      };

      const res = await fetch(`/api/service/visits/${completeModal.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchData();
        await fetchStats();
        setCompleteModal(null);
        setOutcomeNotes("");
        setSelectedOutcome("Resolved");
        setReasonNextSteps("");
        setFollowUpVisitNeeded(false);
        setFollowUpDate("");
        setSparePartsUsed([]);
        setStructuredParts([]);
        setSignatureData(null);
        setPhotoUrls([]);
        setReturnedParts([]);
        setEngineerHolding([]);
        setSelectedRow(null);
        toast.success("Visit completed successfully.");
      } else {
        const err = await res.json();
        toast.error(`Failed to complete: ${err.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompleting(false);
    }
  };

  const handleGeneratePdf = async (visitId: string) => {
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/service/visits/${visitId}/generate-report`, { method: "POST" });
      const json = await res.json();
      if (json.success && json.fileUrl) {
        window.open(json.fileUrl, "_blank");
      } else {
        toast.error(json.message || "Failed to generate PDF");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleEmailReport = async (visitId: string) => {
    const email = prompt("Enter recipient email address:", selectedRow?.customer?.email || "");
    if (!email) return;
    setEmailingReport(true);
    try {
      const res = await fetch(`/api/service/visits/${visitId}/email-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Report emailed to ${email}`);
      } else {
        toast.error(json.message || "Failed to email report");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to email report");
    } finally {
      setEmailingReport(false);
    }
  };

  const kpiFilterMap: Record<string, (v: any) => boolean> = {
    "Total Visits": () => true,
    "Scheduled Today": (v) => {
      if (!v.scheduledDate) return false;
      const d = new Date(v.scheduledDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      return d >= today && d < tomorrow;
    },
    "Upcoming This Week": (v) => {
      if (!v.scheduledDate) return false;
      const d = new Date(v.scheduledDate);
      return d >= NOW && d <= new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    },
    "Overdue": (v) => v.status === "Overdue",
    "Completed This Month": (v) => {
      if (v.status !== "Completed" && v.status !== "Closed") return false;
      const d = v.completedAt ? new Date(v.completedAt) : new Date(v.updatedAt);
      return d.getMonth() === NOW.getMonth() && d.getFullYear() === NOW.getFullYear();
    },
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (kpiFilter && kpiFilterMap[kpiFilter]) {
        if (!kpiFilterMap[kpiFilter](item)) return false;
      }
      if (statusFilter && item.status !== statusFilter) return false;
      if (engineerFilter && item.engineerId !== engineerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.visitCode?.toLowerCase().includes(q) ||
          item.customer?.name?.toLowerCase().includes(q) ||
          item.customerAsset?.productName?.toLowerCase().includes(q) ||
          item.engineer?.user?.name?.toLowerCase().includes(q) ||
          item.source?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [data, kpiFilter, statusFilter, engineerFilter, searchQuery]);

  const tableColumns: ColumnDef<any>[] = [
    {
      header: "Visit Date",
      accessorKey: "visitDate",
      cell: (row) => (
        <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
          {row.visitDate ? new Date(row.visitDate).toLocaleDateString() + " " + new Date(row.visitDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
        </span>
      ),
    },
    {
      header: "Customer",
      accessorKey: "customer.name",
      cell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{row.customer?.name || "-"}</span>,
    },
    {
      header: "Asset",
      accessorKey: "customerAsset.productName",
      cell: (row) => <span className="text-xs text-[var(--text-secondary)]">{row.customerAsset?.productName || "-"}</span>,
    },
    {
      header: "Engineer",
      accessorKey: "engineer.user.name",
      cell: (row) => <span className="text-xs text-[var(--text-secondary)]">{row.engineer?.user?.name || "Unassigned"}</span>,
    },
    {
      header: "Source",
      accessorKey: "source",
      cell: (row) => {
        if (!row.sourceInfo) return <span className="text-xs text-[var(--text-muted)]">-</span>;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(row.sourceInfo.href); }}
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
          >
            {row.sourceInfo.type}
          </button>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const colorClass =
          row.status === "Overdue" ? "bg-red-500/10 text-red-500 border-red-500/20" :
          row.status === "Completed" || row.status === "Closed" ? "bg-green-500/10 text-green-500 border-green-500/20" :
          row.status === "Scheduled" || row.status === "Assigned" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
          "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]";
        return <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", colorClass)}>{row.status}</span>;
      },
    },
    {
      header: "Action",
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedRow(row); }}
          className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  // ── Complete Modal ──
  if (completeModal) {
    const requiresNextSteps = ["Escalated", "Follow-up Required", "Parts Pending"].includes(selectedOutcome);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h3 className="text-sm font-black text-[var(--text-primary)]">Checkout & Complete Visit</h3>
            <button 
              onClick={() => { 
                setCompleteModal(null); 
                setOutcomeNotes(""); 
                setSelectedOutcome("Resolved");
                setReasonNextSteps("");
                setFollowUpVisitNeeded(false);
                setFollowUpDate("");
                setSparePartsUsed([]);
                setStructuredParts([]);
                setSignatureData(null);
                setPhotoUrls([]);
                setReturnedParts([]);
                setEngineerHolding([]);
              }} 
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-bold">{completeModal.visitCode}</span> — {completeModal.customer?.name}
            </div>

            {/* Outcome Selection */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Outcome <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedOutcome}
                onChange={(e) => setSelectedOutcome(e.target.value)}
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="Resolved">Resolved</option>
                <option value="Partially Resolved">Partially Resolved</option>
                <option value="Escalated">Escalated</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Parts Pending">Parts Pending</option>
              </select>
            </div>

            {/* Outcome Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Work Performed Description (Min 20 characters) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                rows={3}
                placeholder="Describe work done, testing completed, outcome details..."
                className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
              <span className="text-[10px] text-[var(--text-muted)] block">
                {outcomeNotes.length}/20 characters minimum
              </span>
            </div>

            {/* Conditionally Required Details */}
            {requiresNextSteps && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  Reason & Next Steps (Min 10 characters) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reasonNextSteps}
                  onChange={(e) => setReasonNextSteps(e.target.value)}
                  rows={2}
                  placeholder={`Explain why the visit is ${selectedOutcome} and specify next action items...`}
                  className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
                />
              </div>
            )}

            {/* Spare Parts Section (Legacy product-based) */}
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Spare Parts Used (Product Catalogue) {selectedOutcome === "Parts Pending" && <span className="text-red-500">*</span>}
              </label>
              
              <div className="flex gap-2">
                <select
                  id="part-select"
                  className="flex-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Product Part --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.productCode || "Part"})</option>
                  ))}
                </select>
                <input
                  id="part-qty"
                  type="number"
                  placeholder="Qty"
                  defaultValue="1"
                  min="1"
                  className="w-16 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    const sel = document.getElementById("part-select") as HTMLSelectElement;
                    const qty = document.getElementById("part-qty") as HTMLInputElement;
                    if (sel && sel.value) {
                      const prod = products.find((p) => p.id === sel.value);
                      if (prod) {
                        setSparePartsUsed(prev => [...prev, { productId: prod.id, name: prod.name, quantity: parseInt(qty.value) || 1 } as any]);
                        sel.value = "";
                        qty.value = "1";
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  Add Part
                </button>
              </div>

              {sparePartsUsed.length > 0 && (
                <div className="space-y-1 bg-[var(--surface-2)] p-2 rounded-lg border border-[var(--border)]">
                  {sparePartsUsed.map((item: any, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-[var(--text-secondary)]">{item.name || item.productId}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)]">x{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setSparePartsUsed(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-400 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Structured Spare Parts (Feature 2) */}
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Structured Spare Parts (Master Data)
              </label>
              
              <div className="flex gap-2">
                <select
                  id="structured-part-select"
                  className="flex-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Spare Part --</option>
                  {sparePartMaster.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.partName} ({p.partCode}) — ₹{p.unitCost}</option>
                  ))}
                </select>
                <input
                  id="structured-part-qty"
                  type="number"
                  placeholder="Qty"
                  defaultValue="1"
                  min="1"
                  className="w-16 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-blue-500 text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    const sel = document.getElementById("structured-part-select") as HTMLSelectElement;
                    const qty = document.getElementById("structured-part-qty") as HTMLInputElement;
                    if (sel && sel.value) {
                      const part = sparePartMaster.find((p) => p.id === sel.value);
                      if (part) {
                        setStructuredParts(prev => [...prev, {
                          sparePartId: part.id,
                          partName: part.partName,
                          quantity: parseInt(qty.value) || 1,
                          unitCost: part.unitCost || 0,
                        }]);
                        sel.value = "";
                        qty.value = "1";
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-bold"
                >
                  Add
                </button>
              </div>

              {structuredParts.length > 0 && (
                <div className="space-y-1 bg-[var(--surface-2)] p-2 rounded-lg border border-[var(--border)]">
                  {structuredParts.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex flex-col">
                        <span className="text-[var(--text-secondary)]">{item.partName}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">₹{item.unitCost} × {item.quantity} = ₹{item.unitCost * item.quantity}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStructuredParts(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-400 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border)] pt-1 mt-1 flex justify-between text-xs font-bold">
                    <span className="text-[var(--text-secondary)]">Total Parts Cost</span>
                    <span className="text-[var(--text-primary)]">₹{structuredParts.reduce((sum, p) => sum + p.unitCost * p.quantity, 0)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Return Unused Parts (Inventory v1) */}
            {engineerHolding.length > 0 && (
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  Return Unused Parts (from engineer holding)
                </label>
                <div className="space-y-1 bg-[var(--surface-2)] p-2 rounded-lg border border-[var(--border)]">
                  {engineerHolding.map((h, idx) => {
                    const alreadyReturned = returnedParts.find((r) => r.sparePartId === h.sparePart.id);
                    const remaining = h.holding - (alreadyReturned?.quantity || 0);
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[var(--text-secondary)] truncate block">{h.sparePart.partName} ({h.sparePart.partCode})</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Holding: {h.holding} {h.sparePart.unit || "pcs"}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            defaultValue="0"
                            id={`return-qty-${h.sparePart.id}`}
                            className="w-14 text-xs rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-center"
                            placeholder="0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`return-qty-${h.sparePart.id}`) as HTMLInputElement;
                              const qty = parseInt(input.value) || 0;
                              if (qty > 0 && qty <= remaining) {
                                setReturnedParts(prev => {
                                  const existing = prev.find((r) => r.sparePartId === h.sparePart.id);
                                  if (existing) {
                                    return prev.map((r) => r.sparePartId === h.sparePart.id ? { ...r, quantity: r.quantity + qty } : r);
                                  }
                                  return [...prev, { sparePartId: h.sparePart.id, partName: h.sparePart.partName, quantity: qty }];
                                });
                                input.value = "0";
                              }
                            }}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold"
                          >
                            Return
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {returnedParts.length > 0 && (
                  <div className="space-y-1 bg-green-500/5 p-2 rounded-lg border border-green-500/20">
                    {returnedParts.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-secondary)]">{item.partName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-500">+{item.quantity} returned</span>
                          <button
                            type="button"
                            onClick={() => setReturnedParts(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-400 font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Proof of Work — Signature (Feature 3) */}
            {selectedOutcome === "Resolved" && (
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  Customer Signature <span className="text-red-500">*</span>
                </label>
                <SignaturePad onChange={setSignatureData} value={signatureData} />
              </div>
            )}

            {/* Proof of Work — Site Photos (Feature 3) */}
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                Site Photos {selectedOutcome === "Resolved" && <span className="text-red-500">*</span>}
              </label>
              <PhotoUploader
                visitId={completeModal.id}
                photos={photoUrls}
                onPhotosChange={setPhotoUrls}
                uploading={uploadingPhotos}
                setUploading={setUploadingPhotos}
              />
            </div>

            {/* Follow-up Visit Needed */}
            <div className="space-y-3 border-t border-[var(--border)] pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="followUpNeeded"
                  checked={followUpVisitNeeded}
                  onChange={(e) => setFollowUpVisitNeeded(e.target.checked)}
                  className="rounded border-[var(--border)] text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="followUpNeeded" className="text-xs font-bold text-[var(--text-primary)]">
                  Follow-up Field Visit Required?
                </label>
              </div>

              {followUpVisitNeeded && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                    Follow-up Date & Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              onClick={() => { 
                setCompleteModal(null); 
                setOutcomeNotes(""); 
                setSelectedOutcome("Resolved");
                setReasonNextSteps("");
                setFollowUpVisitNeeded(false);
                setFollowUpDate("");
                setSparePartsUsed([]);
                setStructuredParts([]);
                setSignatureData(null);
                setPhotoUrls([]);
                setReturnedParts([]);
                setEngineerHolding([]);
              }}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={completing || outcomeNotes.trim().length < 20}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {completing ? "Completing..." : "Check Out & Complete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form View ──
  if (isFormOpen) {
    const initialData: any = {};
    if (prefilledCustomerId) initialData.customerId = prefilledCustomerId;
    if (prefilledAssetId) initialData.assetId = prefilledAssetId;

    return (
      <div className="py-6">
        <button
          onClick={() => { setIsFormOpen(false); router.replace("/service/visits"); }}
          className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <ChevronLeft size={16} /> Back to Visits
        </button>
        <ServiceModuleForm
          config={config}
          initialData={initialData}
          onCancel={() => { setIsFormOpen(false); router.replace("/service/visits"); }}
          onSubmit={handleCreateNew}
          relationsData={refData}
        />
      </div>
    );
  }

  // ── Detail View ──
  if (selectedRow) {
    const source = getSourceInfo(selectedRow);
    const canCheckIn = selectedRow.status === "Scheduled" || selectedRow.status === "Assigned" || selectedRow.status === "Overdue";
    const canCheckOut = selectedRow.status === "In Progress";

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedRow(null)}
            className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronLeft size={16} /> Back to List
          </button>
          <div className="flex items-center gap-2">
            {canCheckIn && (
              <button
                onClick={() => handleCheckIn(selectedRow)}
                disabled={checkingIn}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {checkingIn ? "Checking In..." : "Check In"}
              </button>
            )}
            {canCheckOut && (
              <button
                onClick={() => setCompleteModal(selectedRow)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Check Out & Complete
              </button>
            )}
            {selectedRow.status === "Completed" && (
              <>
                <button
                  onClick={() => handleGeneratePdf(selectedRow.id)}
                  disabled={generatingPdf}
                  className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {generatingPdf ? "Generating..." : "Download PDF"}
                </button>
                <button
                  onClick={() => handleEmailReport(selectedRow.id)}
                  disabled={emailingReport}
                  className="px-3 py-1.5 border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {emailingReport ? "Sending..." : "Email to Customer"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)]">{selectedRow.visitCode}</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-bold border",
              selectedRow.status === "Overdue" ? "bg-red-500/10 text-red-500 border-red-500/20" :
              selectedRow.status === "Completed" || selectedRow.status === "Closed" ? "bg-green-500/10 text-green-500 border-green-500/20" :
              "bg-blue-500/10 text-blue-500 border-blue-500/20"
            )}>
              {selectedRow.status}
            </span>
            {selectedRow.status === "In Progress" && elapsedTimeText && (
              <span className="text-xs text-amber-500 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                {elapsedTimeText}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">{selectedRow.title || "Service Visit"}</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Customer: <span className="text-[var(--text-primary)] font-semibold">{selectedRow.customer?.name || "N/A"}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">Visit Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Visit Date</span>
                <span className="text-[var(--text-primary)] block font-medium">
                  {selectedRow.scheduledDate ? new Date(selectedRow.scheduledDate).toLocaleString() : "-"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Engineer</span>
                <span className="text-[var(--text-primary)] block font-medium">{selectedRow.engineer?.user?.name || "Unassigned"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Customer Asset</span>
                <span className="text-[var(--text-primary)] block font-medium">{selectedRow.customerAsset?.productName || "-"}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Billing Eligibility</span>
                {selectedRow.customerAsset?.amcExpiryDate && new Date(selectedRow.customerAsset.amcExpiryDate) > new Date() ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-[10px] font-bold border border-green-500/20">
                    Covered under AMC — no billing
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20">
                    Billable visit
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-[var(--text-secondary)] block font-semibold">Completed At</span>
                <span className="text-[var(--text-primary)] block font-medium">
                  {selectedRow.completedAt ? new Date(selectedRow.completedAt).toLocaleString() : "-"}
                </span>
              </div>
              <div className="space-y-1 md:col-span-2">
                <span className="text-[var(--text-secondary)] block font-semibold">Notes</span>
                <span className="text-[var(--text-primary)] block font-medium">{selectedRow.notes || "-"}</span>
              </div>
              {selectedRow.outcomeNotes && (
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[var(--text-secondary)] block font-semibold">Outcome Notes</span>
                  <span className="text-[var(--text-primary)] block font-medium">{selectedRow.outcomeNotes}</span>
                </div>
              )}
              {selectedRow.partsUsed && selectedRow.partsUsed.length > 0 && (
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[var(--text-secondary)] block font-semibold">Spare Parts Used</span>
                  <div className="space-y-1">
                    {selectedRow.partsUsed.map((part: any) => (
                      <div key={part.id} className="flex justify-between text-xs bg-[var(--surface-2)] px-2 py-1 rounded border border-[var(--border)]">
                        <span className="text-[var(--text-primary)]">{part.partName}</span>
                        <span className="text-[var(--text-secondary)]">x{part.quantity} — ₹{part.totalCost}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold border-t border-[var(--border)] pt-1 mt-1">
                      <span className="text-[var(--text-secondary)]">Total Parts Cost</span>
                      <span className="text-[var(--text-primary)]">₹{selectedRow.partsUsed.reduce((sum: number, p: any) => sum + (p.totalCost || 0), 0)}</span>
                    </div>
                  </div>
                </div>
              )}
              {selectedRow.signatureUrl && (
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[var(--text-secondary)] block font-semibold">Customer Signature</span>
                  <img src={selectedRow.signatureUrl} alt="Customer Signature" className="border border-[var(--border)] rounded-lg max-w-[300px]" />
                </div>
              )}
              {selectedRow.photos && selectedRow.photos.length > 0 && (
                <div className="space-y-1 md:col-span-2">
                  <span className="text-[var(--text-secondary)] block font-semibold">Site Photos</span>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedRow.photos.map((photo: any) => (
                      <img key={photo.id} src={photo.photoUrl} alt={photo.caption || "Site photo"} className="w-full h-24 object-cover rounded-lg border border-[var(--border)]" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">Source Record</h3>
            {source ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-500">
                    {source.type}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">{source.code}</span>
                </div>
                <button
                  onClick={() => router.push(source.href)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Update {source.type} Status →
                </button>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">This visit was created standalone (no source record linked).</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">{config.displayTitle}</h1>
          <p className="text-xs text-[var(--text-muted)]">Schedule and track field service visits.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchData(); fetchStats(); }}
            className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-all"
            title="Refresh"
          >
            <RefreshCw size={15} className={cn(loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-1 px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-colors"
          >
            <Plus size={14} /> New Visit
          </button>
        </div>
      </div>

      <ServiceKPIGrid>
        <KPICard label="Total Visits" value={stats.total} icon={<Calendar size={20} className="text-blue-500" />} color="bg-blue-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Total Visits"} />
        <KPICard label="Scheduled Today" value={stats.scheduledToday} icon={<Clock size={20} className="text-amber-500" />} color="bg-amber-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Scheduled Today"} />
        <KPICard label="Upcoming This Week" value={stats.upcomingThisWeek} icon={<CalendarDays size={20} className="text-purple-500" />} color="bg-purple-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Upcoming This Week"} />
        <KPICard label="Overdue" value={stats.overdue} icon={<AlertTriangle size={20} className="text-red-500" />} color="bg-red-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Overdue"} />
        <KPICard label="Completed This Month" value={stats.completedThisMonth} icon={<CheckCircle size={20} className="text-green-500" />} color="bg-green-500/10" onClick={(f) => setKpiFilter(f)} active={kpiFilter === "Completed This Month"} />
      </ServiceKPIGrid>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl backdrop-blur-md">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by code, customer, asset, engineer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Overdue">Overdue</option>
        </select>
        <select
          value={engineerFilter}
          onChange={(e) => setEngineerFilter(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All Engineers</option>
          {(refData.ServiceEngineer || []).map((eng: any) => (
            <option key={eng.value} value={eng.value}>{eng.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <DataTable data={filteredData} columns={tableColumns} />
      </div>
    </div>
  );
}
