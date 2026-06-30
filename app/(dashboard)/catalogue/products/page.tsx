"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Select, Input } from "@/components/ui/FormField";
import { cn } from "@/lib/ui-utils";
import {
  Plus, Search, Trash2, Check, X, FileText, BookOpen,
  Package, Eye, ArrowUpDown, Filter, Download, Upload,
} from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productType, setProductType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const view = searchParams.get("view") || "";

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryId) params.categoryId = categoryId;
      if (productType) params.productType = productType;
      if (statusFilter) params.status = statusFilter;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (sortBy) params.sortBy = sortBy;
      if (sortOrder) params.sortOrder = sortOrder;
      if (view) params.view = view;
      const res = await fetch(`/api/catalogue/products?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) setProducts(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, productType, statusFilter, minPrice, maxPrice, sortBy, sortOrder, view]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/catalogue/categories");
      const data = await res.json();
      if (data.success && data.data) setCategories(data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [loadProducts, loadCategories]);

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Product",
      message: "Are you sure you want to delete this product? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/catalogue/products/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Product deleted successfully");
            loadProducts();
          } else {
            toast.error(data.message || "Failed to delete product");
          }
        } catch {
          toast.error("Failed to delete product");
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
    } catch {
      toast.error("Failed to update product status");
    }
  };

  const pageTitle = view === "datasheets" ? "Datasheets" : view === "brochures" ? "Brochures" : "Products";
  const pageSubtitle = view === "datasheets" ? "Browse product datasheets" : view === "brochures" ? "Browse product brochures" : "Manage your product catalogue";

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      if (categoryId) params.categoryId = categoryId;
      if (statusFilter) params.isActive = statusFilter;
      const res = await fetch(`/api/catalogue/products/bulk-export?${new URLSearchParams(params)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `products-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Products exported successfully");
      } else {
        toast.error("Failed to export products");
      }
    } catch {
      toast.error("Failed to export products");
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const headers = lines[0].split(",");
      const products = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        if (values.length >= 2) {
          products.push({
            name: values[1]?.trim() || "",
            categoryId: values[2]?.trim() || "",
            description: values[3]?.trim() || "",
            unit: values[4]?.trim() || "",
            basePrice: values[5]?.trim() || "",
            productType: values[6]?.trim() || "",
            minOrderQuantity: values[7]?.trim() || "",
            isActive: values[8]?.trim() === "Active",
            datasheetUrl: values[9]?.trim() || "",
            brochureUrl: values[10]?.trim() || "",
            productImageUrl: values[11]?.trim() || "",
          });
        }
      }

      try {
        const res = await fetch("/api/catalogue/products/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(data.message);
          loadProducts();
        } else {
          toast.error(data.message || "Failed to import products");
        }
      } catch {
        toast.error("Failed to import products");
      }
    };
    reader.readAsText(file);
  };

  return (
    <PageShell
      title={pageTitle}
      subtitle={pageSubtitle}
      breadcrumb={[{ label: "Product Catalogue", href: "/catalogue" }, { label: pageTitle }]}
      action={!view ? (
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => document.getElementById("bulk-import-input")?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white transition-colors"
          >
            <Upload size={16} />
            Import CSV
          </button>
          <input
            type="file"
            id="bulk-import-input"
            className="hidden"
            accept=".csv"
            onChange={handleBulkImport}
          />
          <button onClick={() => router.push("/catalogue/products/new")} className="btn-primary">
            <Plus size={16} />
            Add Product
          </button>
        </div>
      ) : undefined}
    >
      {/* Filters */}
      <div className="mt-6 mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="max-w-[200px]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="max-w-[150px]"
          >
            <option value="">All Types</option>
            <option value="FinishedGood">Finished Good</option>
            <option value="RawMaterial">Raw Material</option>
            <option value="Component">Component</option>
            <option value="SubAssembly">Sub-Assembly</option>
            <option value="Consumable">Consumable</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="max-w-[120px]"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
          <Input
            type="number"
            placeholder="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="max-w-[120px]"
          />
          <Input
            type="number"
            placeholder="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="max-w-[120px]"
          />
          <button
            onClick={() => {
              setSearch("");
              setCategoryId("");
              setProductType("");
              setStatusFilter("");
              setMinPrice("");
              setMaxPrice("");
            }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Sort by:</span>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="max-w-[150px]"
          >
            <option value="name">Name</option>
            <option value="productCode">Code</option>
            <option value="basePrice">Price</option>
            <option value="createdAt">Date</option>
          </Select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
            title={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
          >
            <ArrowUpDown size={16} className={sortOrder === "asc" ? "" : "rotate-180"} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">Code</th>
                <th className="crm-th">Product Name</th>
                <th className="crm-th">Category</th>
                <th className="crm-th">Unit</th>
                <th className="crm-th text-right">Base Price</th>
                <th className="crm-th text-center">Status</th>
                {!view && <th className="crm-th text-center">Docs</th>}
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={view ? 7 : 8} className="crm-td text-center py-12">
                    <div className="inline-flex items-center gap-3 text-muted-foreground">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-muted-foreground border-t-transparent" />
                      <span className="text-sm font-medium">Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={view ? 7 : 8} className="crm-td text-center py-12">
                    <Package size={32} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-foreground font-medium">No products found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add your first product to get started</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="crm-tr">
                    <td className="crm-td font-mono text-xs text-muted-foreground">{product.productCode}</td>
                    <td className="crm-td">
                      <button
                        onClick={() => router.push(`/catalogue/products/${product.id}`)}
                        className="font-medium text-foreground hover:text-[var(--accent)] truncate max-w-[220px] text-left"
                      >
                        {product.name}
                      </button>
                    </td>
                    <td className="crm-td text-muted-foreground truncate max-w-[150px]">{product.category?.name || "—"}</td>
                    <td className="crm-td text-muted-foreground">{product.unit || "—"}</td>
                    <td className="crm-td text-right font-medium text-foreground">{product.basePrice ? formatCurrency(product.basePrice) : "—"}</td>
                    <td className="crm-td text-center">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                        product.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      )}>
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {!view && (
                      <td className="crm-td text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {product.datasheets && product.datasheets.length > 0 ? (
                            <span className="action-icon-btn text-blue-600 hover:bg-blue-50" title={`${product.datasheets.length} Datasheet${product.datasheets.length > 1 ? 's' : ''}`}>
                              <FileText size={14} />
                            </span>
                          ) : (
                            <span className="w-[30px]" />
                          )}
                          {product.brochures && product.brochures.length > 0 ? (
                            <span className="action-icon-btn text-rose-600 hover:bg-rose-50" title={`${product.brochures.length} Brochure${product.brochures.length > 1 ? 's' : ''}`}>
                              <BookOpen size={14} />
                            </span>
                          ) : (
                            <span className="w-[30px]" />
                          )}
                        </div>
                      </td>
                    )}
                    <td className="crm-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => router.push(`/catalogue/products/${product.id}`)} className="action-icon-btn" title="View Details">
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(product.id, product.isActive)}
                          className={cn("action-icon-btn", product.isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50")}
                          title={product.isActive ? "Deactivate" : "Activate"}
                        >
                          {product.isActive ? <X size={15} /> : <Check size={15} />}
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="action-icon-btn text-rose-500 hover:bg-rose-50" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </PageShell>
  );
}
