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
          className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} /> Back to List
        </button>

        <div className="flex items-center gap-2">
          {config.allowedActions
            .filter(act => !act.requiredStatus || act.requiredStatus.includes(currentStatus))
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
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-wider text-white/40 block">
                {data.requestCode || data.complaintCode || data.id}
              </span>
              {data.dueDate && (
                <SLACountdownBadge dueDate={data.dueDate} status={currentStatus} />
              )}
            </div>
            <h2 className="text-xl font-black text-white">{data.title || data.details || `${config.entityLabel} Details`}</h2>
            <p className="text-xs text-white/50">
              Customer: <span className="text-white font-semibold">{data.customer?.name || "N/A"}</span>
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Status Transitions</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", config.badgeColorRules[currentStatus])}>
                {currentStatus}
              </span>
              {transitions.length > 0 && <ArrowRight size={14} className="text-white/40" />}
              {transitions.map(status => (
                <button
                  key={status}
                  onClick={() => onStatusTransition(status)}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Field Sections */}
        <div className="lg:col-span-2 space-y-6">
          {config.detailSections.map(sec => (
            <div key={sec.id} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 backdrop-blur-md">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/80 border-b border-white/10 pb-2">
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
                    displayVal = data[fid] ? new Date(data[fid]).toLocaleString() : "-";
                  }

                  return (
                    <div key={fid} className="space-y-1">
                      <span className="text-white/40 block font-semibold">{label}</span>
                      <span className="text-white block font-medium">{displayVal?.toString() || "-"}</span>
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
