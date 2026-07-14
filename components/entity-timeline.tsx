"use client";

import { useEffect, useState } from "react";

interface TimelineEvent {
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  roundNumber: number | null;
  actorId: string | null;
  metadata: any;
  createdAt: string;
  actor: { id: string; name: string; email: string; role: string } | null;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  quotation_created: { label: "Quotation Created", color: "bg-blue-500" },
  quotation_sent: { label: "Quotation Sent", color: "bg-cyan-500" },
  quotation_accepted: { label: "Quotation Accepted", color: "bg-green-500" },
  quotation_rejected: { label: "Quotation Rejected", color: "bg-red-500" },
  quotation_cloned: { label: "Quotation Revised", color: "bg-indigo-500" },
  quotation_held: { label: "Put On Hold", color: "bg-amber-500" },
  quotation_resumed: { label: "Resumed from Hold", color: "bg-yellow-500" },
  quotation_discount_applied: { label: "Discount Applied", color: "bg-orange-500" },
  negotiation_started: { label: "Negotiation Started", color: "bg-purple-500" },
  negotiation_status_changed: { label: "Negotiation Status Changed", color: "bg-violet-500" },
  negotiation_closed_success: { label: "Negotiation Won 🤝", color: "bg-green-600" },
  negotiation_closed_failure: { label: "Negotiation Lost ❌", color: "bg-red-600" },
  revision_proposed: { label: "Revision Proposed", color: "bg-slate-500" },
  revision_auto_approved: { label: "Revision Auto-Approved", color: "bg-teal-500" },
  revision_approved: { label: "Revision Approved", color: "bg-green-600" },
  revision_rejected: { label: "Revision Rejected", color: "bg-red-500" },
  revision_applied: { label: "Revision Applied", color: "bg-emerald-600" },
  po_created: { label: "Purchase Order Created", color: "bg-blue-600" },
  po_status_changed: { label: "PO Status Changed", color: "bg-sky-500" },
  po_approved: { label: "PO Approved", color: "bg-green-600" },
  po_rejected: { label: "PO Rejected", color: "bg-red-500" },
  erp_synced: { label: "ERP Synced", color: "bg-emerald-500" },
  erp_sync_failed: { label: "ERP Sync Failed", color: "bg-red-600" },
  rfq_status_changed: { label: "RFQ Status Changed", color: "bg-gray-500" },
};

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
}

export function EntityTimeline({
  rootEntityId,
  entityType,
  entityId,
}: {
  rootEntityId?: string;
  entityType?: string;
  entityId?: string;
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (rootEntityId) params.set("rootEntityId", rootEntityId);
        if (entityType) params.set("entityType", entityType);
        if (entityId) params.set("entityId", entityId);
        params.set("limit", "200");

        const res = await fetch(`/api/entity-timeline?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch timeline");
        const json = await res.json();
        setEvents(json.data || []);
      } catch (err: any) {
        setError(err.message || "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, [rootEntityId, entityType, entityId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 text-center text-gray-500">Loading timeline...</div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 text-center text-red-500">{error}</div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 text-center text-gray-400">No activity recorded yet.</div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event, idx) => {
        const config = EVENT_LABELS[event.type] || { label: event.type, color: "bg-gray-400" };
        const isLast = idx === events.length - 1;
        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${config.color} mt-1.5 flex-shrink-0`} />
              {!isLast && <div className="w-0.5 flex-1 bg-gray-200 min-h-[2rem]" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-gray-900">{config.label}</span>
                  {event.roundNumber != null && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      Round {event.roundNumber}
                    </span>
                  )}
                  {event.fromStatus && event.toStatus && (
                    <span className="ml-2 text-xs text-gray-500">
                      {event.fromStatus} → {event.toStatus}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(event.createdAt)}</span>
              </div>

              {/* Metadata */}
              {event.metadata && (
                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                  {event.metadata.quotationCode && <div>Quotation: {event.metadata.quotationCode}</div>}
                  {event.metadata.poCode && <div>PO: {event.metadata.poCode}</div>}
                  {event.metadata.cumulativeDiscountPercent != null && (
                    <div>Cumulative Discount: {event.metadata.cumulativeDiscountPercent}%</div>
                  )}
                  {event.metadata.proposedAmount != null && (
                    <div>Proposed: {formatCurrency(event.metadata.proposedAmount)}</div>
                  )}
                  {event.metadata.finalAmount != null && (
                    <div>Final: {formatCurrency(event.metadata.finalAmount)}</div>
                  )}
                  {event.metadata.erpReferenceNumber && <div>ERP Ref: {event.metadata.erpReferenceNumber}</div>}
                  {event.metadata.reason && <div>Reason: {event.metadata.reason}</div>}
                </div>
              )}

              {/* Actor */}
              {event.actor && (
                <div className="mt-1 text-xs text-gray-400">
                  by {event.actor.name} ({event.actor.role})
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
