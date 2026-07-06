"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { Input } from "@/components/ui/FormField";
import { cn } from "@/lib/ui-utils";
import {
  Search, Plus, Trash2, ChevronUp, ChevronDown, SlidersHorizontal,
  Package,
} from "lucide-react";

export default function SpecificationsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [specs, setSpecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const toast = useToast();

  const [specForm, setSpecForm] = useState({ specKey: "", specValue: "", unit: "" });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/catalogue/products");
      const data = await res.json();
      if (data.success && data.data) {
        setProducts(data.data);
        if (data.data.length > 0) setSelectedProductId(data.data[0].id);
      }
    } catch {
      console.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSpecs = useCallback(async (productId: string) => {
    try {
      const res = await fetch(`/api/catalogue/products/${productId}/specs`);
      const data = await res.json();
      if (data.success && data.data) setSpecs(data.data);
    } catch {
      console.error("Failed to load specs");
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (selectedProductId) loadSpecs(selectedProductId); }, [selectedProductId, loadSpecs]);

  const handleAddSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) { toast.error("Please select a product first"); return; }
    if (!specForm.specKey || !specForm.specValue) { toast.error("Please fill in spec key and value"); return; }
    setFormLoading(true);
    try {
      const res = await fetch(`/api/catalogue/products/${selectedProductId}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...specForm, displayOrder: specs.length }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification added successfully");
        setSpecForm({ specKey: "", specValue: "", unit: "" });
        loadSpecs(selectedProductId);
      } else {
        toast.error(data.message || "Failed to add specification");
      }
    } catch {
      toast.error("Failed to add specification");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSpec = async (specId: string) => {
    try {
      const res = await fetch(`/api/catalogue/products/${selectedProductId}/specs/${specId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification deleted");
        loadSpecs(selectedProductId);
      } else {
        toast.error(data.message || "Failed to delete specification");
      }
    } catch {
      toast.error("Failed to delete specification");
    }
  };

  const handleReorder = async (specId: string, newOrder: number) => {
    const spec = specs.find((s) => s.id === specId);
    if (!spec) return;
    try {
      const res = await fetch(`/api/catalogue/products/${selectedProductId}/specs/${specId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specKey: spec.specKey, specValue: spec.specValue, unit: spec.unit, displayOrder: newOrder }),
      });
      const data = await res.json();
      if (data.success) loadSpecs(selectedProductId);
      else toast.error("Failed to reorder specification");
    } catch {
      toast.error("Failed to reorder specification");
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const filteredProducts = products.filter((p) =>
    !productSearch ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.productCode.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <PageShell
      title="Specifications"
      subtitle="Define and manage technical specifications for products"
      breadcrumb={[{ label: "Product Catalogue", href: "/catalogue" }, { label: "Specifications" }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        {/* Product Selection Panel */}
        <div className="lg:col-span-1">
          <div className="crm-card p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-800">Select Product</h2>
            </div>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="input-field pl-9 text-sm"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-transparent" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No products found</p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg transition-all",
                      selectedProductId === product.id
                        ? "bg-[var(--accent-soft)] border border-[var(--accent)]/30"
                        : "hover:bg-slate-50 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-semibold truncate",
                      selectedProductId === product.id ? "text-[var(--accent)]" : "text-slate-800"
                    )}>
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{product.productCode}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Specifications Panel */}
        <div className="lg:col-span-2">
          {selectedProduct ? (
            <div className="crm-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{selectedProduct.name}</h2>
                    <p className="text-xs text-slate-400 font-mono">{selectedProduct.productCode}</p>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold",
                  selectedProduct.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                )}>
                  {selectedProduct.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Add Spec Form */}
              <form onSubmit={handleAddSpec} className="flex flex-col sm:flex-row gap-2.5 mb-5">
                <Input
                  value={specForm.specKey}
                  onChange={(e) => setSpecForm({ ...specForm, specKey: e.target.value })}
                  placeholder="Spec Key (e.g. Weight)"
                  className="flex-1"
                />
                <Input
                  value={specForm.specValue}
                  onChange={(e) => setSpecForm({ ...specForm, specValue: e.target.value })}
                  placeholder="Value (e.g. 10)"
                  className="flex-1"
                />
                <Input
                  value={specForm.unit}
                  onChange={(e) => setSpecForm({ ...specForm, unit: e.target.value })}
                  placeholder="Unit (e.g. kg)"
                  className="w-full sm:w-32"
                />
                <button type="submit" disabled={formLoading} className="btn-primary shrink-0">
                  <Plus size={16} />
                  {formLoading ? "Adding..." : "Add"}
                </button>
              </form>

              {/* Specs Table */}
              {specs.length === 0 ? (
                <div className="text-center py-10">
                  <SlidersHorizontal size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500 font-medium">No specifications yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add specifications using the form above</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="crm-table">
                    <thead>
                      <tr>
                        <th className="crm-th w-16">#</th>
                        <th className="crm-th">Spec Key</th>
                        <th className="crm-th">Value</th>
                        <th className="crm-th">Unit</th>
                        <th className="crm-th text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specs.map((spec, index) => (
                        <tr key={spec.id} className="crm-tr">
                          <td className="crm-td font-mono text-sm text-muted-foreground text-center">{index + 1}</td>
                          <td className="crm-td font-medium text-foreground">{spec.specKey}</td>
                          <td className="crm-td text-muted-foreground">{spec.specValue}</td>
                          <td className="crm-td text-muted-foreground">{spec.unit || "—"}</td>
                          <td className="crm-td text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                onClick={() => index > 0 && handleReorder(spec.id, index)}
                                disabled={index === 0}
                                className="action-icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move Up"
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                onClick={() => index < specs.length - 1 && handleReorder(spec.id, index + 2)}
                                disabled={index === specs.length - 1}
                                className="action-icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move Down"
                              >
                                <ChevronDown size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteSpec(spec.id)}
                                className="action-icon-btn text-rose-500 hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="crm-card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
                <SlidersHorizontal size={28} />
              </div>
              <p className="text-sm text-foreground font-semibold">Select a product to manage specifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">Choose a product from the list on the left</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
