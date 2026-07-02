"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { StatusPill } from "@/components/shared/StatusPill";
import { ArrowLeft, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

export default function CompetitorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [competitor, setCompetitor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "products">("overview");
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Product editor
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "", priceRange: "", ourAdvantage: "" });
  const [savingProduct, setSavingProduct] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/competitors/${id}`);
      const data = await res.json();
      if (data.success) setCompetitor(data.data);
      else toast.error("Competitor not found");
    } catch {
      toast.error("Failed to load competitor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: "", description: "", priceRange: "", ourAdvantage: "" });
    setProductEditorOpen(true);
  };

  const openEditProduct = (p: any) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, description: p.description || "", priceRange: p.priceRange || "", ourAdvantage: p.ourAdvantage || "" });
    setProductEditorOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name) return toast.error("Name is required");
    setSavingProduct(true);
    try {
      const url = editingProduct
        ? `/api/competitors/${id}/products/${editingProduct.id}`
        : `/api/competitors/${id}/products`;
      const res = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingProduct ? "Product updated" : "Product added");
        setProductEditorOpen(false);
        load();
      } else toast.error(data.message || "Save failed");
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = (p: any) => {
    setConfirmState({
      isOpen: true,
      title: "Delete product",
      message: `Delete "${p.name}"?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/competitors/${id}/products/${p.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Product deleted"); load(); }
          else toast.error(data.message || "Delete failed");
        } catch { toast.error("Delete failed"); }
      },
    });
  };

  const canManage = ["Admin", "SalesManager"].includes(user?.role ?? "");

  if (loading) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading...</div></PageContainer>;
  if (!competitor) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-[var(--text-muted)]">Not found.</div></PageContainer>;

  return (
    <PageContainer className="space-y-4 p-0">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{competitor.name}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Competitor profile</p>
      </div>
      <Link href="/competitors" className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to competitors
      </Link>

      <div className="flex gap-1 border-b mb-5">
        {(["overview", "products"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            {t === "products" ? `Products (${competitor.products?.length ?? 0})` : "Overview"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Profile">
            <Row label="Website" value={competitor.website ? <a href={competitor.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline inline-flex items-center gap-1">{competitor.website} <ExternalLink size={12} /></a> : "—"} />
            <Row label="Status" value={<StatusPill status={competitor.isActive ? "Active" : "Inactive"} />} />
            <Row label="Lost Deals" value={competitor._count?.lostDealAnalyses ?? 0} />
          </Card>
          <Card title="Description">
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{competitor.description || "—"}</p>
          </Card>
          <Card title="Strengths">
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{competitor.strengths || "—"}</p>
          </Card>
          <Card title="Weaknesses">
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{competitor.weaknesses || "—"}</p>
          </Card>
        </div>
      )}

      {tab === "products" && (
        <div>
          <div className="flex justify-end mb-3">
            {canManage && (
              <button onClick={openNewProduct} className="btn-primary">
                <Plus size={16} /> Add Product
              </button>
            )}
          </div>
          {competitor.products?.length ? (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--surface-2)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Price Range</th>
                    <th className="px-4 py-3 font-semibold">Our Advantage</th>
                    {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {competitor.products.map((p: any) => (
                    <tr key={p.id} className="hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{p.name}<div className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{p.description}</div></td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{p.priceRange || "—"}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs"><div className="line-clamp-2">{p.ourAdvantage || "—"}</div></td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => openEditProduct(p)} className="action-icon-btn" title="Edit"><Pencil size={16} /></button>
                            <button onClick={() => handleDeleteProduct(p)} className="action-icon-btn row-action-btn-danger" title="Delete"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">No products tracked yet.</div>
          )}
        </div>
      )}

      {productEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="font-medium text-[var(--text-primary)]">{editingProduct ? "Edit Product" : "Add Product"}</h3>
              <button onClick={() => setProductEditorOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Name *</label>
                <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Description</label>
                <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Price Range</label>
                <input value={productForm.priceRange} onChange={(e) => setProductForm({ ...productForm, priceRange: e.target.value })} placeholder="e.g. $500 - $800" className="input-field" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Our Advantage</label>
                <textarea value={productForm.ourAdvantage} onChange={(e) => setProductForm({ ...productForm, ourAdvantage: e.target.value })} rows={3} className="input-field" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              <button onClick={() => setProductEditorOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveProduct} disabled={savingProduct} className="btn-primary disabled:opacity-50">
                {savingProduct ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal {...confirmState} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </PageContainer>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="analytics-chart-card">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-primary)] font-medium text-right">{value}</span>
    </div>
  );
}
