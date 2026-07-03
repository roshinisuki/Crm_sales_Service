"use client";

import React from "react";
import { cn } from "@/lib/ui-utils";
import { StatusPill } from "@/components/shared/StatusPill";
import { Mail, Phone, MapPin, Building2, Calendar, User, Briefcase, FileText, DollarSign, Clock, ShieldCheck } from "lucide-react";

export interface Field {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  truncate?: boolean;
  maxLines?: number;
}

interface FieldGridProps {
  fields: Field[];
  className?: string;
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  email: <Mail size={16} />,
  phone: <Phone size={16} />,
  location: <MapPin size={16} />,
  company: <Building2 size={16} />,
  created: <Calendar size={16} />,
  assigned: <User size={16} />,
  designation: <Briefcase size={16} />,
  code: <FileText size={16} />,
  value: <DollarSign size={16} />,
  sla: <Clock size={16} />,
  status: <ShieldCheck size={16} />,
};

export function FieldGrid({ fields, className }: FieldGridProps) {
  return (
    <dl className={cn(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
      className
    )}>
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col">
          <dt className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            {field.icon || FIELD_ICONS[field.label.toLowerCase()] || null}
            {field.label}
          </dt>
          <dd className={cn(
            "text-sm font-semibold text-slate-700",
            field.truncate && "truncate",
            field.maxLines ? `line-clamp-${field.maxLines}` : ""
          )} title={typeof field.value === "string" ? field.value : undefined}>
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Helper to create a progress indicator for scores
export function ScoreIndicator({ score, max = 100 }: { score: number; max?: number }) {
  const percentage = Math.min((score / max) * 100, 100);
  const color = score <= 40 ? "text-rose-600" : score <= 70 ? "text-amber-600" : "text-emerald-600";
  const bgColor = score <= 40 ? "bg-rose-100" : score <= 70 ? "bg-amber-100" : "bg-emerald-100";
  
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-12 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div 
          className={cn("absolute top-0 left-0 h-full rounded-full transition-all", bgColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn("font-bold text-sm", color)}>{score}/{max}</span>
    </div>
  );
}
