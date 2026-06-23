"use client";



import React, { useState, useEffect, useMemo } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { getDealsAction } from "@/app/actions/deals";

import { getFollowUpsDueThisWeekAction } from "@/app/actions/activities";

import { useToast } from "@/components/ToastProvider";

import { useCurrency } from "@/components/CurrencyProvider";

import { PageShell } from "@/components/ui/PageShell";

import { SummaryCard } from "@/components/ui/SummaryCard";

import { StatusBadge } from "@/components/ui/StatusBadge";

import { formatDate } from "@/lib/ui-utils";

import { Search, Filter, Briefcase, TrendingUp, AlertTriangle, CheckCircle, Clock, CalendarClock } from "lucide-react";



const STAGES = {

  SalesOpportunity: "Qualified",

  RequirementGathering: "Requirement Gathering",

  MeetingScheduled: "Meeting Scheduled",

  SolutionReview: "Solution Review",

  ProposalSent: "Proposal Sent",

  Negotiation: "Negotiation",

};



export default function SalesOpportunitiesPage() {

  const router = useRouter();

  const searchParams = useSearchParams();

  const toast = useToast();

  const { formatCurrency } = useCurrency();

  

  const initialStage = searchParams.get("stage") || "";

  

  const [deals, setDeals] = useState<any[]>([]);

  const [followUps, setFollowUps] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");

  const [stageFilter, setStageFilter] = useState(initialStage);



  const fetchDeals = async () => {

    setLoading(true);

    const [res, fuRes] = await Promise.all([

      getDealsAction(),

      getFollowUpsDueThisWeekAction(),

    ]);

    if (res.success && res.data) {

      // Keep Lost deals so the Rejected filter can show them; Won stays excluded

      setDeals(res.data.filter((d: any) => d.status !== "Won"));

    } else {

      toast.error(res.message || "Failed to load opportunities.");

    }

    if (fuRes.success && fuRes.data) {

      setFollowUps(fuRes.data);

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

          // Overdue: expected close date has passed OR stuck in early stages > 15 days

          const now = new Date().getTime();

          const closeDatePassed = deal.expectedCloseDate && new Date(deal.expectedCloseDate).getTime() < now;

          const daysOld = (now - new Date(deal.createdAt).getTime()) / (1000 * 3600 * 24);

          const stuckInEarlyStage = ["SalesOpportunity", "RequirementGathering"].includes(deal.status) && daysOld > 15;

          matchStage = (closeDatePassed || stuckInEarlyStage) && deal.status !== "Lost";

        } else if (stageFilter === "Rejected") {

          // Rejected = Lost deals

          matchStage = deal.status === "Lost";

        } else if (stageFilter === "RequirementGathering") {

          matchStage = deal.status === "RequirementGathering";

        } else {

          matchStage = deal.status === stageFilter;

        }

      } else {

        // Default view: exclude Lost deals from active pipeline

        matchStage = deal.status !== "Lost";

      }



      return matchSearch && matchStage;

    });

  }, [deals, searchQuery, stageFilter]);



  const kpiTotal = deals.length;

  const kpiValue = deals.reduce((sum, d) => sum + d.dealValue, 0);

  const kpiHighPriority = deals.filter(d => d.dealValue > 50000).length; // Example threshold

  

  // Overdue: expected close date passed OR stuck in early stages > 15 days

  const kpiOverdue = deals.filter(d => {

    const now = new Date().getTime();

    const closeDatePassed = d.expectedCloseDate && new Date(d.expectedCloseDate).getTime() < now;

    const daysOld = (now - new Date(d.createdAt).getTime()) / (1000 * 3600 * 24);

    const stuckInEarlyStage = ["SalesOpportunity", "RequirementGathering"].includes(d.status) && daysOld > 15;

    return closeDatePassed || stuckInEarlyStage;

  }).length;



  // Build a lookup of deals by id so we can enrich follow-up rows with deal info

  const dealMap = useMemo(() => {

    const m = new Map<string, any>();

    deals.forEach(d => m.set(d.id, d));

    return m;

  }, [deals]);



  // Follow-ups due this week, enriched with deal data

  const followUpsThisWeek = useMemo(() => {

    return followUps.map(fu => ({

      ...fu,

      deal: dealMap.get(fu.dealId) || null,

    }));

  }, [followUps, dealMap]);



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

              <option value="SalesOpportunity">Qualified</option>

              <option value="RequirementGathering">Requirement Gathering</option>

              <option value="MeetingScheduled">Meeting Scheduled</option>

              <option value="SolutionReview">Solution Review</option>

              <option value="ProposalSent">Proposal Sent</option>

              <option value="Negotiation">Negotiation</option>

              <option value="Overdue">Overdue</option>

              <option value="Rejected">Rejected</option>

            </select>

          </div>

        </div>

      }

    >

      <div className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

          <SummaryCard label="Active Opportunities" value={kpiTotal.toString()} icon={<Briefcase size={20} />} variant="indigo" />

          <SummaryCard label="Pipeline Value" value={formatCurrency(kpiValue)} icon={<TrendingUp size={20} />} variant="light" />

          <SummaryCard label="High Priority" value={kpiHighPriority.toString()} icon={<CheckCircle size={20} />} variant="dark" />

          <SummaryCard label="Overdue" value={kpiOverdue.toString()} icon={<AlertTriangle size={20} />} variant="orange" />

          <SummaryCard label="Follow-ups This Week" value={followUpsThisWeek.length.toString()} icon={<CalendarClock size={20} />} variant="indigo" />

        </div>



        {/* Follow-ups Due This Week */}

        {followUpsThisWeek.length > 0 && (

          <div className="crm-card overflow-hidden border-amber-200">

            <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">

              <CalendarClock size={18} className="text-amber-600" />

              <h3 className="font-bold text-amber-800 text-sm">Follow-ups Due This Week</h3>

              <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">

                {followUpsThisWeek.length} upcoming

              </span>

            </div>

            <div className="overflow-x-auto">

              <table className="crm-table">

                <thead>

                  <tr className="crm-tr border-b border-slate-200/60">

                    <th className="crm-th">Deal</th>

                    <th className="crm-th">Customer</th>

                    <th className="crm-th">Agenda</th>

                    <th className="crm-th">Follow-up Date</th>

                    <th className="crm-th text-right">Action</th>

                  </tr>

                </thead>

                <tbody>

                  {followUpsThisWeek.map(fu => (

                    <tr key={fu.id} className="crm-tr hover:bg-amber-50/40 transition-colors">

                      <td className="crm-td">

                        <p className="font-bold text-slate-800">{fu.deal?.dealName || "—"}</p>

                        {fu.deal && (

                          <p className="text-[11px] text-slate-500 mt-0.5">

                            {(STAGES as any)[fu.deal.status] || fu.deal.status}

                          </p>

                        )}

                      </td>

                      <td className="crm-td">

                        <p className="font-semibold text-slate-700">{fu.customer?.name || fu.deal?.customer?.name || "—"}</p>

                      </td>

                      <td className="crm-td text-slate-600 text-sm">

                        {fu.agenda || "Follow-up meeting"}

                      </td>

                      <td className="crm-td">

                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-sm">

                          <Clock size={13} /> {formatDate(fu.meetingDate)}

                        </span>

                      </td>

                      <td className="crm-td text-right">

                        {fu.dealId && (

                          <button

                            onClick={() => router.push(`/sales-pipeline/${fu.dealId}`)}

                            className="px-3 py-1.5 bg-amber-600 text-white font-bold text-xs rounded-lg hover:bg-amber-700 transition-colors shadow-sm"

                          >

                            Open Deal →

                          </button>

                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}



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

                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">

                            Qualified

                          </span>

                        ) : deal.status === "RequirementGathering" ? (

                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">

                            Draft (Req Gathering)

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

                            className="px-4 py-1.5 bg-[var(--primary)] text-white font-bold text-xs rounded-lg hover:bg-[var(--primary-hover)] transition-colors shadow-sm"

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

