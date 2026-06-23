"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  save: "M5 13l4 4L19 7",
  file: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3",
  x: "M6 18L18 6M6 6l12 12",
};

export default function ProductDatasheetsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [datasheetUrl, setDatasheetUrl] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/catalogue/products/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setProduct(data.data);
        setDatasheetUrl(data.data.datasheetUrl || "");
      } else {
        toast.error("Product not found");
        router.push("/catalogue/products");
      }
    } catch {
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogue/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasheetUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Datasheet URL updated");
        setEditing(false);
        load();
      } else {
        toast.error(data.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  if (!product) return null;

  return (
    <PageContainer>
      <div className="mb-6">
        <button
          onClick={() => router.push(`/catalogue/products/${id}`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <Ico d={icons.back} size={18} />
          Back to Product
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Datasheets</h1>
          <p className="text-slate-500 mt-1">{product.productCode} — {product.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 max-w-2xl">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Datasheet URL</label>
              <input
                type="url"
                value={datasheetUrl}
                onChange={(e) => setDatasheetUrl(e.target.value)}
                placeholder="https://example.com/datasheet.pdf"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <p className="text-xs text-slate-500 mt-1.5">Link to a PDF or external document hosting the product datasheet.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Ico d={icons.save} size={18} />
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setDatasheetUrl(product.datasheetUrl || ""); }}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Current Datasheet</h2>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                Edit
              </button>
            </div>
            {datasheetUrl ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <Ico d={icons.file} size={24} className="text-[var(--primary)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{datasheetUrl.split("/").pop() || "Datasheet"}</p>
                  <p className="text-xs text-slate-500 truncate">{datasheetUrl}</p>
                </div>
                <a
                  href={datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Ico d={icons.external} size={14} />
                  View
                </a>
              </div>
            ) : (
              <div className="text-center py-8">
                <Ico d={icons.file} size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No datasheet linked to this product yet.</p>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-3 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Add Datasheet URL
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
