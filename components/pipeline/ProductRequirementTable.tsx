"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Paperclip, AlertCircle, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/ui-utils";

export interface RequirementItem {
  id?: string; // undefined = unsaved new row
  productName: string;
  estimatedQuantity: string;
  targetPriceMin: string;
  targetPriceMax: string;
  material: string;
  requiredDelivery: string;
  specNotes: string;
  attachmentUrl: string;
  _isNew?: boolean;
}

function emptyItem(): RequirementItem {
  return {
    productName: "",
    estimatedQuantity: "",
    targetPriceMin: "",
    targetPriceMax: "",
    material: "",
    requiredDelivery: "",
    specNotes: "",
    attachmentUrl: "",
    _isNew: true,
  };
}

interface ProductRequirementTableProps {
  items: RequirementItem[];
  onChange: (items: RequirementItem[]) => void;
  onSaveItem: (item: RequirementItem, index: number) => Promise<void>;
  onDeleteItem: (item: RequirementItem, index: number) => Promise<void>;
  readOnly?: boolean;
  saving?: boolean;
  products?: { id: string; name: string; productCode?: string; category?: string | { id: string; name: string } }[];
}

export function ProductRequirementTable({
  items,
  onChange,
  onSaveItem,
  onDeleteItem,
  readOnly = false,
  saving = false,
  products = [],
}: ProductRequirementTableProps) {
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [showDropdown, setShowDropdown] = useState<Record<number, boolean>>({});

  const hasData = (item: RequirementItem) =>
    item.productName || item.estimatedQuantity || item.material || item.attachmentUrl;

  const filteredProducts = (search: string) => {
    if (!search.trim()) return products.slice(0, 15);
    const q = search.toLowerCase();
    return products
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.productCode || "").toLowerCase().includes(q) ||
        (typeof p.category === "string" ? p.category : p.category?.name || "").toLowerCase().includes(q)
      )
      .slice(0, 15);
  };

  const handleProductSelect = (index: number, product: { id: string; name: string; productCode?: string; category?: string | { id: string; name: string } }) => {
    const next = items.map((it, i) => (i === index ? { ...it, productName: product.name } : it));
    onChange(next);
    setShowDropdown({ ...showDropdown, [index]: false });
    setProductSearch({ ...productSearch, [index]: "" });
    // Trigger auto-save immediately on product select if it's an existing item
    const itemToSave = next[index];
    if (itemToSave.id && itemToSave.estimatedQuantity) {
      handleSaveRowDirect(next, index);
    }
  };

  const handleFieldChange = (index: number, field: keyof RequirementItem, value: string) => {
    const next = items.map((it, i) => (i === index ? { ...it, [field]: value } : it));
    onChange(next);
  };

  const handleAddRow = () => {
    onChange([...items, emptyItem()]);
    // Focus first input of new row after render
    setTimeout(() => firstInputRef.current?.focus(), 50);
  };

  const handleSaveRow = async (index: number) => {
    const item = items[index];
    if (!item.productName.trim() || !item.estimatedQuantity) return;
    setSavingIndex(index);
    try {
      await onSaveItem(item, index);
    } finally {
      setSavingIndex(null);
    }
  };

  const handleSaveRowDirect = async (currentItems: RequirementItem[], index: number) => {
    const item = currentItems[index];
    if (!item.productName.trim() || !item.estimatedQuantity) return;
    setSavingIndex(index);
    try {
      await onSaveItem(item, index);
    } finally {
      setSavingIndex(null);
    }
  };

  const handleBlur = async (index: number) => {
    const item = items[index];
    // Only auto-save on-blur for existing items to avoid premature empty creates
    if (!item.id) return;
    if (item.productName.trim() && item.estimatedQuantity) {
      await handleSaveRow(index);
    }
  };

  const handleDeleteRow = async (index: number) => {
    const item = items[index];
    if (hasData(item) && confirmDeleteIndex !== index) {
      setConfirmDeleteIndex(index);
      return;
    }
    setConfirmDeleteIndex(null);
    setDeletingIndex(index);
    try {
      await onDeleteItem(item, index);
    } finally {
      setDeletingIndex(null);
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const next = items.map((it, i) =>
          i === index ? { ...it, attachmentUrl: json.fileUrl } : it
        );
        onChange(next);
        const itemToSave = next[index];
        if (itemToSave.productName?.trim() && itemToSave.estimatedQuantity) {
          await onSaveItem(itemToSave, index);
        }
      } else {
        alert(json.message || "Failed to upload file");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload file due to network error");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemoveAttachment = async (index: number) => {
    const next = items.map((it, i) =>
      i === index ? { ...it, attachmentUrl: "" } : it
    );
    onChange(next);
    const itemToSave = next[index];
    if (itemToSave.productName?.trim() && itemToSave.estimatedQuantity && itemToSave.id) {
      await onSaveItem(itemToSave, index);
    }
  };

  if (items.length === 0 && readOnly) {
    return (
      <p className="text-sm text-slate-400 italic py-2">No products added yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200">
              {["Product / part", "Qty", "Target price (min–max)", "Material", "Required delivery", "Drawing / attachment", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id || idx}
                className={cn(
                  "border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors",
                  idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/20 dark:bg-slate-800/10"
                )}
              >
                {/* Product name — searchable autocomplete */}
                <td className="px-4 py-3 relative">
                  {readOnly ? (
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.productName || "—"}</span>
                  ) : (
                    <div className="relative">
                      <input
                        ref={idx === items.length - 1 && item._isNew ? firstInputRef : undefined}
                        type="text"
                        value={item.productName}
                        onChange={(e) => {
                          handleFieldChange(idx, "productName", e.target.value);
                          setProductSearch({ ...productSearch, [idx]: e.target.value });
                          setShowDropdown({ ...showDropdown, [idx]: true });
                        }}
                        onFocus={() => {
                          setProductSearch({ ...productSearch, [idx]: item.productName });
                          setShowDropdown({ ...showDropdown, [idx]: true });
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowDropdown({ ...showDropdown, [idx]: false }), 200);
                          handleBlur(idx);
                        }}
                        placeholder="Search or type product name…"
                        required
                        className="w-full min-w-[180px] px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none bg-white dark:bg-slate-800 text-sm transition-all shadow-sm"
                      />
                      {showDropdown[idx] && (
                        <div className="absolute z-30 left-0 top-full mt-1 w-96 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:bg-slate-800 shadow-xl">
                          {filteredProducts(productSearch[idx] ?? item.productName).length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400">
                              {products.length === 0 ? "No products in catalogue" : "No match — press Enter to use custom name"}
                            </div>
                          ) : (
                            filteredProducts(productSearch[idx] ?? item.productName).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handleProductSelect(idx, p); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0"
                              >
                                <div className="flex items-baseline gap-2">
                                  <span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                                  {p.productCode && <span className="text-xs text-slate-400">{p.productCode}</span>}
                                </div>
                                {p.category && <span className="text-xs text-slate-400 block">{typeof p.category === "string" ? p.category : p.category.name}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {/* Qty */}
                <td className="px-4 py-3">
                  {readOnly ? (
                    <span className="font-medium text-slate-850 dark:text-slate-200">{item.estimatedQuantity || "—"}</span>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={item.estimatedQuantity}
                      onChange={(e) => handleFieldChange(idx, "estimatedQuantity", e.target.value)}
                      onBlur={() => handleBlur(idx)}
                      placeholder="500"
                      className="w-24 px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none bg-white dark:bg-slate-800 text-sm transition-all shadow-sm"
                    />
                  )}
                </td>
                {/* Target price */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {readOnly ? (
                    <span className="text-slate-700 dark:text-slate-350">
                      {item.targetPriceMin || item.targetPriceMax
                        ? `₹ ${item.targetPriceMin || "—"} – ₹ ${item.targetPriceMax || "—"}`
                        : "—"}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={item.targetPriceMin}
                        onChange={(e) => handleFieldChange(idx, "targetPriceMin", e.target.value)}
                        onBlur={() => handleBlur(idx)}
                        placeholder="Min"
                        className="w-20 px-2 py-2 rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none bg-white dark:bg-slate-800 text-xs transition-all shadow-sm"
                      />
                      <span className="text-slate-400 text-xs">–</span>
                      <input
                        type="number"
                        value={item.targetPriceMax}
                        onChange={(e) => handleFieldChange(idx, "targetPriceMax", e.target.value)}
                        onBlur={() => handleBlur(idx)}
                        placeholder="Max"
                        className="w-20 px-2 py-2 rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none bg-white dark:bg-slate-800 text-xs transition-all shadow-sm"
                      />
                    </div>
                  )}
                </td>
                {/* Material */}
                <td className="px-4 py-3">
                  {readOnly ? (
                    <span className="text-slate-700 dark:text-slate-300">{item.material || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      value={item.material}
                      onChange={(e) => handleFieldChange(idx, "material", e.target.value)}
                      onBlur={() => handleBlur(idx)}
                      placeholder="e.g. EN8 steel"
                      className="w-full min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none bg-white dark:bg-slate-800 text-sm transition-all shadow-sm"
                    />
                  )}
                </td>
                {/* Required delivery */}
                <td className="px-4 py-3">
                  {readOnly ? (
                    <span className="text-slate-700 dark:text-slate-300">{item.requiredDelivery ? new Date(item.requiredDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                  ) : (
                    <input
                      type="date"
                      value={item.requiredDelivery ? item.requiredDelivery.split("T")[0] : ""}
                      onChange={(e) => handleFieldChange(idx, "requiredDelivery", e.target.value)}
                      onBlur={() => handleBlur(idx)}
                      className="px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none bg-white dark:bg-slate-800 text-sm transition-all shadow-sm"
                    />
                  )}
                </td>
                {/* Attachment */}
                <td className="px-4 py-3">
                  {readOnly ? (
                    item.attachmentUrl ? (
                      <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline font-semibold text-xs bg-[var(--primary)]/10 px-2 py-1 rounded">
                        <Paperclip size={12} /> View Document
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      {uploadingIndex === idx ? (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                          <Loader2 size={13} className="animate-spin" /> Uploading...
                        </div>
                      ) : item.attachmentUrl ? (
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--primary)] hover:underline text-xs font-semibold">
                            <Paperclip size={13} />
                            <span className="truncate max-w-[90px]">{item.attachmentUrl.split("/").pop()}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="text-slate-450 hover:text-red-500 transition-colors"
                            title="Remove file"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="file"
                            id={`file-upload-row-${idx}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(idx, file);
                            }}
                          />
                          <label
                            htmlFor={`file-upload-row-${idx}`}
                            className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
                          >
                            <Upload size={12} /> Upload Drawing
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {/* Actions */}
                {!readOnly && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Save new row button */}
                      {item._isNew && (
                        <button
                          type="button"
                          onClick={() => handleSaveRow(idx)}
                          disabled={savingIndex === idx || !item.productName || !item.estimatedQuantity}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40 transition-colors shadow-sm"
                        >
                          {savingIndex === idx ? "Saving…" : "Save"}
                        </button>
                      )}
                      {/* Delete */}
                      {confirmDeleteIndex === idx ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm animate-pulse"
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          disabled={deletingIndex === idx}
                          title="Delete product"
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: stacked cards ── */}
      <div className="md:hidden space-y-3">
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            className="rounded-xl border border-slate-250 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {readOnly ? (
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{item.productName || "—"}</p>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={item.productName}
                      onChange={(e) => {
                        handleFieldChange(idx, "productName", e.target.value);
                        setProductSearch({ ...productSearch, [idx]: e.target.value });
                        setShowDropdown({ ...showDropdown, [idx]: true });
                      }}
                      onFocus={() => {
                        setProductSearch({ ...productSearch, [idx]: item.productName });
                        setShowDropdown({ ...showDropdown, [idx]: true });
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowDropdown({ ...showDropdown, [idx]: false }), 200);
                        handleBlur(idx);
                      }}
                      placeholder="Product name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-white dark:bg-slate-850 text-sm font-semibold shadow-sm"
                    />
                    {showDropdown[idx] && (
                      <div className="absolute z-20 left-0 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:bg-slate-800 shadow-xl">
                        {filteredProducts(productSearch[idx] ?? item.productName).length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400">
                            {products.length === 0 ? "No products in catalogue" : "No match — type to use custom name"}
                          </div>
                        ) : (
                          filteredProducts(productSearch[idx] ?? item.productName).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); handleProductSelect(idx, p); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 last:border-0"
                            >
                              <span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                              {p.productCode && <span className="text-xs text-slate-400 ml-2">{p.productCode}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDeleteRow(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-400 font-semibold mb-1">Qty</p>
                {readOnly ? <p className="font-medium text-slate-700">{item.estimatedQuantity || "—"}</p> : (
                  <input type="number" min="1" value={item.estimatedQuantity} onChange={(e) => handleFieldChange(idx, "estimatedQuantity", e.target.value)} onBlur={() => handleBlur(idx)} placeholder="Qty" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm shadow-sm" />
                )}
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1">Material</p>
                {readOnly ? <p className="font-medium text-slate-700">{item.material || "—"}</p> : (
                  <input type="text" value={item.material} onChange={(e) => handleFieldChange(idx, "material", e.target.value)} onBlur={() => handleBlur(idx)} placeholder="Material" className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm shadow-sm" />
                )}
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1">Required Delivery</p>
                {readOnly ? <p className="font-medium text-slate-700">{item.requiredDelivery ? new Date(item.requiredDelivery).toLocaleDateString("en-IN") : "—"}</p> : (
                  <input type="date" value={item.requiredDelivery ? item.requiredDelivery.split("T")[0] : ""} onChange={(e) => handleFieldChange(idx, "requiredDelivery", e.target.value)} onBlur={() => handleBlur(idx)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm shadow-sm" />
                )}
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1">Target Price (Min - Max)</p>
                {readOnly ? (
                  <p className="font-medium text-slate-700">{item.targetPriceMin || item.targetPriceMax ? `₹ ${item.targetPriceMin || "?"} – ₹ ${item.targetPriceMax || "?"}` : "—"}</p>
                ) : (
                  <div className="flex gap-1.5">
                    <input type="number" value={item.targetPriceMin} onChange={(e) => handleFieldChange(idx, "targetPriceMin", e.target.value)} onBlur={() => handleBlur(idx)} placeholder="Min" className="w-full px-2 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm shadow-sm" />
                    <input type="number" value={item.targetPriceMax} onChange={(e) => handleFieldChange(idx, "targetPriceMax", e.target.value)} onBlur={() => handleBlur(idx)} placeholder="Max" className="w-full px-2 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-sm shadow-sm" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Mobile Attachment Upload */}
            {!readOnly && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">Drawing/Attachment</span>
                {uploadingIndex === idx ? (
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Loader2 size={12} className="animate-spin" /> Uploading...
                  </div>
                ) : item.attachmentUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline font-semibold flex items-center gap-1">
                      <Paperclip size={12} /> View File
                    </a>
                    <button type="button" onClick={() => handleRemoveAttachment(idx)} className="text-red-500">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id={`file-upload-mobile-${idx}`}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(idx, file);
                      }}
                    />
                    <label htmlFor={`file-upload-mobile-${idx}`} className="cursor-pointer text-[var(--primary)] font-bold flex items-center gap-1">
                      <Upload size={12} /> Upload File
                    </label>
                  </div>
                )}
              </div>
            )}

            {!readOnly && item._isNew && (
              <button type="button" onClick={() => handleSaveRow(idx)} disabled={savingIndex === idx || !item.productName || !item.estimatedQuantity} className="w-full py-2.5 rounded-lg text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40 shadow-sm transition-all">
                {savingIndex === idx ? "Saving…" : "Save Product Requirement"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add row button */}
      {!readOnly && (
        <button
          type="button"
          onClick={handleAddRow}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-500 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all bg-white dark:bg-slate-900 shadow-sm hover:shadow"
        >
          <Plus size={16} />
          Add product
        </button>
      )}

      {/* Required indicator */}
      {!readOnly && items.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
          <AlertCircle size={14} className="text-amber-500" />
          At least one product requirement must be added to proceed to Technical Discussion
        </p>
      )}
    </div>
  );
}
