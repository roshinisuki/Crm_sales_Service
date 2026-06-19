"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  edit: "M11 4H4a2 2 0 012-2v14a2 2 0 012 2 2h14a2 2 0 012-2V4a2 2 0 00-2-2m-6 12h6m-6-12h6",
  x: "M6 18L18 6M6 6l12 12",
  plus: "M12 4v16m8-8H4",
  chevronUp: "M18 15l-6-6m0 0l-6 6",
  chevronDown: "M6 9l6 6m0 0l6-6",
};

export default function SpecificationsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [specs, setSpecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const [specForm, setSpecForm] = useState({
    specKey: "",
    specValue: "",
    unit: "",
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/catalogue/products");
      const data = await res.json();
      if (data.success && data.data) {
        setProducts(data.data);
        if (data.data.length > 0) {
          setSelectedProductId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSpecs = async (productId: string) => {
    try {
      const res = await fetch(`/api/catalogue/products/${productId}/specs`);
      const data = await res.json();
      if (data.success && data.data) {
        setSpecs(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadSpecs(selectedProductId);
    }
  }, [selectedProductId]);

  const handleAddSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error("Please select a product first");
      return;
    }
    if (!specForm.specKey || !specForm.specValue) {
      toast.error("Please fill in spec key and value");
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch(`/api/catalogue/products/${selectedProductId}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...specForm,
          displayOrder: specs.length,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification added successfully");
        setSpecForm({ specKey: "", specValue: "", unit: "" });
        loadSpecs(selectedProductId);
      } else {
        toast.error(data.message || "Failed to add specification");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add specification");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSpec = async (specId: string) => {
    try {
      const res = await fetch(`/api/catalogue/products/${selectedProductId}/specs/${specId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification deleted successfully");
        loadSpecs(selectedProductId);
      } else {
        toast.error(data.message || "Failed to delete specification");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete specification");
    }
  };

  const handleReorder = async (specId: string, newOrder: number) => {
    try {
      const res = await fetch(`/api/catalogue/products/${selectedProductId}/specs/${specId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specKey: specs.find((s: any) => s.id === specId)?.specKey,
          specValue: specs.find((s: any) => s.id === specId)?.specValue,
          unit: specs.find((s: any) => s.id === specId)?.unit,
          displayOrder: newOrder,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadSpecs(selectedProductId);
      } else {
        toast.error("Failed to reorder specification");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to reorder specification");
    }
  };

  const selectedProduct = products.find((p: any) => p.id === selectedProductId);

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Product Specifications</h1>
        <p className="text and-gray-400 mt-1">Manage specifications for your products</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Select Product</h2>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/20 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      selectedProductId === product.id
                        ? "bg-[var(--primary)] text-white"
                        : "bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-gray-400">{product.productCode}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Specifications Management */}
        <div className="lg:col-span-2">
          {selectedProduct ? (
            <div className="bg-white/5 rounded-lg border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedProduct.name}</h2>
                  <p className="text-sm text-gray-400">{selectedProduct.productCode}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedProduct.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                  {selectedProduct.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <form onSubmit={handleAddSpec} className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={specForm.specKey}
                  onChange={(e) => setSpecForm({ ...specForm, specKey: e.target.value })}
                  placeholder="Specification Key (e.g., Weight)"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <input
                  type="text"
                  value={specForm.specValue}
                  onChange={(e) => setSpecForm({ ...specForm, specValue: e.target.value })}
                  placeholder="Value (e.g., 10kg)"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <input
                  type="text"
                  value={specForm.unit}
                  onChange={(e) => setSpecForm({ ...specForm, unit: e.target.value })}
                  placeholder="Unit (e.g., kg)"
                  className="w-32 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Ico d={icons.plus} size={18} />
                  Add
                </button>
              </form>

              {specs.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No specifications added yet</p>
              ) : (
                <div className="space-y-2">
                  {specs.map((spec, index) => (
                    <div
                      key={spec.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <span className="text-gray-400 text-sm w-6">{index + 1}</span>
                      <div className="flex-1">
                        <div className="font-medium text-white">{spec.specKey}</div>
                        <div className="text-sm text-gray-400">
                          {spec.specValue} {spec.unit && `(${spec.unit})`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (index > 0) handleReorder(spec.id, index);
                          }}
                          disabled={index === 0}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                          title="Move Up"
                        >
                          <Ico d={icons.chevronUp} size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (index < specs.length - 1) handleReorder(spec.id, index + 2);
                          }}
                          disabled={index === specs.length - 1}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                          title="Move Down"
                        >
                          <Ico d={icons.chevronDown} size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSpec(spec.id)}
                          className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Ico d={icons.x} size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 rounded-lg border border-white/10 p-6 text-center">
              <p className="text-gray-400">Select a product to manage its specifications</p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
