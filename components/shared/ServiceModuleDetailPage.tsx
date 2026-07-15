"use client";

import React from "react";
import { ServiceModuleConfig } from "@/lib/config/serviceModuleConfig";
import { ChevronLeft, ArrowRight, ShieldAlert, Award, Calendar } from "lucide-react";
import { cn } from "@/lib/ui-utils";
import { SLACountdownBadge, EscalationBanner, WarrantyAMCContextCard } from "./ServiceComponents";

interface ServiceModuleDetailPageProps {
  config: ServiceModuleConfig;
  data: any;
  onBack: () => void;
  onStatusTransition: (newStatus: string) => void;
  onTriggerAction: (actionId: string) => void;
  customWidgets?: React.ReactNode;
}

export default function ServiceModuleDetailPage({
  config,
  data,
  onBack,
  onStatusTransition,
  onTriggerAction,
  customWidgets,
}: ServiceModuleDetailPageProps) {
  if (!data) return null;

  const currentStatus = data.status;
  const transitions = config.allowedTransitions[currentStatus] || [];

  return (
    <div className="space-y-6">
      {/* Back button & Action buttons */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft size={16} /> Back to List
        </button>

        <div className="flex items-center gap-2">
          {config.allowedActions
            .filter(act => {
              if (act.id === "resolve_escalation") {
                return data.isEscalation === true && !data.escalationResolved;
              }
              return !act.requiredStatus || act.requiredStatus.includes(currentStatus);
            })
            .map(act => (
              <button
                key={act.id}
                onClick={() => onTriggerAction(act.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  act.variant === "primary" ? "bg-brand hover:bg-brand-hover text-white border-transparent" :
                  act.variant === "success" ? "bg-green-600 hover:bg-green-700 text-white border-transparent" :
                  act.variant === "danger" ? "bg-red-600 hover:bg-red-700 text-white border-transparent" :
                  "bg-[var(--surface-2)] hover:bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)]"
                )}
              >
                {act.label}
              </button>
            ))}
        </div>
      </div>

      {/* Top Header Card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)] block">
                {data.requestCode || data.complaintCode || data.id}
              </span>
              {data.dueDate && (
                <SLACountdownBadge dueDate={data.dueDate} status={currentStatus} />
              )}
            </div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">{data.title || data.details || `${config.entityLabel} Details`}</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Customer: <span className="text-[var(--text-primary)] font-semibold">{data.customer?.name || "N/A"}</span>
            </p>
          </div>

          <div className="space-y-3 flex-1 min-w-[280px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Status Transitions</span>
            <div className="flex items-center gap-2 flex-wrap bg-[var(--surface-2)] border border-[var(--border)] p-3 rounded-xl">
              {config.statusOrder.map((status, idx) => {
                const currentIdx = config.statusOrder.indexOf(currentStatus);
                const isCompleted = idx < currentIdx;
                const isActive = idx === currentIdx;
                const isClickable = transitions.includes(status);
 
                const getActionForStatus = (statusName: string) => {
                  if (config.id === "requests") {
                    if (statusName === "Assigned") return "assign";
                    if (statusName === "Closed") return "close";
                  }
                  if (config.id === "complaints") {
                    if (statusName === "Investigating") return "investigate";
                    if (statusName === "Resolved") return "resolve";
                    if (statusName === "Closed") return "close";
                  }
                  if (config.id === "defects") {
                    if (statusName === "Under Investigation") return "investigate";
                    if (statusName === "Corrective Action") return "corrective";
                    if (statusName === "Closed") return "close";
                  }
                  if (config.id === "installations") {
                    if (statusName === "In Progress") return "start";
                    if (statusName === "Completed") return "complete";
                  }
                  return null;
                };
 
                return (
                  <React.Fragment key={status}>
                    {idx > 0 && (
                      <ArrowRight size={12} className={cn(
                        "text-[var(--text-muted)] shrink-0",
                        idx <= currentIdx && "text-blue-500"
                      )} />
                    )}
                    <button
                      disabled={!isClickable}
                      onClick={() => {
                        const actId = getActionForStatus(status);
                        if (actId) {
                          onTriggerAction(actId);
                        } else {
                          onStatusTransition(status);
                        }
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all duration-200 shrink-0",
                        isActive ? (
                          status === "New" || status === "Open" || status === "Scheduled" ? "bg-blue-600 text-white border-transparent" :
                          status === "In Progress" || status === "Investigating" || status === "Under Investigation" || status === "Pending Customer" ? "bg-amber-600 text-white border-transparent" :
                          status === "Resolved" || status === "Completed" || status === "Corrective Action" ? "bg-green-600 text-white border-transparent" :
                          status === "Closed" ? "bg-gray-600 text-white border-transparent" :
                          "bg-brand text-white border-transparent"
                        ) + " ring-2 ring-blue-500/20 scale-105 shadow-md font-extrabold" :
                        isCompleted ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                        isClickable ? "bg-[var(--surface)] text-[var(--text-primary)] border-blue-500/40 hover:bg-blue-500/10 hover:border-blue-500 cursor-pointer" :
                        "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] opacity-40 cursor-not-allowed"
                      )}
                      title={isClickable ? `Transition to ${status}` : status}
                    >
                      {isCompleted && <span className="mr-1">✓</span>}
                      {status}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {data.escalationLevel > 0 && (
        <EscalationBanner level={data.escalationLevel} reason={data.escalationReason || "SLA Breached"} />
      )}

      {/* Main Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Field Sections */}
        <div className="lg:col-span-2 space-y-6">
          {config.detailSections.map(sec => (
            <div key={sec.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 backdrop-blur-md">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
                {sec.title}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {sec.fields.map(fid => {
                  const fieldDef = config.formFields.find(f => f.id === fid);
                  const label = fieldDef?.label || fid.replace(/([A-Z])/g, " $1");
                  let displayVal = data[fid];

                  // Resolve relations
                  if (fieldDef?.type === "relation") {
                    if (fid === "customerId") displayVal = data.customer?.name;
                    else if (fid === "assetId") displayVal = data.asset?.productName;
                    else if (fid === "teamId") displayVal = data.team?.name;
                    else if (fid === "engineerId") displayVal = data.engineer?.user?.name;
                    else if (fid === "categoryId") displayVal = data.category?.name;
                    else if (fid === "priorityId") displayVal = data.priority?.name;
                  }

                  if (fid === "createdAt" || fid === "updatedAt") {
                    displayVal = data[fid] ? new Date(data[fid]).toLocaleString() : null;
                  }

                  if (fieldDef?.type === "boolean") {
                    displayVal = data[fid] ? "Yes" : "No";
                  }

                  let fallback = "–";
                  if (fid === "engineerId" || fid === "teamId") {
                    fallback = "Unassigned";
                  }

                  return (
                    <div key={fid} className="space-y-1">
                      <span className="text-[var(--text-secondary)] block font-semibold">{label}</span>
                      <span className="text-[var(--text-primary)] block font-medium">{displayVal?.toString() || fallback}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Side: Widgets & Actions */}
        <div className="space-y-6">
          {/* Asset & AMC Context Card */}
          {data.asset && (
            <WarrantyAMCContextCard 
              purchaseDate={data.asset.purchaseDate}
              warrantyExpiry={data.asset.warrantyExpiryDate}
              amcExpiry={data.asset.amcExpiryDate}
            />
          )}

          {/* Custom widgets panel */}
          {customWidgets}
        </div>
      </div>
    </div>
  );
}
