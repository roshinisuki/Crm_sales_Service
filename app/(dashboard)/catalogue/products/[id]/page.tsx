"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  arrowLeft: "M10 19l-7-7m0 0l7-7m-7 7h18",
  save: "M5 13l4 4L19 7",
  edit: "M11 4H4a2 2 0 012-2v14a2 2 0 012 2 2h14a2 2 0 012-2V4a2 2 0 00-2-2m-6 12h6m-6-12h6",
  x: "M6 18L18 6M6 6l12 12",
  file: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  plus: "M12 4v16m8-8H4",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 011-1h2a1 1 0 011 1v3M4 7h16",
};

export default function ProductDetailPage() {
  const [product, setProduct] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [specs, setSpecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; action: () => void}>({ isOpen: false, title: "", message: "", action: () => {} });

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

  const [specForm, setSpecForm] = useState({
    specKey: "",
    specValue: "",
    unit: "",
  });

  const loadProduct = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/catalogue/products/${params.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setProduct(data.data);
        setFormData({
          name: data.data.name,
          categoryId: data.data.categoryId || "",
          description: data.data.description || "",
          unit: data.data.unit || "",
          basePrice: data.data.basePrice?.toString() || "",
          isActive: data.data.isActive,
          datasheetUrl: data.data.datasheetUrl || "",
          brochureUrl: data.data.brochureUrl || "",
        });
      } else {
        toast.error("Product not found");
        router.push("/catalogue/products");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/catalogue/categories");
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(data.data.filter((c: any) => c.isActive));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSpecs = async () => {
    try {
      const res = await fetch(`/api/catalogue/products/${params.id}/specs`);
      const data = await res.json();
      if (data.success && data.data) {
        setSpecs(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadProduct();
      loadCategories();
      loadSpecs();
    }
  }, [params.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch(`/api/catalogue/products/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          basePrice: formData.basePrice ? parseFloat(formData.basePrice) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Product updated successfully");
        setIsEditing(false);
        loadProduct();
      } else {
        toast.error(data.message || "Failed to update product");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update product");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Product",
      message: "Are you sure you want to delete this product? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/catalogue/products/${params.id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            toast.success("Product deleted successfully");
            router.push("/catalogue/products");
          } else {
            toast.error(data.message || "Failed to delete product");
          }
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete product");
        }
      },
    });
  };

  const handleAddSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specForm.specKey || !specForm.specValue) {
      toast.error("Please fill in spec key and value");
      return;
    }
    try {
      const res = await fetch(`/api/catalogue/products/${params.id}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...specForm,
          displayOrder: specs.length,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification added");
        setSpecForm({ specKey: "", specValue: "", unit: "" });
        loadSpecs();
      } else {
        toast.error(data.message || "Failed to add specification");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add specification");
    }
  };

  const handleDeleteSpec = async (specId: string) => {
    try {
      const res = await fetch(`/api/catalogue/products/${params.id}/specs/${specId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Specification deleted");
        loadSpecs();
      } else {
        toast.error(data.message || "Failed to delete specification");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete specification");
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  if (!product) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-gray-400">Product not found</p>
        </div>
      </PageContainer>
    );
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{product.productCode}</h1>
            <p className="text-gray-400 mt-1">{product.name}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
            >
              <Ico d={icons.edit} size={18} />
              {isEditing ? "Cancel" : "Edit"}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
            >
              <Ico d={icons.trash} size={18} />
              Delete
            </button>
          </div>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleUpdate} className="space-y-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Brochure URL</label>
              <input
                type="url"
                value={formData.brochureUrl}
                onChange={(e) => setFormData({ ...formData, brochureUrl: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
              onClick={() => setIsEditing(false)}
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
              {formLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">Category</p>
              <p className="text-white">{product.category?.name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Unit</p>
              <p className="text-white">{product.unit || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Base Price</p>
              <p className="text-white">{product.basePrice ? `₹${product.basePrice.toFixed(2)}` : "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Status</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                {product.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          {product.description && (
            <div>
              <p className="text-sm text-gray-400 mb-1">Description</p>
              <p className="text-white">{product.description}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {product.datasheetUrl && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Datasheet</p>
                <a
                  href={product.datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
                >
                  <Ico d={icons.file} size={16} />
                  View Datasheet
                </a>
              </div>
            )}
            {product.brochureUrl && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Brochure</p>
                <a
                  href={product.brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-2"
                >
                  <Ico d={icons.file} size={16} />
                  View Brochure
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Specifications Section */}
      <div className="border-t border-white/10 pt-6">
        <h2 className="text-xl font-bold text-white mb-4">Specifications</h2>
        
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
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            <Ico d={icons.plus} size={18} />
            Add
          </button>
        </form>

        {specs.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No specifications added yet</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Unit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.id} className="border-b border-white/10">
                    <td className="px-4 py-3">{spec.specKey}</td>
                    <td className="px-4 py-3">{spec.specValue}</td>
                    <td className="px-4 py-3 text-gray-400">{spec.unit || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteSpec(spec.id)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Ico d={icons.x} size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
