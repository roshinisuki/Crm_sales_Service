"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
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
    <div className="flex h-full w-full">
      {/* Center Panel: Product Selection */}
      <div className="w-[320px] lg:w-[400px] xl:w-[450px] shrink-0 border-r border-border flex flex-col bg-page-bg relative">
        <div className="p-4 border-b border-border flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-text-muted" />
              Specifications
            </h1>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-card border border-border rounded-lg text-text-primary focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-6 text-center text-text-muted text-sm">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-border-subtle flex items-center justify-center mb-2">
                <Package size={24} className="text-text-muted" />
              </div>
              <p className="text-sm font-semibold text-text-primary">No products found</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                  className={cn(
                    "w-full text-left p-3 md:p-4 hover:bg-card-hover transition-colors group flex items-start gap-3",
                    selectedProductId === product.id ? "bg-card-hover border-l-[3px] border-l-[var(--primary)]" : "border-l-[3px] border-l-transparent"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm text-text-primary truncate">{product.name}</span>
                    </div>
                    <div className="text-xs text-text-muted font-mono">{product.productCode}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Specifications Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-card overflow-hidden">
        {selectedProduct ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border bg-page-bg shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  {selectedProduct.productCode}
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    selectedProduct.isActive ? "bg-success-bg text-success-text" : "bg-border text-text-muted"
                  )}>
                    {selectedProduct.isActive ? "Active" : "Inactive"}
                  </span>
                </h2>
                <p className="text-xs text-text-muted">{selectedProduct.name}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-4xl mx-auto space-y-6">
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
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-page-bg border border-border flex items-center justify-center mb-4">
              <SlidersHorizontal className="w-8 h-8 text-text-muted" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Select a Product</h2>
            <p className="text-sm text-text-muted max-w-sm mt-2">
              Choose a product from the list to view and manage its technical specifications.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
