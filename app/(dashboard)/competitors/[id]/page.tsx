"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  plus: "M12 4v16m8-8H4",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3",
};

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

  if (loading) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-gray-500">Loading...</div></PageContainer>;
  if (!competitor) return <PageContainer className="space-y-4 p-0"><div className="py-12 text-center text-sm text-gray-500">Not found.</div></PageContainer>;

  return (
    <PageContainer className="space-y-4 p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{competitor.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Competitor profile</p>
      </div>
      <Link href="/competitors" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-4">
        <Ico d={icons.back} size={14} /> Back to competitors
      </Link>

      <div className="flex gap-1 border-b mb-5">
        {(["overview", "products"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t === "products" ? `Products (${competitor.products?.length ?? 0})` : "Overview"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Profile">
            <Row label="Website" value={competitor.website ? <a href={competitor.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">{competitor.website} <Ico d={icons.external} size={12} /></a> : "—"} />
            <Row label="Status" value={<span className={`px-2 py-0.5 rounded-full text-xs ${competitor.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{competitor.isActive ? "Active" : "Inactive"}</span>} />
            <Row label="Lost Deals" value={competitor._count?.lostDealAnalyses ?? 0} />
          </Card>
          <Card title="Description">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{competitor.description || "—"}</p>
          </Card>
          <Card title="Strengths">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{competitor.strengths || "—"}</p>
          </Card>
          <Card title="Weaknesses">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{competitor.weaknesses || "—"}</p>
          </Card>
        </div>
      )}

      {tab === "products" && (
        <div>
          <div className="flex justify-end mb-3">
            {canManage && (
              <button onClick={openNewProduct} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)]">
                <Ico d={icons.plus} size={16} /> Add Product
              </button>
            )}
          </div>
          {competitor.products?.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Price Range</th>
                    <th className="px-4 py-3 font-semibold">Our Advantage</th>
                    {canManage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {competitor.products.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.name}<div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</div></td>
                      <td className="px-4 py-3 text-gray-600">{p.priceRange || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs"><div className="line-clamp-2">{p.ourAdvantage || "—"}</div></td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => openEditProduct(p)} className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Ico d={icons.edit} /></button>
                            <button onClick={() => handleDeleteProduct(p)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Ico d={icons.trash} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">No products tracked yet.</div>
          )}
        </div>
      )}

      {productEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">{editingProduct ? "Edit Product" : "Add Product"}</h3>
              <button onClick={() => setProductEditorOpen(false)} className="text-gray-400 hover:text-gray-600"><Ico d="M6 18L18 6M6 6l12 12" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price Range</label>
                <input value={productForm.priceRange} onChange={(e) => setProductForm({ ...productForm, priceRange: e.target.value })} placeholder="e.g. $500 - $800" className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Our Advantage</label>
                <textarea value={productForm.ourAdvantage} onChange={(e) => setProductForm({ ...productForm, ourAdvantage: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button onClick={() => setProductEditorOpen(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveProduct} disabled={savingProduct} className="px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50">
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
    <div className="rounded-lg border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value}</span>
    </div>
  );
}
