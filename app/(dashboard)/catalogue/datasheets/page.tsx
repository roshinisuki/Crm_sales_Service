"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { PageShell } from "@/components/ui/PageShell";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { formatDate } from "@/lib/ui-utils";
import {
  Plus, Search, Trash2, FileText, ExternalLink, Pencil,
  FileCheck, UploadCloud, X,
} from "lucide-react";

export default function DatasheetsPage() {
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

  const loadDatasheets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (productFilter) params.productId = productFilter;
      const res = await fetch(`/api/catalogue/datasheets?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success && data.data) setDocs(data.data);
    } catch {
      console.error("Failed to load datasheets");
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

  useEffect(() => { loadDatasheets(); loadProducts(); }, [loadDatasheets, loadProducts]);

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
        ? await fetch(`/api/catalogue/datasheets/${formData.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/catalogue/datasheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (data.success) {
        toast.success(formData.id ? "Datasheet updated" : "Datasheet added");
        setIsModalOpen(false);
        resetForm();
        loadDatasheets();
      } else {
        toast.error(data.message || "Failed to save datasheet");
      }
    } catch {
      toast.error("Failed to save datasheet");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Datasheet",
      message: "Are you sure you want to delete this datasheet? This action cannot be undone.",
      action: async () => {
        try {
          const res = await fetch(`/api/catalogue/datasheets/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            toast.success("Datasheet deleted");
            loadDatasheets();
          } else {
            toast.error(data.message || "Failed to delete datasheet");
          }
        } catch {
          toast.error("Failed to delete datasheet");
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
    <PageShell
      title="Datasheets"
      subtitle="Upload and manage technical product datasheets"
      breadcrumb={[{ label: "Product Catalogue", href: "/catalogue" }, { label: "Datasheets" }]}
      action={
        <button onClick={openAddModal} className="btn-primary">
          <Plus size={16} />
          Add Datasheet
        </button>
      }
    >
      {/* Filters */}
      <div className="crm-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search datasheets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="select-field max-w-[220px]"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="crm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">Document</th>
                <th className="crm-th">Product</th>
                <th className="crm-th">Version</th>
                <th className="crm-th">Uploaded By</th>
                <th className="crm-th">Date</th>
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="crm-td text-center py-12">
                    <div className="inline-flex items-center gap-3 text-muted-foreground">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-muted-foreground border-t-transparent" />
                      <span className="text-sm font-medium">Loading datasheets...</span>
                    </div>
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="crm-td text-center py-16">
                    <div className="inline-flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <FileText size={28} />
                      </div>
                      <p className="text-sm text-foreground font-semibold mt-1">No datasheets found</p>
                      <p className="text-xs text-muted-foreground">Upload your first product datasheet to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="crm-tr">
                    <td className="crm-td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground text-sm truncate max-w-[200px]">{doc.name}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{doc.documentCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="crm-td">
                      {doc.product ? (
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate max-w-[160px]">{doc.product.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{doc.product.productCode}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="crm-td">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <FileCheck size={13} className="text-muted-foreground" />
                        v{doc.version}
                      </span>
                    </td>
                    <td className="crm-td text-foreground truncate max-w-[120px]">{doc.uploadedBy?.name || "—"}</td>
                    <td className="crm-td text-muted-foreground">{formatDate(doc.createdAt)}</td>
                    <td className="crm-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="action-icon-btn text-blue-600 hover:bg-blue-50" title="View">
                          <ExternalLink size={15} />
                        </a>
                        <button onClick={() => openEditModal(doc)} className="action-icon-btn" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(doc.id)} className="action-icon-btn text-rose-500 hover:bg-rose-50" title="Delete">
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
        title={formData.id ? "Edit Datasheet" : "Add Datasheet"}
        subtitle={formData.id ? "Update datasheet details" : "Link a new datasheet to a product"}
        size="md"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="btn-ghost">Cancel</button>
            <button onClick={handleSave} disabled={formLoading} className="btn-primary">
              {formLoading ? "Saving..." : formData.id ? "Update" : "Create"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Product" required>
            <Select value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })}>
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.productCode})</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Document Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Technical Specifications Sheet"
            />
          </FormField>
          <FormField label="File Upload" required hint="Upload PDF or external document link">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[var(--primary)]/40 transition-colors">
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
                        <p className="text-sm font-medium text-slate-900">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleRemoveFile(); }}
                        className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-500">PDF, DOC, XLS up to 10MB</p>
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
              placeholder="https://example.com/datasheet.pdf"
              disabled={!!file}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this datasheet"
              rows={2}
            />
          </FormField>
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
