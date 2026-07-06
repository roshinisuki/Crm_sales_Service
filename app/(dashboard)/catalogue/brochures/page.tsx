"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { cn, formatDate } from "@/lib/ui-utils";
import {
  Search, Pencil, Trash2, BookOpen, UploadCloud,
  X, Plus, FileCheck, ExternalLink, Save, Check
} from "lucide-react";

export default function BrochuresPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });
  const toast = useToast();

  const [formData, setFormData] = useState({
    id: "",
    productId: "",
    name: "",
    fileUrl: "",
    description: "",
    mimeType: "",
    fileSize: 0,
  });
  const [file, setFile] = useState<File | null>(null);

  const loadBrochures = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (productFilter) params.productId = productFilter;
      const res = await fetch(`/api/catalogue/brochures?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) setDocs(data.data);
    } catch {
      console.error("Failed to load brochures");
    } finally {
      setLoading(false);
    }
  }, [search, productFilter]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/catalogue/products");
      const data = await res.json();
      if (data.success && data.data) setProducts(data.data);
    } catch {
      console.error("Failed to load products");
    }
  }, []);

  useEffect(() => { loadBrochures(); loadProducts(); }, [loadBrochures, loadProducts]);

  const resetForm = () => {
    setFormData({ id: "", productId: "", name: "", fileUrl: "", description: "", mimeType: "", fileSize: 0 });
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData({ ...formData, fileUrl: reader.result as string, mimeType: selected.type, fileSize: selected.size });
    };
    reader.readAsDataURL(selected);
    if (!formData.name) {
      setFormData({ ...formData, name: selected.name.replace(/\.[^/.]+$/, "") });
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFormData({ ...formData, fileUrl: "", mimeType: "", fileSize: 0 });
  };

  const handleSave = async () => {
    if (!formData.productId || !formData.name || !formData.fileUrl) {
      toast.error("Product, name, and file URL are required");
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        productId: formData.productId,
        name: formData.name,
        fileUrl: formData.fileUrl,
        description: formData.description,
        mimeType: formData.mimeType || "application/pdf",
        fileSize: formData.fileSize || 0,
      };

      const res = formData.id
        ? await fetch(`/api/catalogue/brochures/${formData.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/catalogue/brochures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (data.success) {
        toast.success(formData.id ? "Brochure updated" : "Brochure added");
        setIsModalOpen(false);
        resetForm();
        loadBrochures();
      } else {
        toast.error(data.message || "Failed to save brochure");
      }
    } catch {
      toast.error("Failed to save brochure");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Brochure",
      message: "Are you sure you want to delete this brochure? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/catalogue/brochures/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Brochure deleted");
            loadBrochures();
          } else {
            toast.error(data.message || "Failed to delete brochure");
          }
        } catch {
          toast.error("Failed to delete brochure");
        }
      },
    });
  };

  const openEditModal = (doc: any) => {
    setFormData({
      id: doc.id,
      productId: doc.entityId,
      name: doc.name,
      fileUrl: doc.fileUrl,
      description: doc.description || "",
      mimeType: doc.mimeType || "",
      fileSize: doc.fileSize || 0,
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    resetForm();
    if (products.length > 0) setFormData((prev) => ({ ...prev, productId: products[0].id }));
    setIsModalOpen(true);
  };

  return (
    <div className="flex h-full w-full">
      {/* Center Panel: List */}
      <div className="w-[320px] lg:w-[400px] xl:w-[450px] shrink-0 border-r border-border flex flex-col bg-page-bg relative">
        <div className="p-4 border-b border-border flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <BookOpen size={18} className="text-text-muted" />
              Brochures
            </h1>
            <button onClick={openAddModal} className="p-1.5 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors" title="Add Brochure">
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search brochures..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-card border border-border rounded-lg text-text-primary focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="flex-1 py-1 px-2 text-xs bg-card border border-border rounded text-text-secondary focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-6 text-center text-text-muted text-sm">Loading brochures...</div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-border-subtle flex items-center justify-center mb-2">
                <BookOpen size={24} className="text-text-muted" />
              </div>
              <p className="text-sm font-semibold text-text-primary">No brochures found</p>
              <p className="text-xs text-text-muted mt-1 text-center">Add your first product brochure.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {docs.map((doc) => {
                const isActive = isModalOpen && formData.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => openEditModal(doc)}
                    className={cn(
                      "w-full text-left p-3 md:p-4 hover:bg-card-hover transition-colors group flex items-start gap-3",
                      isActive ? "bg-card-hover border-l-[3px] border-l-[var(--primary)]" : "border-l-[3px] border-l-transparent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm text-text-primary truncate">{doc.name}</span>
                        <span className="text-[10px] font-medium text-text-secondary bg-border-subtle px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                          <FileCheck size={12} />
                          v{doc.version}
                        </span>
                      </div>
                      <div className="text-xs text-text-muted mb-1.5 font-mono truncate">{doc.documentCode}</div>
                      <div className="text-xs text-text-secondary truncate mb-2">
                        {doc.product ? `Product: ${doc.product.name}` : "Unlinked"}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">
                          {doc.uploadedBy?.name || "—"} • {formatDate(doc.createdAt)}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 rounded text-text-muted hover:bg-blue-50 hover:text-blue-600" title="View">
                            <ExternalLink size={14} />
                          </a>
                          <div onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }} className="p-1 rounded text-text-muted hover:bg-danger-bg hover:text-danger-text" title="Delete">
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
                  {formData.id ? "Edit Brochure" : "Add New Brochure"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border-subtle rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={formLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {formLoading ? "Saving..." : (formData.id ? "Update" : "Create")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                <FormField label="Product" required>
                  <Select value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })}>
                    <option value="">Select a product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.productCode})</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Brochure Name" required>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Product Marketing Brochure 2024"
                  />
                </FormField>
                <FormField label="File Upload" hint="Upload PDF or external document link">
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-[var(--primary)]/40 transition-colors">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                          <UploadCloud size={20} />
                        </div>
                        {file ? (
                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <p className="text-sm font-medium text-text-primary">{file.name}</p>
                              <p className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); handleRemoveFile(); }}
                              className="p-1.5 rounded-full hover:bg-border-subtle text-text-muted hover:text-text-primary transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-medium text-text-secondary">Click to upload or drag and drop</p>
                            <p className="text-xs text-text-muted mt-1">PDF, DOC, XLS up to 10MB</p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </FormField>
                <FormField label="Or paste external URL" hint="Alternative to file upload">
                  <Input
                    type="url"
                    value={formData.fileUrl && !file ? formData.fileUrl : ""}
                    onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                    placeholder="https://example.com/brochure.pdf"
                    disabled={!!file}
                  />
                </FormField>
                <FormField label="Description">
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this brochure"
                    rows={3}
                  />
                </FormField>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-page-bg border border-border flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-text-muted" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Select a Brochure</h2>
            <p className="text-sm text-text-muted max-w-sm mt-2">
              Choose a brochure from the list to view or edit its details, or upload a new one.
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
