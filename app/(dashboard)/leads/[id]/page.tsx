"use client";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getLeadByIdAction, convertLeadToDealAction } from "@/app/actions/leads";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import { getInitials, getAvatarColor, formatDate, formatDateTime, cn } from "@/lib/ui-utils";
import CustomerLifecycleStepper from "@/components/CustomerLifecycleStepper";
import GuidedWorkflowBanner from "@/components/GuidedWorkflowBanner";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input } from "@/components/ui/FormField";
import {
  ArrowLeft, Briefcase, Phone, Mail, MapPin, Building2,
  CalendarClock, User, Plus, Clock, AlertTriangle, CheckCircle2,
  ShieldAlert, History,
} from "lucide-react";

type Tab = "overview" | "followups" | "ownership";

const SLA_BADGE: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  Pending: {
    label: "SLA Pending — Awaiting Response",
    icon: <Clock size={14} />,
    cls: "bg-amber-50 border border-amber-200 text-amber-700",
  },
  Warning: {
    label: "SLA Warning — Response Overdue",
    icon: <AlertTriangle size={14} />,
    cls: "bg-orange-50 border border-orange-200 text-orange-700",
  },
  Breached: {
    label: "SLA Breached — Immediate Action Required",
    icon: <ShieldAlert size={14} />,
    cls: "bg-red-50 border border-red-200 text-red-700",
  },
  Met: {
    label: "SLA Met — First Response Recorded",
    icon: <CheckCircle2 size={14} />,
    cls: "bg-green-50 border border-green-200 text-green-700",
  },
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const leadId = resolvedParams.id;
  const router  = useRouter();
  const toast   = useToast();
  const [lead,      setLead]      = useState<any>(null);
  const [followups, setFollowups] = useState<any[]>([]);
  const [ownership, setOwnership] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<Tab>("overview");

  const [convertModal, setConvertModal] = useState(false);
  const [dealName, setDealName] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [converting, setConverting] = useState(false);

  const openConvertModal = () => {
    if (!lead) return;
    setDealName(`${lead.name} - Initial Deal`);
    setDealValue("150000");
    const date = new Date();
    date.setDate(date.getDate() + 30);
    setExpectedCloseDate(date.toISOString().substring(0, 10));
    setConvertModal(true);
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealName || !dealValue || !expectedCloseDate) {
      toast.error("Please fill in all fields");
      return;
    }
    const val = parseFloat(dealValue);
    if (isNaN(val) || val <= 0) {
      toast.error("Deal value must be positive");
      return;
    }
    setConverting(true);
    const res = await convertLeadToDealAction(lead.id, dealName, val, expectedCloseDate);
    if (res.success && res.dealId) {
      toast.success("Lead successfully converted to Customer and Deal created!");
      router.push(`/deals/${res.dealId}`);
    } else {
      toast.error(res.message || "Failed to convert lead.");
    }
    setConverting(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeadByIdAction(leadId);
      if (res.success && res.data) {
        setLead(res.data);
        setFollowups((res.data as any).followUps || []);
        setOwnership((res.data as any).ownerHistory || []);
      } else {
        toast.error("Lead not found.");
        router.push("/leads");
      }
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="spinner-brand" />
          <p className="text-sm font-medium">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  const initials    = getInitials(lead.name);
  const avatarColor = getAvatarColor(lead.name);
  const slaInfo     = SLA_BADGE[lead.slaStatus as string] || SLA_BADGE["Pending"];

  const timelineEvents = followups.map((f: any) => ({
    id: f.id,
    title: `Follow-up — ${f.status}`,
    description: f.remarks || f.notes || "No notes",
    timestamp: f.nextMeetingDate,
    color: (f.status === "Completed" ? "green" : f.status === "Overdue" ? "red" : "brand") as "green" | "red" | "brand",
  }));

  const ownershipEvents = ownership.map((h: any) => ({
    id: h.id,
    title: h.changedById ? "Manual Reassignment" : "System Auto-Assignment",
    description: `${h.fromUser?.name || "—"} → ${h.toUser?.name || "—"}${h.reason ? ` · ${h.reason}` : ""}`,
    timestamp: h.timestamp,
    color: (h.changedById ? "brand" : "red") as "brand" | "red",
  }));

  return (
    <div className="page-shell max-w-5xl mx-auto">
      {/* Back */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <ArrowLeft size={16} /> Back to Leads
        </button>
      </div>

      {/* SLA Banner */}
      {lead.slaStatus && (
        <div className={cn("flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold", slaInfo.cls)}>
          {slaInfo.icon}
          <span>{slaInfo.label}</span>
          {lead.slaResponseDeadline && lead.slaStatus !== "Met" && (
            <span className="ml-auto text-xs font-normal opacity-75">
              Deadline: {formatDateTime(lead.slaResponseDeadline)}
            </span>
          )}
          {lead.firstRespondedAt && lead.slaStatus === "Met" && (
            <span className="ml-auto text-xs font-normal opacity-75">
              Responded: {formatDateTime(lead.firstRespondedAt)}
            </span>
          )}
        </div>
      )}

      {/* Guided Workflow Banner */}
      <div className="mt-4">
        <GuidedWorkflowBanner
          entityType="lead"
          entityId={lead.id}
          status={lead.status}
          entityName={lead.name}
          onRefresh={load}
        />
      </div>

      {/* Customer Lifecycle Stepper */}
      <div className="crm-card p-5 mt-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Customer Lifecycle</h3>
        <CustomerLifecycleStepper currentStage={lead.status} />
      </div>

      {/* Header card */}
      <div className="crm-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 shadow-sm", avatarColor)}>
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{lead.name}</h1>
              <StatusBadge status={lead.status} showDot size="md" />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {lead.email && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <Mail size={13} className="text-slate-400" /> {lead.email}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <Phone size={13} className="text-slate-400" /> {lead.phone}
                </div>
              )}
              {lead.city && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <MapPin size={13} className="text-slate-400" /> {lead.city}
                </div>
              )}
              {lead.leadSource && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <Building2 size={13} className="text-slate-400" /> {lead.leadSource}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <User size={11} /> Assigned to:{" "}
                <span className="font-semibold text-slate-600">{lead.assignedUser?.name || "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                Code: <span className="font-mono font-semibold text-slate-600">{lead.leadCode}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                Escalation Level:{" "}
                <span className={cn(
                  "font-semibold",
                  lead.escalationLevel === 0 ? "text-slate-600" :
                  lead.escalationLevel === 1 ? "text-orange-600" : "text-red-600"
                )}>
                  L{lead.escalationLevel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                Created: <span className="text-slate-600 font-semibold">{formatDate(lead.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {lead.status !== "Converted" ? (
              <button
                onClick={openConvertModal}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Briefcase size={13} /> Convert to Deal
              </button>
            ) : (
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl font-bold border border-emerald-100 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Converted
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 mt-6 border-t border-slate-100 pt-4">
          {(["overview", "followups", "ownership"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "text-sm font-semibold capitalize pb-2 border-b-2 transition-colors flex items-center gap-1.5",
                tab === t
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-slate-400 hover:text-slate-600",
              )}
            >
              {t === "followups" && <CalendarClock size={13} />}
              {t === "ownership" && <History size={13} />}
              {t === "followups" ? `Follow-ups (${followups.length})` :
               t === "ownership" ? `Owner History (${ownership.length})` : "Overview"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Lead details */}
          <div className="crm-card p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Lead Information</h3>
            <dl className="space-y-3">
              {[
                { label: "Full Name",     value: lead.name },
                { label: "Email",         value: lead.email || "—" },
                { label: "Phone",         value: lead.phone || "—" },
                { label: "Location",      value: lead.city || "—" },
                { label: "Lead Source",   value: lead.leadSource || "—" },
                { label: "Status",        value: <StatusBadge status={lead.status} /> },
                { label: "SLA Status",    value: <StatusBadge status={lead.slaStatus} /> },
                { label: "Escalation",    value: `Level ${lead.escalationLevel}` },
                { label: "Assigned To",   value: lead.assignedUser?.name || "Unassigned" },
                { label: "Lead Code",     value: <span className="font-mono">{lead.leadCode}</span> },
                { label: "Created",       value: formatDateTime(lead.createdAt) },
                { label: "Last Activity", value: formatDateTime(lead.lastInteractionAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <dt className="text-xs font-semibold text-slate-400 shrink-0">{label}</dt>
                  <dd className="text-xs font-semibold text-slate-700 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* SLA Detail card */}
          <div className="crm-card p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">SLA & Escalation Details</h3>
            <dl className="space-y-3">
              {[
                { label: "SLA Status",        value: lead.slaStatus },
                { label: "SLA Deadline",      value: lead.slaResponseDeadline ? formatDateTime(lead.slaResponseDeadline) : "—" },
                { label: "First Response At", value: lead.firstRespondedAt ? formatDateTime(lead.firstRespondedAt) : "Not yet responded" },
                { label: "Escalation Level",  value: `Level ${lead.escalationLevel} (${lead.escalationLevel === 0 ? "No Escalation" : lead.escalationLevel === 1 ? "Manager Notified — 48h" : "Auto-Reassigned — 72h"})` },
                { label: "Last Interaction",  value: formatDateTime(lead.lastInteractionAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <dt className="text-xs font-semibold text-slate-400 shrink-0">{label}</dt>
                  <dd className="text-xs font-semibold text-slate-700 text-right">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Notes */}
            {lead.notes && (
              <>
                <h3 className="text-sm font-bold text-slate-700 mt-6 mb-3">Notes</h3>
                <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100 leading-relaxed">
                  {lead.notes}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Follow-ups Tab ── */}
      {tab === "followups" && (
        <div className="crm-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-700">Follow-up History</h3>
            <button onClick={() => router.push("/follow-up")} className="btn-primary text-xs">
              <Plus size={13} /> Add Follow-up
            </button>
          </div>
          {followups.length === 0 ? (
            <div className="text-center py-10">
              <CalendarClock size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No follow-ups scheduled</p>
              <p className="text-xs text-slate-300 mt-0.5">Schedule a follow-up to keep this lead warm</p>
            </div>
          ) : (
            <Timeline events={timelineEvents} />
          )}
        </div>
      )}

      {/* ── Owner History Tab ── */}
      {tab === "ownership" && (
        <div className="crm-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-700">Lead Ownership & Transfer History</h3>
            <span className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
              {ownership.length} record{ownership.length !== 1 ? "s" : ""}
            </span>
          </div>
          {ownershipEvents.length === 0 ? (
            <div className="text-center py-10">
              <History size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No ownership history yet</p>
              <p className="text-xs text-slate-300 mt-0.5">Assignment and reassignment events will appear here</p>
            </div>
          ) : (
            <Timeline events={ownershipEvents} />
          )}
        </div>
      )}

      {/* Convert Lead to Deal Modal */}
      <Modal
        open={convertModal}
        onClose={() => setConvertModal(false)}
        title="Convert Lead to Customer & Deal"
        subtitle="This will promote the lead to an Active Prospect / Customer and initialize a new pipeline deal."
        footer={
          <>
            <button type="button" onClick={() => setConvertModal(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" form="convert-lead-form" disabled={converting} className="btn-primary text-sm">
              {converting ? <><span className="spinner-brand" /> Converting...</> : "Convert & Create"}
            </button>
          </>
        }
      >
        <form id="convert-lead-form" onSubmit={handleConvert} className="p-6 space-y-4">
          <FormField label="Deal Name" required>
            <Input
              value={dealName}
              onChange={e => setDealName(e.target.value)}
              placeholder="e.g. Acme Corp Enterprise Deal"
              required
            />
          </FormField>
          <FormField label="Deal Value (INR)" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
              <Input
                type="number"
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                required
              />
            </div>
          </FormField>
          <FormField label="Expected Close Date" required>
            <Input
              type="date"
              value={expectedCloseDate}
              onChange={e => setExpectedCloseDate(e.target.value)}
              required
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
