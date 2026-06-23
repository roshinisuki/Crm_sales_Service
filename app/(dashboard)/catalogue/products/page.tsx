"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  x: "M6 18L18 6M6 6l12 12",
  check: "M5 13l4 4L19 7",
  file: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  external: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; action: () => void}>({ isOpen: false, title: "", message: "", action: () => {} });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (categoryId) params.categoryId = categoryId;
      const view = searchParams.get("view");
      if (view) params.view = view;

      const res = await fetch(`/api/catalogue/products?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/catalogue/categories");
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [search, categoryId, searchParams]);

  const handleDelete = async (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Product",
      message: "Are you sure you want to delete this product? This action cannot be undone.",
      action: async () => {
        setIsDeleting(true);
        try {
          const res = await fetch(`/api/catalogue/products/${id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            toast.success("Product deleted successfully");
            loadProducts();
          } else {
            toast.error(data.message || "Failed to delete product");
          }
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete product");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/catalogue/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Product status updated");
        loadProducts();
      } else {
        toast.error(data.message || "Failed to update product");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update product status");
    }
  };

  const view = searchParams.get("view") || "";
  const pageTitle = view === "datasheets" ? "Datasheets" : view === "brochures" ? "Brochures" : "Products";
  const pageSubtitle = view === "datasheets" ? "Browse product datasheets" : view === "brochures" ? "Browse product brochures" : "Manage your product catalogue";

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
        <p className="text-slate-500 mt-1">{pageSubtitle}</p>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center flex-1">
          <div className="relative flex-1 max-w-md">
            <Ico d={icons.search} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        {!view && (
        <button
          onClick={() => router.push("/catalogue/products/new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Ico d={icons.plus} size={18} />
          Add Product
        </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No products yet. Add your first product to the catalogue.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Unit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Base Price</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Active</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-slate-200 hover:bg-white transition-colors">
                  <td className="px-4 py-3 font-mono text-sm">{product.productCode}</td>
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-slate-500">{product.category?.name || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{product.unit || "-"}</td>
                  <td className="px-4 py-3 text-right">{product.basePrice ? formatCurrency(product.basePrice) : "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {product.datasheetUrl && (
                        <a
                          href={product.datasheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                          title="View Datasheet"
                        >
                          <Ico d={icons.file} size={16} />
                        </a>
                      )}
                      {product.brochureUrl && (
                        <a
                          href={product.brochureUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-700"
                          title="View Brochure"
                        >
                          <Ico d={icons.file} size={16} />
                        </a>
                      )}
                      {!product.datasheetUrl && !product.brochureUrl && <span className="text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/catalogue/products/${product.id}`)}
                        className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                        title="View Details"
                      >
                        <Ico d={icons.external} size={16} className="text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(product.id, product.isActive)}
                        className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${product.isActive ? "text-amber-600" : "text-emerald-600"}`}
                        title={product.isActive ? "Deactivate" : "Activate"}
                      >
                        <Ico d={product.isActive ? icons.x : icons.check} size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Ico d={icons.x} size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </PageContainer>
  );
}
