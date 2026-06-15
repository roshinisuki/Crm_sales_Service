"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDealsAction } from "@/app/actions/deals";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/ui-utils";
import { Search, Filter, Briefcase, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const STAGES = {
  SalesOpportunity: "New Opportunity",
  RequirementGathering: "Requirement Gathering",
  PreSalesReview: "Pre-Sales Review",
  MeetingScheduled: "Meeting Scheduled",
  DemoConducted: "Demo Conducted",
  RejectedDemo: "Rejected Demo",
  ProposalSent: "Proposal Sent",
  ApprovalQueue: "Approval Queue",
  ActiveNegotiation: "Negotiation",
  Won: "Closed Won",
  Lost: "Closed Lost"
};

export default function SalesOpportunitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  
  const initialStage = searchParams.get("stage") || "";
  
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState(initialStage);

  const fetchDeals = async () => {
    setLoading(true);
    const res = await getDealsAction();
    if (res.success && res.data) {
      setDeals(res.data.filter((d: any) => d.status !== "Won" && d.status !== "Lost")); // Only active pipeline
    } else {
      toast.error(res.message || "Failed to load opportunities.");
    }
    setLoading(false);
  };

  useEffect(() => { fetchDeals(); }, []);

  // Update filter when URL changes via sidebar
  useEffect(() => {
    setStageFilter(searchParams.get("stage") || "");
  }, [searchParams]);

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const q = searchQuery.toLowerCase();
      const matchSearch = deal.dealName.toLowerCase().includes(q) || deal.customer?.name.toLowerCase().includes(q);
      
      let matchStage = true;
      if (stageFilter) {
        if (stageFilter === "Overdue") {
          // Simplistic overdue logic: created more than 15 days ago and still in early stages
          const daysOld = (new Date().getTime() - new Date(deal.createdAt).getTime()) / (1000 * 3600 * 24);
          matchStage = daysOld > 15;
        } else if (stageFilter === "RequirementGathering") {
          matchStage = deal.status === "RequirementGathering";
        } else {
          matchStage = deal.status === stageFilter;
        }
      }

      return matchSearch && matchStage;
    });
  }, [deals, searchQuery, stageFilter]);

  const kpiTotal = deals.length;
  const kpiValue = deals.reduce((sum, d) => sum + d.dealValue, 0);
  const kpiHighPriority = deals.filter(d => d.dealValue > 50000).length; // Example threshold
  
  // Overdue logic: > 15 days in pipeline
  const kpiOverdue = deals.filter(d => {
    const daysOld = (new Date().getTime() - new Date(d.createdAt).getTime()) / (1000 * 3600 * 24);
    return daysOld > 15;
  }).length;

  return (
    <PageShell
      title="Sales Opportunities"
      subtitle="Manage your active pipeline and advance qualified leads through the sales cycle."
      action={
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
            <input 
              type="text" 
              placeholder="Search opportunity..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Filter size={16} /></span>
            <select
              value={stageFilter}
              onChange={e => {
                setStageFilter(e.target.value);
                router.push(`/sales-pipeline${e.target.value ? `?stage=${e.target.value}` : ''}`);
              }}
              className="pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Stages</option>
              <option value="SalesOpportunity">New Opportunity</option>
              <option value="RequirementGathering">Requirement Gathering</option>
              <option value="PreSalesReview">Pre-Sales Review</option>
              <option value="MeetingScheduled">Meeting Scheduled</option>
              <option value="DemoConducted">Demo Conducted</option>
              <option value="RejectedDemo">Rejected Demo</option>
              <option value="ProposalSent">Proposal Sent</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard label="Active Opportunities" value={kpiTotal.toString()} icon={<Briefcase size={20} />} variant="indigo" />
          <SummaryCard label="Pipeline Value" value={formatCurrency(kpiValue)} icon={<TrendingUp size={20} />} variant="light" />
          <SummaryCard label="High Priority" value={kpiHighPriority.toString()} icon={<CheckCircle size={20} />} variant="dark" />
          <SummaryCard label="Overdue" value={kpiOverdue.toString()} icon={<AlertTriangle size={20} />} variant="orange" />
        </div>

        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr className="crm-tr border-b border-slate-200/60">
                  <th className="crm-th">Opportunity</th>
                  <th className="crm-th">Customer</th>
                  <th className="crm-th">Value</th>
                  <th className="crm-th">Current Stage</th>
                  <th className="crm-th">Expected Close</th>
                  <th className="crm-th text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading opportunities...</td>
                  </tr>
                ) : filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">No opportunities found for the selected criteria.</td>
                  </tr>
                ) : (
                  filteredDeals.map(deal => (
                    <tr key={deal.id} className="crm-tr hover:bg-slate-50/80 transition-colors">
                      <td className="crm-td">
                        <p className="font-bold text-slate-800">{deal.dealName}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock size={10} /> Created {formatDate(deal.createdAt)}
                        </p>
                      </td>
                      <td className="crm-td">
                        <p className="font-semibold text-slate-700">{deal.customer?.name}</p>
                        <p className="text-[11px] text-slate-400">{deal.customer?.customerCode}</p>
                      </td>
                      <td className="crm-td font-bold text-[var(--primary)]">
                        {formatCurrency(deal.dealValue)}
                      </td>
                      <td className="crm-td">
                        {deal.status === "SalesOpportunity" ? (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
                            New
                          </span>
                        ) : deal.status === "RequirementGathering" ? (
                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
                            Draft (Req Gathering)
                          </span>
                        ) : deal.status === "PreSalesReview" ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200">
                            Under Review
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
                            {(STAGES as any)[deal.status] || deal.status}
                          </span>
                        )}
                      </td>
                      <td className="crm-td text-slate-600 font-medium">
                        {formatDate(deal.expectedCloseDate)}
                      </td>
                      <td className="crm-td text-right">
                        {deal.status === "SalesOpportunity" ? (
                          <button 
                            onClick={() => router.push(`/sales-pipeline/${deal.id}`)}
                            className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                          >
                            Start Requirement Gathering →
                          </button>
                        ) : deal.status === "RequirementGathering" ? (
                          <button 
                            onClick={() => router.push(`/sales-pipeline/${deal.id}`)}
                            className="px-4 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors"
                          >
                            Continue Requirement Gathering
                          </button>
                        ) : (
                          <button 
                            onClick={() => router.push(`/sales-pipeline/${deal.id}`)}
                            className="px-4 py-1.5 bg-slate-50 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors"
                          >
                            View Workspace
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
