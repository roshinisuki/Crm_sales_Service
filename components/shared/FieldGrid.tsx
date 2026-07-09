import React from "react";
import { cn } from "@/lib/ui-utils";
import { StatusPill } from "@/components/shared/StatusPill";
import { Mail, Phone, MapPin, Building2, Calendar, User, Briefcase, FileText, DollarSign, Clock, ShieldCheck, Star, Compass } from "lucide-react";

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

const getFieldIcon = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes("name")) return <User size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("code")) return <FileText size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("company")) return <Building2 size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("designation")) return <Briefcase size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("email")) return <Mail size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("industry")) return <Building2 size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("source")) return <Compass size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("value")) return <DollarSign size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("score")) return <Star size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("location") || lower.includes("city")) return <MapPin size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("assigned")) return <User size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("created")) return <Calendar size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("sla")) return <Clock size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("phone")) return <Phone size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  if (lower.includes("status")) return <ShieldCheck size={16} className="text-[#6B7280] shrink-0" strokeWidth={2} />;
  return null;
};

export function FieldGrid({ fields, className }: FieldGridProps) {
  return (
    <dl className={cn(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8",
      className
    )}>
      {fields.map((field) => {
        const icon = field.icon || getFieldIcon(field.label);
        return (
          <div key={field.label} className="flex flex-col min-w-0">
            <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7280] mb-1 select-none leading-none h-5">
              {icon}
              <span className="truncate">{field.label}</span>
            </dt>
            <dd className={cn(
              "text-[14px] font-semibold text-[#111827] dark:text-slate-200 min-h-[20px] flex items-center",
              field.truncate && "truncate",
              field.maxLines ? `line-clamp-${field.maxLines}` : ""
            )} title={typeof field.value === "string" ? field.value : undefined}>
              {field.value}
            </dd>
          </div>
        );
      })}
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
