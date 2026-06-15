"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getCustomerByIdAction } from "@/app/actions/customers";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import { NotePanel } from "@/components/ui/NotePanel";
import { getInitials, getAvatarColor, formatDateTime, formatCurrency, cn } from "@/lib/ui-utils";
import {
  ArrowLeft, Briefcase, Phone, Mail, MapPin, Building2,
  CalendarClock, User, Clock, AlertTriangle, CheckCircle2,
  History, MessagesSquare, FileText
} from "lucide-react";

type Tab = "overview" | "deals" | "communications";

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contactId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();

  const [contact, setContact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomerByIdAction(contactId);
      if (res.success && res.data) {
        setContact(res.data);
      } else {
        toast.error("Contact not found.");
        router.push("/contacts");
      }
    } finally {
      setLoading(false);
    }
  }, [contactId, router, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="spinner-brand" />
          <p className="text-sm font-medium">Loading contact details...</p>
        </div>
      </div>
    );
  }

  if (!contact) return null;

  const initials = getInitials(contact.name);
  const avatarColor = getAvatarColor(contact.name);

  // Compile communications timeline
  const followUps = contact.followUps || [];
  const calls = contact.callLogs || [];
  const visits = contact.marketingVisits || [];
  const inboundVisits = contact.customerVisits || [];

  const allCommunications = [
    ...followUps.map((f: any) => ({
      id: `f-${f.id}`,
      type: "Follow-up",
      title: `Follow-up — ${f.status}`,
      description: f.remarks || f.notes || "No notes provided.",
      timestamp: f.nextMeetingDate || f.createdAt,
      color: f.status === "Completed" ? "green" : f.status === "Overdue" ? "red" : "brand",
    })),
    ...calls.map((c: any) => ({
      id: `c-${c.id}`,
      type: "Call",
      title: `Phone Call — ${c.callType} (${c.callOutcome})`,
      description: c.summary || "No call summary.",
      timestamp: c.timestamp,
      color: c.callOutcome === "Interested" ? "green" : "slate",
    })),
    ...visits.map((v: any) => ({
      id: `v-${v.id}`,
      type: "Visit",
      title: `Field Visit — ${v.visitPurpose}`,
      description: v.discussionSummary || "No visit summary.",
      timestamp: v.createdAt,
      color: "brand",
    })),
    ...inboundVisits.map((v: any) => ({
      id: `iv-${v.id}`,
      type: "Inbound Visit",
      title: `Office Visit — ${v.purpose}`,
      description: `Hosted by ${v.host?.name || "Unknown"}`,
      timestamp: v.createdAt,
      color: "brand",
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="page-shell max-w-5xl mx-auto">
      {/* Back */}
      <div>
        <button
          onClick={() => router.push("/contacts")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to Contacts
        </button>
      </div>

      {/* Header card */}
      <div className="crm-card p-6 border-t-4 border-t-[var(--primary)]">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 shadow-sm text-white", avatarColor)}>
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{contact.name}</h1>
              <StatusBadge status={contact.status} showDot size="md" />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {contact.email && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <Mail size={13} className="text-slate-400" /> {contact.email}
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <Phone size={13} className="text-slate-400" /> {contact.phone}
                </div>
              )}
              {contact.city && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <MapPin size={13} className="text-slate-400" /> {contact.city}
                </div>
              )}
              {contact.leadSource && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm border-l border-slate-200 pl-4">
                  <Building2 size={13} className="text-slate-400" /> {contact.leadSource}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                Code: <span className="font-mono font-semibold text-slate-600">{contact.customerCode}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                Origin: <span className="font-semibold text-slate-600">{contact.convertedFromLead ? "Lead Conversion" : "Direct Entry"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 mt-6 border-t border-slate-100 pt-4">
          {(["overview", "deals", "communications"] as Tab[]).map((t) => (
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
              {t === "deals" && <Briefcase size={13} />}
              {t === "communications" && <MessagesSquare size={13} />}
              {t === "overview" ? "Overview" :
               t === "deals" ? `Deals (${contact.deals?.length || 0})` :
               `Communications (${allCommunications.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          {/* Contact Details */}
          <div className="space-y-5">
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Contact Information</h3>
              <dl className="space-y-3">
                {[
                  { label: "Full Name",     value: contact.name },
                  { label: "Email Address", value: contact.email || "—" },
                  { label: "Phone Number",  value: contact.phone || "—" },
                  { label: "City",          value: contact.city || "—" },
                  { label: "Lead Source",   value: contact.leadSource || "—" },
                  { label: "Status",        value: <StatusBadge status={contact.status} /> },
                  { label: "Contact Code",  value: <span className="font-mono">{contact.customerCode}</span> },
                  { label: "Created On",    value: formatDateTime(contact.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <dt className="text-xs font-semibold text-slate-400 shrink-0">{label}</dt>
                    <dd className="text-xs font-semibold text-slate-700 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Subscriptions (if any) */}
            {contact.subscriptions && contact.subscriptions.length > 0 && (
              <div className="crm-card p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4">Active Subscriptions</h3>
                <div className="space-y-3">
                  {contact.subscriptions.map((sub: any) => (
                    <div key={sub.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">{sub.planName}</span>
                        <StatusBadge status={sub.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-2 flex justify-between">
                        <span>Renews: {new Date(sub.endDate).toLocaleDateString()}</span>
                        <span className="font-medium text-slate-700">{formatCurrency(sub.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes Integration */}
          <div>
            <NotePanel entityType="CONTACT" entityId={contact.id} />
          </div>
        </div>
      )}

      {/* ── Deals Tab ── */}
      {tab === "deals" && (
        <div className="crm-card mt-5 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Associated Deals</h3>
            <span className="text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1 font-semibold border border-slate-100">
              {contact.deals?.length || 0} Total
            </span>
          </div>
          
          {(!contact.deals || contact.deals.length === 0) ? (
            <div className="text-center py-10">
              <Briefcase size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No deals associated yet</p>
              <p className="text-xs text-slate-300 mt-0.5">When deals are created for this contact, they will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Deal Name</th>
                    <th className="px-5 py-3">Stage</th>
                    <th className="px-5 py-3">Value</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {contact.deals.map((deal: any) => (
                    <tr key={deal.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/deals/${deal.id}`)}>
                      <td className="px-5 py-3 font-semibold text-slate-700">{deal.dealName}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium border border-slate-200">
                          {deal.stage}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-emerald-600">{formatCurrency(deal.dealValue)}</td>
                      <td className="px-5 py-3 text-slate-500">{new Date(deal.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <button className="text-[var(--primary)] text-xs font-semibold hover:underline">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Communications Tab ── */}
      {tab === "communications" && (
        <div className="crm-card p-5 mt-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-700">Communication Timeline</h3>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--primary)]" /> Action</span>
              <span className="flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-green-500" /> Success</span>
              <span className="flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
            </div>
          </div>

          {allCommunications.length === 0 ? (
            <div className="text-center py-10">
              <MessagesSquare size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-400">No communications recorded</p>
              <p className="text-xs text-slate-300 mt-0.5">Calls, visits, and follow-ups will populate this timeline.</p>
            </div>
          ) : (
            <div className="pl-2">
              <Timeline events={allCommunications} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
