"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui-utils";
import {
  Plus, Search, Pencil, Trash2, X, Tag, FolderTree,
} from "lucide-react";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    isActive: true,
    defaultSpecifications: "",
    parentCategoryId: "",
  });

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await fetch(`/api/catalogue/categories?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) setCategories(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const resetForm = () => setFormData({ id: "", name: "", description: "", isActive: true, defaultSpecifications: "", parentCategoryId: "" });

  const handleCreate = async () => {
    setFormLoading(true);
    try {
      const res = await fetch("/api/catalogue/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive,
          defaultSpecifications: formData.defaultSpecifications || null,
          parentCategoryId: formData.parentCategoryId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Category created successfully");
        setIsModalOpen(false);
        resetForm();
        loadCategories();
      } else {
        toast.error(data.message || "Failed to create category");
      }
    } catch {
      toast.error("Failed to create category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async () => {
    setFormLoading(true);
    try {
      const res = await fetch(`/api/catalogue/categories/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          isActive: formData.isActive,
          defaultSpecifications: formData.defaultSpecifications || null,
          parentCategoryId: formData.parentCategoryId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Category updated successfully");
        setIsModalOpen(false);
        resetForm();
        loadCategories();
      } else {
        toast.error(data.message || "Failed to update category");
      }
    } catch {
      toast.error("Failed to update category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Category",
      message: "Are you sure you want to delete this category? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/catalogue/categories/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Category deleted successfully");
            loadCategories();
          } else {
            toast.error(data.message || "Failed to delete category");
          }
        } catch {
          toast.error("Failed to delete category");
        }
      },
    });
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    try {
      const res = await fetch(`/api/catalogue/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cat.name, description: cat.description, isActive: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Category status updated");
        loadCategories();
      } else {
        toast.error(data.message || "Failed to update category");
      }
    } catch {
      toast.error("Failed to update category status");
    }
  };

  const openEditModal = (category: any) => {
    setFormData({ id: category.id, name: category.name, description: category.description || "", isActive: category.isActive, defaultSpecifications: category.defaultSpecifications || "", parentCategoryId: category.parentCategoryId || "" });
    setIsModalOpen(true);
  };

  const filtered = categories;

  return (
    <PageShell
      title="Categories"
      subtitle="Organize products into hierarchical categories"
      breadcrumb={[{ label: "Product Catalogue", href: "/catalogue" }, { label: "Categories" }]}
      action={
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn-primary">
          <Plus size={16} />
          Add Category
        </button>
      }
    >
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th min-w-[180px] flex-1">Name</th>
                <th className="crm-th min-w-[200px] flex-1">Description</th>
                <th className="crm-th w-[100px] text-center">Products</th>
                <th className="crm-th w-[100px] text-center">Status</th>
                <th className="crm-th w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="crm-td text-center py-12 text-muted-foreground">
                    <div className="inline-flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-muted-foreground border-t-transparent" />
                      <span className="text-sm font-medium">Loading categories...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="crm-td text-center py-16">
                    <div className="inline-flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <FolderTree size={28} className="text-slate-400" />
                      </div>
                      <p className="text-sm text-foreground font-semibold mt-1">No categories yet</p>
                      <p className="text-xs text-muted-foreground">Create your first product category to get started</p>
                      <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="btn-primary mt-3"
                      >
                        <Plus size={16} />
                        Add Category
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((category) => (
                  <tr key={category.id} className="crm-tr group">
                    <td className="crm-td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Tag size={15} />
                        </div>
                        <button
                          onClick={() => openEditModal(category)}
                          className="font-medium text-sm text-foreground hover:text-[var(--accent)] transition-colors text-left"
                        >
                          {category.name}
                        </button>
                      </div>
                    </td>
                    <td className="crm-td">
                      <span className="text-sm text-muted-foreground truncate max-w-[200px] block" title={category.description || ""}>
                        {category.description || "—"}
                      </span>
                    </td>
                    <td className="crm-td text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                        {category.productCount || 0}
                      </span>
                    </td>
                    <td className="crm-td text-center">
                      {category.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="crm-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(category)} className="action-icon-btn" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleToggleActive(category.id, category.isActive)} className={cn("action-icon-btn", category.isActive ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50")} title={category.isActive ? "Deactivate" : "Activate"}>
                          {category.isActive ? <X size={15} /> : <Plus size={15} />}
                        </button>
                        <button onClick={() => handleDelete(category.id)} className="action-icon-btn text-rose-500 hover:bg-rose-50" title="Delete">
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

      {/* Add/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? "Edit Category" : "Add Category"}
        subtitle={formData.id ? "Update category details" : "Create a new product category"}
        size="sm"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">Cancel</button>
            <button
              onClick={formData.id ? handleUpdate : handleCreate}
              disabled={formLoading || !formData.name.trim()}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? "Saving..." : formData.id ? "Update" : "Create"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Category Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Industrial Valves"
            />
          </FormField>
          <FormField label="Parent Category" hint="Optional: Create hierarchical category structure">
            <Select
              value={formData.parentCategoryId}
              onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
            >
              <option value="">No parent (root category)</option>
              {categories
                .filter((c) => c.id !== formData.id)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
            </Select>
          </FormField>
          <FormField label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this category"
              rows={3}
            />
          </FormField>
          <FormField label="Default Specifications" hint="JSON format: specKey, specValue, unit (JSON array)">
            <Textarea
              value={formData.defaultSpecifications}
              onChange={(e) => setFormData({ ...formData, defaultSpecifications: e.target.value })}
              placeholder="Enter default specifications for this category (JSON format)"
              rows={4}
              className="font-mono text-xs"
            />
          </FormField>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-foreground">Active</span>
          </label>
        </div>
      </Modal>

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
