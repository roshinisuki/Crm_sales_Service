"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { getDashboardDataAction } from "@/app/actions/visits";
import { getSalesAnalyticsAction } from "@/app/actions/analytics";

import AdminDashboard from "@/components/dashboards/AdminDashboard";
import ExecutiveDashboard from "@/components/dashboards/ExecutiveDashboard";
import SalesManagerDashboard from "@/components/dashboards/SalesManagerDashboard";
import ManufacturingDashboard from "@/components/dashboards/ManufacturingDashboard";

export default function DashboardRouter() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [dateRange, setDateRange] = useState("alltime");
  const { startLoading, stopLoading } = useGlobalLoading();

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    startLoading("Loading your workspace...");
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
      stopLoading();
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
  }, [authLoading, user, dateRange]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <CRMSpinner size={48} label="Loading your workspace..." />
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

  // B18: V3 Manufacturing users get the Manufacturing dashboard
  const variant = (user as any)?.variant || (user as any)?.company?.variant || 1;
  if (variant >= 3) {
    return <ManufacturingDashboard />;
  }

  if (user?.role === "SalesExecutive") {
    return <ExecutiveDashboard {...commonProps} />;
  }

  if (user?.role === "SalesManager") {
    return <SalesManagerDashboard {...commonProps} />;
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
