"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { getDashboardDataAction } from "@/app/actions/visits";
import { getSalesAnalyticsAction } from "@/app/actions/analytics";

import AdminDashboard from "@/components/dashboards/AdminDashboard";

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

  return <AdminDashboard {...commonProps} />;
}
