"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getDashboardDataAction } from "@/app/actions/visits";
import { getSalesAnalyticsAction } from "@/app/actions/analytics";

import AdminDashboard from "@/components/dashboards/AdminDashboard";
import ExecutiveDashboard from "@/components/dashboards/ExecutiveDashboard";
import LeadDashboard from "@/components/dashboards/LeadDashboard";

export default function DashboardRouter() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [dateRange, setDateRange] = useState("alltime");

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [dashRes, salesRes] = await Promise.all([
        getDashboardDataAction(),
        getSalesAnalyticsAction(dateRange === "alltime" ? undefined : dateRange)
      ]);
      
      if (dashRes.success && dashRes.data) {
        setDashboardData(dashRes.data);
      }
      if (salesRes.success && salesRes.data) {
        setSalesData(salesRes.data);
      }
    } catch (err) {
      console.error("Failed to load unified dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
  }, [authLoading, user, dateRange]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 rounded-full border-4 border-[#D44D4D] border-t-transparent animate-spin" />
          <p className="text-sm font-bold text-slate-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const commonProps = {
    dashboardData,
    salesData,
    user,
    loadData,
    dateRange,
    setDateRange,
  };

  if (user?.role === "SalesExecutive") {
    return <ExecutiveDashboard {...commonProps} />;
  }

  if (user?.role === "SalesManager") {
    return <LeadDashboard {...commonProps} />;
  }

  if (user?.role === "Admin") {
    return <AdminDashboard {...commonProps} />;
  }

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="text-center space-y-2">
        <p className="text-xl font-bold text-slate-800">Access Denied</p>
        <p className="text-sm text-slate-500">Unrecognized role or unauthorized access.</p>
      </div>
    </div>
  );
}
