"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui-utils";
import {
  Plus, Search, Pencil, Trash2, X, Tag, FolderTree, Save, Check
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
    <div className="flex h-full w-full">
      {/* Center Panel: List */}
      <div className="w-[320px] lg:w-[400px] xl:w-[450px] shrink-0 border-r border-border flex flex-col bg-page-bg relative">
        <div className="p-4 border-b border-border flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <FolderTree size={18} className="text-text-muted" />
              Categories
            </h1>
            <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="p-1.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors" title="Add Category">
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-card border border-border rounded-lg text-text-primary focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-6 text-center text-text-muted text-sm">Loading categories...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-border-subtle flex items-center justify-center mb-2">
                <FolderTree size={24} className="text-text-muted" />
              </div>
              <p className="text-sm font-semibold text-text-primary">No categories found</p>
              <p className="text-xs text-text-muted mt-1 text-center">Create a category to organize products.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {filtered.map((category) => {
                const isActive = isModalOpen && formData.id === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => openEditModal(category)}
                    className={cn(
                      "w-full text-left p-3 md:p-4 hover:bg-card-hover transition-colors group flex items-start gap-3",
                      isActive ? "bg-card-hover border-l-[3px] border-l-[var(--primary)]" : "border-l-[3px] border-l-transparent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm text-text-primary truncate">{category.name}</span>
                        <span className="text-[10px] font-medium text-text-secondary bg-border-subtle px-2 py-0.5 rounded-full shrink-0">
                          {category.productCount || 0} items
                        </span>
                      </div>
                      <div className="text-xs text-text-muted mb-1.5 truncate">
                        {category.description || "No description"}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("inline-block w-2 h-2 rounded-full", category.isActive ? "bg-success-text" : "bg-text-muted")} />
                          <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">{category.isActive ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <div onClick={(e) => { e.stopPropagation(); handleToggleActive(category.id, category.isActive); }} className="p-1 rounded text-text-muted hover:bg-border-subtle hover:text-text-primary" title={category.isActive ? "Deactivate" : "Activate"}>
                             {category.isActive ? <X size={14} /> : <Check size={14} />}
                           </div>
                           <div onClick={(e) => { e.stopPropagation(); handleDelete(category.id); }} className="p-1 rounded text-text-muted hover:bg-danger-bg hover:text-danger-text" title="Delete">
                             <Trash2 size={14} />
                           </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Context / Details Form */}
      <div className="flex-1 flex flex-col min-w-0 bg-card overflow-hidden">
        {isModalOpen ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border bg-page-bg shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-border-subtle transition-colors lg:hidden">
                  <X size={18} />
                </button>
                <h2 className="text-base font-semibold text-text-primary">
                  {formData.id ? "Edit Category" : "Add New Category"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border-subtle rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={formData.id ? handleUpdate : handleCreate}
                  disabled={formLoading || !formData.name.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {formLoading ? "Saving..." : (formData.id ? "Update" : "Create")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-2xl mx-auto space-y-6">
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
                  <span className="text-sm font-medium text-text-primary">Active</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-page-bg border border-border flex items-center justify-center mb-4">
              <FolderTree className="w-8 h-8 text-text-muted" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Select a Category</h2>
            <p className="text-sm text-text-muted max-w-sm mt-2">
              Choose a category from the list to view or edit its details, or create a new one.
            </p>
          </div>
        )}
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
