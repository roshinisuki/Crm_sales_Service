"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { ArrowLeft, Save, Plus, UploadCloud, X, Image as ImageIcon } from "lucide-react";

export default function NewProductPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    description: "",
    unit: "",
    basePrice: "",
    productType: "",
    minOrderQuantity: "",
    isActive: true,
    datasheetUrl: "",
    brochureUrl: "",
    productImageUrl: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

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
    <PageShell
      title="Add New Product"
      subtitle="Create a new product for your catalogue"
      breadcrumb={[
        { label: "Product Catalogue", href: "/catalogue" },
        { label: "Products", href: "/catalogue/products" },
        { label: "Add New Product" },
      ]}
    >

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="crm-card p-6 space-y-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Datasheet URL">
              <Input
                type="url"
                value={formData.datasheetUrl}
                onChange={(e) => setFormData({ ...formData, datasheetUrl: e.target.value })}
                placeholder="https://..."
              />
            </FormField>
            <FormField label="Brochure URL">
              <Input
                type="url"
                value={formData.brochureUrl}
                onChange={(e) => setFormData({ ...formData, brochureUrl: e.target.value })}
                placeholder="https://..."
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Active</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => router.back()}
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
              {formLoading ? "Creating..." : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
