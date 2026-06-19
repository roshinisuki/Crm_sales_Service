"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  edit: "M11 4H4a2 2 0 012-2v14a2 2 0 012 2 2h14a2 2 0 012-2V4a2 2 0 00-2-2m-6 12h6m-6-12h6",
  x: "M6 18L18 6M6 6l12 12",
  check: "M5 13l4 4L19 7",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 012 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; action: () => void}>({ isOpen: false, title: "", message: "", action: () => {} });

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    isActive: true,
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;

      const res = await fetch(`/api/catalogue/categories?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [search]);

  const handleCreate = async () => {
    setFormLoading(true);
    try {
      const res = await fetch("/api/catalogue/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Category created successfully");
        setIsModalOpen(false);
        setFormData({ id: "", name: "", description: "", isActive: true });
        loadCategories();
      } else {
        toast.error(data.message || "Failed to create category");
      }
    } catch (err) {
      console.error(err);
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Category updated successfully");
        setIsModalOpen(false);
        setFormData({ id: "", name: "", description: "", isActive: true });
        loadCategories();
      } else {
        toast.error(data.message || "Failed to update category");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Category",
      message: "Are you sure you want to delete this category? This action cannot be undone.",
      action: async () => {
        setIsDeleting(true);
        try {
          const res = await fetch(`/api/catalogue/categories/${id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            toast.success("Category deleted successfully");
            loadCategories();
          } else {
            toast.error(data.message || "Failed to delete category");
          }
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete category");
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/catalogue/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categories.find((c: any) => c.id === id)?.name,
          description: categories.find((c: any) => c.id === id)?.description,
          isActive: !currentStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Category status updated");
        loadCategories();
      } else {
        toast.error(data.message || "Failed to update category");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update category status");
    }
  };

  const openEditModal = (category: any) => {
    setFormData({
      id: category.id,
      name: category.name,
      description: category.description || "",
      isActive: category.isActive,
    });
    setIsModalOpen(true);
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Product Categories</h1>
        <p className="text-gray-400 mt-1">Manage product categories for your catalogue</p>
      </div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Ico d={icons.search} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <button
          onClick={() => {
            setFormData({ id: "", name: "", description: "", isActive: true });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Ico d={icons.plus} size={18} />
          Add Category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-transparent" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No categories yet. Add your first product category.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Description</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">Products</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">Active</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">{category.name}</td>
                  <td className="px-4 py-3 text-gray-400">{category.description || "-"}</td>
                  <td className="px-4 py-3 text-center">{category.productCount || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${category.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(category)}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors"
                        title="Edit"
                      >
                        <Ico d={icons.edit} size={16} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(category.id, category.isActive)}
                        className={`p-1.5 rounded hover:bg-white/10 transition-colors ${category.isActive ? "text-amber-600" : "text-emerald-600"}`}
                        title={category.isActive ? "Deactivate" : "Activate"}
                      >
                        <Ico d={category.isActive ? icons.x : icons.check} size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Ico d={icons.x} size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--sidebar-bg)] rounded-xl border border-white/10 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {formData.id ? "Edit Category" : "Add Category"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                  placeholder="Category description"
                  rows={3}
                />
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
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={formData.id ? handleUpdate : handleCreate}
                disabled={formLoading || !formData.name}
                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {formLoading ? "Saving..." : formData.id ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

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
