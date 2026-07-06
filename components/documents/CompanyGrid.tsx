"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";

const STAGE_COLORS: Record<string, string> = {
  Qualified: "bg-blue-50 text-blue-700",
  SalesOpportunity: "bg-blue-50 text-blue-700",
  RequirementGathering: "bg-purple-50 text-purple-700",
  MeetingScheduled: "bg-amber-50 text-amber-700",
  ProposalSent: "bg-emerald-50 text-emerald-700",
  Negotiation: "bg-orange-50 text-orange-700",
  Active: "bg-teal-50 text-teal-700",
  Won: "bg-green-50 text-green-700",
  Lost: "bg-red-50 text-red-700",
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface CompanyGridProps {
  documentType: string;
}

export default function CompanyGrid({ documentType }: CompanyGridProps) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (documentType) params.set("documentType", documentType);
      const res = await fetch(`/api/documents/companies?${params}`);
      const data = await res.json();
      if (data.success) setCompanies(data.data || []);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [documentType, toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  if (loading) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        <div className="inline-block w-8 h-8 border-2 border-slate-200 border-t-[var(--primary)] rounded-full animate-spin mb-3" />
        <div>Loading companies…</div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mx-auto mb-4">🏢</div>
        <div className="font-medium text-sm text-slate-700 mb-1">No companies with documents</div>
        <div className="text-xs text-slate-400">
          {documentType ? `No companies have ${documentType} documents yet` : "Upload documents linked to accounts to see them grouped here"}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {companies.map((c) => (
        <Link
          key={c.id}
          href={`/documents/company/${c.id}${documentType ? `?type=${documentType}` : ""}`}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-[var(--primary)]/30 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--primary)]/15 to-[var(--primary)]/5 flex items-center justify-center font-medium text-sm text-[var(--primary)] flex-shrink-0 ring-1 ring-[var(--primary)]/10">
              {getInitials(c.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-800 truncate group-hover:text-[var(--primary)] transition-colors">{c.name}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {c.industryType || "—"} · {c.assignedUserName || "Unassigned"}
              </p>
            </div>
          </div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-3xl font-bold text-slate-800 tracking-tight">{c.documentCount}</span>
              <span className="text-xs text-slate-400 ml-1.5">doc{c.documentCount !== 1 ? "s" : ""}</span>
            </div>
            {c.dealStage && (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[c.dealStage] ?? "bg-slate-100 text-slate-600"}`}>
                {c.dealStage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-[var(--primary)] transition-colors">
            <span>View documents</span>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
