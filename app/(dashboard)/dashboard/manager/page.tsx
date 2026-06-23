"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { getDashboardDataAction } from "@/app/actions/visits";
import { getSalesAnalyticsAction } from "@/app/actions/analytics";
import SalesManagerDashboard from "@/components/dashboards/SalesManagerDashboard";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { startLoading, stopLoading } = useGlobalLoading();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [dateRange, setDateRange] = useState("alltime");

  const loadData = async () => {
    setLoading(true);
    startLoading("Loading sales dashboard...");
    try {
      const [dashRes, salesRes] = await Promise.all([
        getDashboardDataAction(),
        getSalesAnalyticsAction(dateRange === "alltime" ? undefined : dateRange),
      ]);
      if (dashRes.success && dashRes.data) setDashboardData(dashRes.data);
      if (salesRes.success && salesRes.data) setSalesData(salesRes.data);
    } catch (err) {
      console.error("Failed to load sales manager dashboard data", err);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  useEffect(() => {
    if (user && user.role === "SalesExecutive") {
      router.push("/dashboard");
      return;
    }
    if (!authLoading && user) {
      loadData();
    }
  }, [authLoading, user, dateRange]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <CRMSpinner size={48} label="Loading sales dashboard..." />
      </div>
    );
  }

  return (
    <SalesManagerDashboard
      dashboardData={dashboardData}
      salesData={salesData}
      user={user}
      loadData={loadData}
      dateRange={dateRange}
      setDateRange={setDateRange}
    />
  );
}
