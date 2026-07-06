"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { ArrowLeft, Save, Edit, X, FileText, Plus, Trash2, Package, UploadCloud, Image as ImageIcon, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/ui-utils";

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
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; action: () => void}>({ isOpen: false, title: "", message: "", action: () => {} });

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    description: "",
    unit: "",
    basePrice: "",
    productType: "",
    minOrderQuantity: "",
    isActive: true,
    productImageUrl: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

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
          productType: data.data.productType || "",
          minOrderQuantity: data.data.minOrderQuantity?.toString() || "",
          isActive: data.data.isActive,
          productImageUrl: data.data.productImageUrl || "",
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setImageFile(selected);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData({ ...formData, productImageUrl: reader.result as string });
    };
    reader.readAsDataURL(selected);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setFormData({ ...formData, productImageUrl: "" });
  };

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

  const handleDelete = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Product",
      message: "Are you sure you want to delete this product? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/catalogue/products/${params.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Product deleted successfully");
            router.push("/catalogue/products");
          } else {
            toast.error(data.message || "Failed to delete product");
          }
        } catch {
          toast.error("Failed to delete product");
        }
      },
    });
  };

  if (loading) {
    return (
      <PageShell title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-transparent" />
        </div>
      </PageShell>
    );
  }

  if (!product) {
    return (
      <PageShell title="Product Not Found">
        <div className="text-center py-12">
          <p className="text-slate-500">Product not found</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={product.productCode}
      subtitle={product.name}
      breadcrumb={[
        { label: "Product Catalogue", href: "/catalogue" },
        { label: "Products", href: "/catalogue/products" },
        { label: product.productCode },
      ]}
      action={
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn-ghost"
          >
            <Edit size={16} />
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      }
    >

      {isEditing ? (
        <form onSubmit={handleUpdate} className="crm-card p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Product Name" required>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter product name"
              />
            </FormField>
            <FormField label="Category">
              <Select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter product description"
              rows={4}
            />
          </FormField>

          <FormField label="Product Image" hint="Upload product photo for display">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[var(--primary)]/40 transition-colors">
              <input
                type="file"
                id="image-upload"
                className="hidden"
                onChange={handleImageChange}
                accept="image/*"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  {formData.productImageUrl ? (
                    <div className="relative">
                      <img
                        src={formData.productImageUrl}
                        alt="Product preview"
                        className="w-32 h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleRemoveImage(); }}
                        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <p className="text-sm text-slate-600">
                    {formData.productImageUrl ? "Click to change image" : "Click to upload image"}
                  </p>
                  <p className="text-xs text-slate-400">JPG, PNG, WEBP up to 5MB</p>
                </div>
              </label>
            </div>
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Unit" hint="e.g., PCS, KG, MTR">
              <Input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="PCS"
              />
            </FormField>
            <FormField label="Base Price">
              <Input
                type="number"
                step="0.01"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                placeholder="0.00"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Product Type">
              <Select
                value={formData.productType}
                onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
              >
                <option value="">Select type</option>
                <option value="FinishedGood">Finished Good</option>
                <option value="RawMaterial">Raw Material</option>
                <option value="Component">Component</option>
                <option value="SubAssembly">Sub-Assembly</option>
                <option value="Consumable">Consumable</option>
              </Select>
            </FormField>
            <FormField label="Min Order Quantity">
              <Input
                type="number"
                step="0.01"
                value={formData.minOrderQuantity}
                onChange={(e) => setFormData({ ...formData, minOrderQuantity: e.target.value })}
                placeholder="0"
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border border-slate-300 bg-white text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading || !formData.name}
              className="btn-primary"
            >
              <Save size={16} />
              {formLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          {/* Info card */}
          <div className="crm-card p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Category</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{product.category?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Unit</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{product.unit || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Base Price</p>
                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{product.basePrice ? formatCurrency(product.basePrice) : "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Status</p>
                <span className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                  product.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                )}>
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Product Type</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{product.productType ? product.productType.replace(/([A-Z])/g, ' $1').trim() : "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Min Order Qty</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{product.minOrderQuantity || "—"}</p>
              </div>
            </div>
            {product.description && (
              <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Description</p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>

          {/* Documents row */}
          {(product.datasheets?.length > 0 || product.brochures?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {product.datasheets && product.datasheets.length > 0 && (
                <div className="crm-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <FileText size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Datasheets</h3>
                  </div>
                  <div className="space-y-2">
                    {product.datasheets.map((ds: any) => (
                      <a
                        key={ds.id}
                        href={ds.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                      >
                        <FileText size={14} />
                        {ds.title || ds.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {product.brochures && product.brochures.length > 0 && (
                <div className="crm-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <FileText size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Brochures</h3>
                  </div>
                  <div className="space-y-2">
                    {product.brochures.map((br: any) => (
                      <a
                        key={br.id}
                        href={br.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors"
                      >
                        <FileText size={14} />
                        {br.title || br.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Specifications Section */}
      <div className="crm-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <SlidersHorizontal size={16} />
          </div>
          <h2 className="text-base font-bold text-[var(--text-primary)]">Specifications</h2>
        </div>

        <form onSubmit={handleAddSpec} className="flex flex-col sm:flex-row gap-2.5 mb-5">
          <Input
            type="text"
            value={specForm.specKey}
            onChange={(e) => setSpecForm({ ...specForm, specKey: e.target.value })}
            placeholder="Specification Key (e.g., Weight)"
            className="flex-1"
          />
          <Input
            type="text"
            value={specForm.specValue}
            onChange={(e) => setSpecForm({ ...specForm, specValue: e.target.value })}
            placeholder="Value (e.g., 10kg)"
            className="flex-1"
          />
          <Input
            type="text"
            value={specForm.unit}
            onChange={(e) => setSpecForm({ ...specForm, unit: e.target.value })}
            placeholder="Unit (e.g., kg)"
            className="w-full sm:w-32"
          />
          <button type="submit" disabled={formLoading} className="btn-primary shrink-0">
            <Plus size={16} />
            {formLoading ? "Adding..." : "Add"}
          </button>
        </form>

        {specs.length === 0 ? (
          <div className="text-center py-10">
            <SlidersHorizontal size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-[var(--text-secondary)] font-medium">No specifications added yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Add specifications using the form above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="crm-th">Key</th>
                  <th className="crm-th">Value</th>
                  <th className="crm-th">Unit</th>
                  <th className="crm-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.id} className="crm-tr">
                    <td className="crm-td font-medium text-foreground">{spec.specKey}</td>
                    <td className="crm-td text-muted-foreground">{spec.specValue}</td>
                    <td className="crm-td text-muted-foreground">{spec.unit || "—"}</td>
                    <td className="crm-td text-right">
                      <button
                        onClick={() => handleDeleteSpec(spec.id)}
                        className="action-icon-btn text-rose-500 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 size={15} />
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
    </PageShell>
  );
}
