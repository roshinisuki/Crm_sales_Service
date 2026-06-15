"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getForecastDataAction } from "@/app/actions/forecast";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/ui-utils";
import {
  TrendingUp,
  Calendar,
  IndianRupee,
  Layers,
  BarChart3,
  Briefcase,
  AlertCircle,
} from "lucide-react";

export default function ForecastPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  
  const currentView = searchParams.get("view") || "revenue";
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await getForecastDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.message || "Failed to load forecast metrics.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while loading forecast data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  const setView = (view: string) => {
    router.push(`/forecast?view=${view}`);
  };

  return (
    <PageShell
      title="Sales & Revenue Forecast"
      subtitle="Track pipeline distribution, expected closure timelines, and weighted revenue predictions."
    >
      <div className="space-y-6">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="crm-card bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-5 rounded-2xl shadow-md border-0 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">Weighted Revenue Projection</p>
                <h3 className="text-3xl font-black mt-2">
                  {loading ? "..." : formatCurrency(data?.totalWeightedValue || 0)}
                </h3>
              </div>
              <span className="p-2 bg-white/10 rounded-xl">
                <TrendingUp size={20} className="text-white" />
              </span>
            </div>
            <p className="text-[10px] text-indigo-100/80 mt-4 font-medium">
              Calculated based on standard stage-weighted win probability percentages.
            </p>
          </div>

          <div className="crm-card bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pipeline Value</p>
                <h3 className="text-3xl font-black text-slate-800 mt-2">
                  {loading ? "..." : formatCurrency(data?.totalPipelineValue || 0)}
                </h3>
              </div>
              <span className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <IndianRupee size={20} className="text-slate-500" />
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 font-medium">
              Gross sum of all active opportunities in the pipeline.
            </p>
          </div>

          <div className="crm-card bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Opportunities</p>
                <h3 className="text-3xl font-black text-slate-800 mt-2">
                  {loading ? "..." : data?.deals?.length || 0}
                </h3>
              </div>
              <span className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <Briefcase size={20} className="text-slate-500" />
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 font-medium">
              Total number of active, non-terminal sales deals.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          {[
            { id: "revenue", label: "Weighted Revenue", icon: <TrendingUp size={14} /> },
            { id: "closures", label: "Expected Closures", icon: <Calendar size={14} /> },
            { id: "value", label: "Pipeline Value Stage Breakdown", icon: <Layers size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 -mb-px outline-none ${
                currentView === tab.id
                  ? "border-[var(--primary)] text-[var(--primary)] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Content */}
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">
            <div className="spinner-brand mx-auto mb-2" />
            Loading forecasting dashboard...
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {currentView === "revenue" && (
              <div className="crm-card bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Stage-Weighted Opportunities</h3>
                  <p className="text-xs text-slate-450 mt-0.5">Weighted projections are calculated using standard win probabilities per stage.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="px-6 py-4">Opportunity (Deal)</th>
                        <th className="px-6 py-4">Account / Client</th>
                        <th className="px-6 py-4">Current Stage</th>
                        <th className="px-6 py-4">Expected Close</th>
                        <th className="px-6 py-4 text-right">Probability</th>
                        <th className="px-6 py-4 text-right">Deal Value</th>
                        <th className="px-6 py-4 text-right">Weighted Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.deals?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                            No active deals found to project forecast.
                          </td>
                        </tr>
                      ) : (
                        data?.deals?.map((deal: any) => (
                          <tr key={deal.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-slate-650 text-xs font-medium">
                            <td className="px-6 py-4 font-bold text-slate-800">{deal.dealName}</td>
                            <td className="px-6 py-4 text-slate-500">{deal.customerName}</td>
                            <td className="px-6 py-4">
                              <StatusBadge status={deal.status} />
                            </td>
                            <td className="px-6 py-4">{deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "---"}</td>
                            <td className="px-6 py-4 text-right font-semibold text-slate-500">{Math.round(deal.probability * 100)}%</td>
                            <td className="px-6 py-4 text-right font-semibold text-slate-800">{formatCurrency(deal.dealValue)}</td>
                            <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(deal.weightedValue)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentView === "closures" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Closure List by Month */}
                <div className="crm-card bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Closure Timelines</h3>
                  <div className="space-y-4">
                    {data?.closures?.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No expected closure timelines found.</p>
                    ) : (
                      data?.closures?.map((item: any) => (
                        <div key={item.month} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                              <Calendar size={16} />
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-700">{item.month}</p>
                              <p className="text-[10px] text-slate-400">{item.count} deals expected to close</p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-slate-800">{formatCurrency(item.value)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Info and Best Practices */}
                <div className="crm-card bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <AlertCircle size={16} className="text-indigo-600" />
                      Forecast Projection Accuracy
                    </h3>
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      Maintaining correct <strong>Expected Close Dates</strong> on active deals is critical to accuracy.
                    </p>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Sales executives should review deal close dates weekly. If a client extends negotiations, shift the closure target to reflect realistic billing.
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-100 mt-6 text-xs text-slate-600">
                    <p className="font-bold text-slate-700">Did you know?</p>
                    <p className="mt-1">Weighted forecasting helps determine cash flow requirements and set marketing acquisition budgets accurately.</p>
                  </div>
                </div>
              </div>
            )}

            {currentView === "value" && (
              <div className="crm-card bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5">Stage Breakdown Distribution</h3>
                <div className="space-y-6 max-w-xl">
                  {Object.keys(data?.valueByStage || {}).length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No active pipeline distributions recorded.</p>
                  ) : (
                    Object.entries(data?.valueByStage || {}).map(([stage, details]: any) => {
                      const percentage = Math.min(
                        100,
                        Math.max(5, (details.raw / (data.totalPipelineValue || 1)) * 100)
                      );
                      return (
                        <div key={stage} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-700">
                              {stage.replace(/([A-Z])/g, " $1").trim()} ({details.count} deals)
                            </span>
                            <span className="font-semibold text-slate-800">
                              {formatCurrency(details.raw)}
                              <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                                (Weighted: {formatCurrency(details.weighted)})
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${percentage}%` }}
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
