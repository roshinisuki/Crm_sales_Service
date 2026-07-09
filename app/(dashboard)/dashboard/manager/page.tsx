"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PageLoader } from "@/components/PageLoader";
import { getDashboardDataAction } from "@/app/actions/visits";
import { getSalesAnalyticsAction } from "@/app/actions/analytics";
import SalesManagerDashboard from "@/components/dashboards/SalesManagerDashboard";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [dateRange, setDateRange] = useState("alltime");

  const loadData = async () => {
    setLoading(true);
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
    return <PageLoader label="Loading sales dashboard..." />;
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
