"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  arrowLeft: "M10 19l-7-7m0 0l7-7m-7 7h18",
  save: "M5 13l4 4L19 7",
};

export default function NewProductPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    description: "",
    unit: "",
    basePrice: "",
    isActive: true,
    datasheetUrl: "",
    brochureUrl: "",
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/catalogue/categories");
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(data.data.filter((c: any) => c.isActive));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch("/api/catalogue/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          basePrice: formData.basePrice ? parseFloat(formData.basePrice) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Product created successfully");
        router.push("/catalogue/products");
      } else {
        toast.error(data.message || "Failed to create product");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create product");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <Ico d={icons.arrowLeft} size={18} />
          Back to Products
        </button>
        <h1 className="text-2xl font-bold text-white">Add New Product</h1>
        <p className="text-gray-400 mt-1">Create a new product for your catalogue</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="Enter product name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              placeholder="Enter product description"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="e.g., PCS, KG, MTR"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Base Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Datasheet URL</label>
              <input
                type="url"
                value={formData.datasheetUrl}
                onChange={(e) => setFormData({ ...formData, datasheetUrl: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Brochure URL</label>
              <input
                type="url"
                value={formData.brochureUrl}
                onChange={(e) => setFormData({ ...formData, brochureUrl: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border border-white/20 bg-white/5 text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]"
            />
            <label htmlFor="isActive" className="text-sm text-gray-300">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading || !formData.name}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Ico d={icons.save} size={18} />
              {formLoading ? "Creating..." : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
