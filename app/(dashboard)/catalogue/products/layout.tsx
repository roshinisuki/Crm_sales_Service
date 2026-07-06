"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { FormField, Select, Input } from "@/components/ui/FormField";
import { cn } from "@/lib/ui-utils";
import {
  Plus, Search, Trash2, Check, X, FileText, BookOpen,
  Package, Filter, Download, Upload, Eye
} from "lucide-react";

export default function ProductsWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productType, setProductType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryId) params.categoryId = categoryId;
      if (productType) params.productType = productType;
      if (statusFilter) params.status = statusFilter;
      if (sortBy) params.sortBy = sortBy;
      if (sortOrder) params.sortOrder = sortOrder;
      
      const res = await fetch(`/api/catalogue/products?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) setProducts(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, productType, statusFilter, sortBy, sortOrder]);

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

  return (
    <div className="flex h-full w-full">
      {/* Center Panel: List */}
      <div className="w-[320px] lg:w-[400px] xl:w-[450px] shrink-0 border-r border-border flex flex-col bg-page-bg relative">
        <div className="p-4 border-b border-border flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Package size={18} className="text-text-muted" />
              Products
            </h1>
            <button onClick={() => router.push("/catalogue/products/new")} className="p-1.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors" title="Add Product">
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-card border border-border rounded-lg text-text-primary focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex-1 py-1 px-2 text-xs bg-card border border-border rounded text-text-secondary focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-24 py-1 px-2 text-xs bg-card border border-border rounded text-text-secondary focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">Any Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-6 text-center text-text-muted text-sm">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-border-subtle flex items-center justify-center mb-2">
                <Package size={24} className="text-text-muted" />
              </div>
              <p className="text-sm font-semibold text-text-primary">No products found</p>
              <p className="text-xs text-text-muted mt-1 text-center">Adjust filters or create a new product.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {products.map((product) => {
                const isActive = pathname === `/catalogue/products/${product.id}`;
                return (
                  <button
                    key={product.id}
                    onClick={() => router.push(`/catalogue/products/${product.id}`)}
                    className={cn(
                      "w-full text-left p-3 md:p-4 hover:bg-card-hover transition-colors group flex items-start gap-3",
                      isActive ? "bg-card-hover border-l-[3px] border-l-[var(--primary)]" : "border-l-[3px] border-l-transparent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm text-text-primary truncate">{product.name}</span>
                        {product.basePrice && <span className="font-semibold text-xs text-text-primary shrink-0 ml-2">{formatCurrency(product.basePrice)}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mb-1.5">
                        <span className="font-mono">{product.productCode}</span>
                        <span>•</span>
                        <span className="truncate">{product.category?.name || "Uncategorized"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "inline-block w-2 h-2 rounded-full",
                          product.isActive ? "bg-success-text" : "bg-text-muted"
                        )} />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">{product.isActive ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Context / Details */}
      <div className="flex-1 flex flex-col min-w-0 bg-card overflow-hidden">
        {children}
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })}
        isDestructive={true}
      />
    </div>
  );
}
