"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import {
  KPICard, AnalyticsPageHeader, FilterSelect,
  EmptyState, LoadingState, UserAvatar,
} from "@/components/shared/AnalyticsComponents";
import { ArrowLeft, Building2, Users, DollarSign, MapPin } from "lucide-react";

export default function TerritoryAccountsPage() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const toast = useToast();
  const [territories, setTerritories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTerritory, setFilterTerritory] = useState("");

  const loadTerritories = async () => {
    try {
      const res = await fetch("/api/territories?isActive=true");
      const data = await res.json();
      if (data.success) setTerritories(data.data);
    } catch { /* ignore */ }
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const promises = territories.map(t => fetch(`/api/territories/${t.id}/accounts`).then(r => r.json()));
      const results = await Promise.all(promises);
      const all: any[] = [];
      results.forEach((res, i) => {
        if (res.success) {
          res.data.forEach((a: any) => {
            const revenue = a.customer.deals?.reduce((s: number, d: any) => s + d.dealValue, 0) ?? 0;
            all.push({
              id: a.id,
              customerName: a.customer.name,
              customerCode: a.customer.customerCode,
              city: a.customer.city,
              assignedExec: a.customer.assignedUser?.name,
              assignedExecRole: a.customer.assignedUser?.role,
              revenue,
              territoryId: territories[i].id,
              territoryName: territories[i].name,
            });
          });
        }
      });
      setAccounts(all);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTerritories(); }, []);
  useEffect(() => { if (territories.length) loadAccounts(); }, [territories]);

  const filtered = filterTerritory ? accounts.filter(a => a.territoryId === filterTerritory) : accounts;

  // Summary metrics
  const summary = useMemo(() => {
    const totalRevenue = filtered.reduce((s, a) => s + a.revenue, 0);
    const uniqueCustomers = new Set(filtered.map(a => a.customerName)).size;
    const uniqueExecs = new Set(filtered.map(a => a.assignedExec).filter(Boolean)).size;
    return { totalAccounts: filtered.length, totalRevenue, uniqueCustomers, uniqueExecs };
  }, [filtered]);

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Territory Accounts" subtitle="All customer accounts assigned to territories">
        <Link href="/territories" className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to territories
        </Link>
      </AnalyticsPageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          value={filterTerritory}
          onChange={setFilterTerritory}
          options={territories.map(t => ({ value: t.id, label: t.name }))}
          placeholder="All Territories"
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState message="No territory accounts found." />
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Accounts" value={summary.totalAccounts} icon={<Building2 size={20} />} />
            <KPICard label="Total Revenue" value={formatCurrency(summary.totalRevenue)} icon={<DollarSign size={20} />} />
            <KPICard label="Unique Customers" value={summary.uniqueCustomers} icon={<Users size={20} />} />
            <KPICard label="Active Execs" value={summary.uniqueExecs} icon={<MapPin size={20} />} />
          </div>

          {/* Table */}
          <div className="analytics-chart-card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="crm-th">Customer</th>
                    <th className="crm-th">Territory</th>
                    <th className="crm-th">Assigned Sales Exec</th>
                    <th className="crm-th">City</th>
                    <th className="crm-th text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="crm-tr">
                      <td className="crm-td">
                        <span className="font-medium text-[var(--text-primary)]">{a.customerName}</span>{" "}
                        <span className="text-[11px] text-[var(--text-muted)]">({a.customerCode})</span>
                      </td>
                      <td className="crm-td">
                        <Link href={`/territories/${a.territoryId}`} className="text-[var(--accent)] hover:underline">{a.territoryName}</Link>
                      </td>
                      <td className="crm-td">
                        <UserAvatar name={a.assignedExec} role={a.assignedExecRole} size="sm" />
                      </td>
                      <td className="crm-td text-[var(--text-secondary)]">{a.city || "—"}</td>
                      <td className="crm-td text-right text-[var(--text-secondary)]">{formatCurrency(a.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
