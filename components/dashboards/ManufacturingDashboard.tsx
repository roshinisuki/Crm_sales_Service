"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { FlaskConical, MessageSquare, FileText, ShieldCheck, Clock, CheckCircle, TrendingUp, Package } from "lucide-react";
import Link from "next/link";

export default function ManufacturingDashboard() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    samples: { total: 0, new: 0, approved: 0, rejected: 0 },
    negotiations: { total: 0, active: 0, won: 0, pendingApproval: 0 },
    purchaseOrders: { total: 0, new: 0, approved: 0, closed: 0 },
    approvals: { pending: 0, approved: 0, rejected: 0 },
    pendingApprovals: [] as any[],
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [samplesRes, negRes, poRes, approvalsRes] = await Promise.all([
          fetch("/api/samples?page=1"),
          fetch("/api/negotiations?page=1"),
          fetch("/api/purchase-orders?page=1"),
          fetch("/api/approvals?status=Pending&page=1"),
        ]);

        const [samplesData, negData, poData, approvalsData] = await Promise.all([
          samplesRes.json(),
          negRes.json(),
          poRes.json(),
          approvalsRes.json(),
        ]);

        const samples = samplesData.success ? samplesData.data : [];
        const negotiations = negData.success ? negData.data : [];
        const purchaseOrders = poData.success ? poData.data : [];
        const pendingApprovals = approvalsData.success ? approvalsData.data : [];

        setStats({
          samples: {
            total: samples.length,
            new: samples.filter((s: any) => s.status === "New").length,
            approved: samples.filter((s: any) => s.status === "Approved").length,
            rejected: samples.filter((s: any) => s.status === "Rejected").length,
          },
          negotiations: {
            total: negotiations.length,
            active: negotiations.filter((n: any) => ["Active", "PriceRevision", "CommercialDiscussion"].includes(n.status)).length,
            won: negotiations.filter((n: any) => n.status === "Won").length,
            pendingApproval: negotiations.filter((n: any) => n.status === "PendingApproval").length,
          },
          purchaseOrders: {
            total: purchaseOrders.length,
            new: purchaseOrders.filter((p: any) => p.status === "New").length,
            approved: purchaseOrders.filter((p: any) => p.status === "Approved").length,
            closed: purchaseOrders.filter((p: any) => p.status === "Closed").length,
          },
          approvals: {
            pending: pendingApprovals.length,
            approved: 0,
            rejected: 0,
          },
          pendingApprovals: pendingApprovals.slice(0, 5),
        });
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Manufacturing Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview of samples, negotiations, purchase orders, and approvals</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Samples"
          value={stats.samples.total}
          icon={<FlaskConical size={20} />}
          variant="orange"
          subtitle={`${stats.samples.new} new, ${stats.samples.approved} approved`}
        />
        <SummaryCard
          label="Active Negotiations"
          value={stats.negotiations.active}
          icon={<MessageSquare size={20} />}
          variant="blue"
          subtitle={`${stats.negotiations.won} won, ${stats.negotiations.pendingApproval} pending approval`}
        />
        <SummaryCard
          label="Purchase Orders"
          value={stats.purchaseOrders.total}
          icon={<FileText size={20} />}
          variant="green"
          subtitle={`${stats.purchaseOrders.new} new, ${stats.purchaseOrders.approved} approved`}
        />
        <SummaryCard
          label="Pending Approvals"
          value={stats.approvals.pending}
          icon={<ShieldCheck size={20} />}
          variant="red"
          subtitle="Awaiting action"
        />
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Samples breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Sample Status</h2>
            <Link href="/samples" className="text-xs text-[var(--primary)] hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            <StatusRow label="New" count={stats.samples.new} color="bg-blue-50 text-blue-600" total={stats.samples.total} />
            <StatusRow label="Approved" count={stats.samples.approved} color="bg-green-50 text-green-600" total={stats.samples.total} />
            <StatusRow label="Rejected" count={stats.samples.rejected} color="bg-red-50 text-red-600" total={stats.samples.total} />
          </div>
        </div>

        {/* Negotiations breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Negotiation Status</h2>
            <Link href="/negotiations" className="text-xs text-[var(--primary)] hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            <StatusRow label="Active" count={stats.negotiations.active} color="bg-blue-50 text-blue-600" total={stats.negotiations.total} />
            <StatusRow label="Won" count={stats.negotiations.won} color="bg-green-50 text-green-600" total={stats.negotiations.total} />
            <StatusRow label="Pending Approval" count={stats.negotiations.pendingApproval} color="bg-orange-50 text-orange-600" total={stats.negotiations.total} />
          </div>
        </div>

        {/* PO breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">PO Status</h2>
            <Link href="/purchase-orders" className="text-xs text-[var(--primary)] hover:underline">View all →</Link>
          </div>
          <div className="space-y-3">
            <StatusRow label="New" count={stats.purchaseOrders.new} color="bg-slate-50 text-slate-600" total={stats.purchaseOrders.total} />
            <StatusRow label="Approved" count={stats.purchaseOrders.approved} color="bg-blue-50 text-blue-600" total={stats.purchaseOrders.total} />
            <StatusRow label="Closed" count={stats.purchaseOrders.closed} color="bg-green-50 text-green-600" total={stats.purchaseOrders.total} />
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pending Approvals</h2>
          <Link href="/approvals" className="text-xs text-[var(--primary)] hover:underline">View all →</Link>
        </div>
        {stats.pendingApprovals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No pending approvals</p>
        ) : (
          <div className="space-y-2">
            {stats.pendingApprovals.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.approvalType} — {a.entityType}</p>
                    <p className="text-xs text-slate-500">Requested by {a.requestedBy?.name || "—"}</p>
                  </div>
                </div>
                <Link href="/approvals" className="text-xs text-[var(--primary)] hover:underline font-medium">Review →</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction href="/samples/new" icon={<FlaskConical size={18} />} label="New Sample" />
        <QuickAction href="/negotiations/new" icon={<MessageSquare size={18} />} label="New Negotiation" />
        <QuickAction href="/purchase-orders/new" icon={<FileText size={18} />} label="New Purchase Order" />
        <QuickAction href="/approvals" icon={<ShieldCheck size={18} />} label="Approval Center" />
      </div>
    </PageContainer>
  );
}

function StatusRow({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{count}</span>
        <span className="text-xs text-slate-400">({pct}%)</span>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:border-[var(--primary)]/30 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
        {icon}
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </Link>
  );
}
