"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Paperclip, AlertCircle } from "lucide-react";
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

  if (items.length === 0 && readOnly) {
    return (
      <p className="text-sm text-slate-400 italic py-2">No products added yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--border,rgba(0,0,0,0.08))]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              {["Product / part", "Qty", "Target price (min–max)", "Material", "Required delivery", "Drawing / attachment", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
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
                  "border-t border-[var(--border,rgba(0,0,0,0.06))]",
                  idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30"
                )}
              >
                {/* Product name — searchable autocomplete */}
                <td className="px-3 py-2 relative">
                  {readOnly ? (
                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.productName || "—"}</span>
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
                        onBlur={() => setTimeout(() => setShowDropdown({ ...showDropdown, [idx]: false }), 200)}
                        placeholder="Type to search products…"
                        required
                        className="w-full min-w-[140px] px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                      />
                      {showDropdown[idx] && (
                        <div className="absolute z-30 left-0 top-full mt-0.5 w-96 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                          {filteredProducts(productSearch[idx] ?? item.productName).length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400">
                              {products.length === 0 ? "No products in catalogue" : "No match — press Enter to use typed text"}
                            </div>
                          ) : (
                            filteredProducts(productSearch[idx] ?? item.productName).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handleProductSelect(idx, p); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0"
                              >
                                <div className="flex items-baseline gap-2">
                                  <span className="font-medium text-slate-700">{p.name}</span>
                                  {p.productCode && <span className="text-xs text-slate-400">{p.productCode}</span>}
                                </div>
                                {p.category && <span className="text-xs text-slate-400">{typeof p.category === "string" ? p.category : p.category.name}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {/* Qty */}
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span>{item.estimatedQuantity || "—"}</span>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={item.estimatedQuantity}
                      onChange={(e) => handleFieldChange(idx, "estimatedQuantity", e.target.value)}
                      placeholder="500"
                      className="w-20 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                    />
                  )}
                </td>
                {/* Target price */}
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span>
                      {item.targetPriceMin || item.targetPriceMax
                        ? `${item.targetPriceMin || "—"} – ${item.targetPriceMax || "—"}`
                        : "—"}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={item.targetPriceMin}
                        onChange={(e) => handleFieldChange(idx, "targetPriceMin", e.target.value)}
                        placeholder="Min"
                        className="w-20 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                      />
                      <span className="text-slate-400">–</span>
                      <input
                        type="number"
                        value={item.targetPriceMax}
                        onChange={(e) => handleFieldChange(idx, "targetPriceMax", e.target.value)}
                        placeholder="Max"
                        className="w-20 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                      />
                    </div>
                  )}
                </td>
                {/* Material */}
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span>{item.material || "—"}</span>
                  ) : (
                    <input
                      type="text"
                      value={item.material}
                      onChange={(e) => handleFieldChange(idx, "material", e.target.value)}
                      placeholder="e.g. EN8 steel"
                      className="w-full min-w-[100px] px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                    />
                  )}
                </td>
                {/* Required delivery */}
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span>{item.requiredDelivery ? new Date(item.requiredDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                  ) : (
                    <input
                      type="date"
                      value={item.requiredDelivery}
                      onChange={(e) => handleFieldChange(idx, "requiredDelivery", e.target.value)}
                      className="px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm transition-colors"
                    />
                  )}
                </td>
                {/* Attachment */}
                <td className="px-3 py-2">
                  {readOnly ? (
                    item.attachmentUrl ? (
                      <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--primary)] hover:underline text-xs">
                        <Paperclip size={12} /> View
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )
                  ) : (
                    <div className="flex items-center gap-1">
                      {item.attachmentUrl ? (
                        <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--primary)] hover:underline text-xs">
                          <Paperclip size={12} />
                          <span className="truncate max-w-[80px]">{item.attachmentUrl.split("/").pop()}</span>
                        </a>
                      ) : (
                        <input
                          type="url"
                          value={item.attachmentUrl}
                          onChange={(e) => handleFieldChange(idx, "attachmentUrl", e.target.value)}
                          placeholder="Paste URL"
                          className="w-full min-w-[100px] px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-[var(--primary)] focus:outline-none bg-transparent text-xs transition-colors"
                        />
                      )}
                    </div>
                  )}
                </td>
                {/* Actions */}
                {!readOnly && (
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {/* Save new row button */}
                      {item._isNew && (
                        <button
                          type="button"
                          onClick={() => handleSaveRow(idx)}
                          disabled={savingIndex === idx || !item.productName || !item.estimatedQuantity}
                          className="px-2 py-1 rounded text-xs font-medium bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40 transition-colors"
                        >
                          {savingIndex === idx ? "Saving…" : "Save"}
                        </button>
                      )}
                      {/* Delete */}
                      {confirmDeleteIndex === idx ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Confirm delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          disabled={deletingIndex === idx}
                          title="Delete row"
                          className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
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
            className="rounded-lg border border-[var(--border,rgba(0,0,0,0.08))] bg-white dark:bg-slate-900 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {readOnly ? (
                  <p className="font-medium text-slate-800 dark:text-slate-200">{item.productName || "—"}</p>
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
                      onBlur={() => setTimeout(() => setShowDropdown({ ...showDropdown, [idx]: false }), 200)}
                      placeholder="Type to search products…"
                      className="w-full px-2 py-1 rounded border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm font-medium"
                    />
                    {showDropdown[idx] && (
                      <div className="absolute z-20 left-0 top-full mt-0.5 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
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
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                            >
                              <span className="font-medium text-slate-700">{p.name}</span>
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
                  className="p-1.5 rounded text-slate-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500 mb-0.5">Qty</p>
                {readOnly ? <p>{item.estimatedQuantity || "—"}</p> : (
                  <input type="number" min="1" value={item.estimatedQuantity} onChange={(e) => handleFieldChange(idx, "estimatedQuantity", e.target.value)} placeholder="Qty" className="w-full px-2 py-1 rounded border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm" />
                )}
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Material</p>
                {readOnly ? <p>{item.material || "—"}</p> : (
                  <input type="text" value={item.material} onChange={(e) => handleFieldChange(idx, "material", e.target.value)} placeholder="e.g. EN8" className="w-full px-2 py-1 rounded border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm" />
                )}
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Required delivery</p>
                {readOnly ? <p>{item.requiredDelivery ? new Date(item.requiredDelivery).toLocaleDateString("en-IN") : "—"}</p> : (
                  <input type="date" value={item.requiredDelivery} onChange={(e) => handleFieldChange(idx, "requiredDelivery", e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm" />
                )}
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Target price</p>
                {readOnly ? (
                  <p>{item.targetPriceMin || item.targetPriceMax ? `${item.targetPriceMin || "?"} – ${item.targetPriceMax || "?"}` : "—"}</p>
                ) : (
                  <div className="flex gap-1">
                    <input type="number" value={item.targetPriceMin} onChange={(e) => handleFieldChange(idx, "targetPriceMin", e.target.value)} placeholder="Min" className="w-full px-2 py-1 rounded border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm" />
                    <input type="number" value={item.targetPriceMax} onChange={(e) => handleFieldChange(idx, "targetPriceMax", e.target.value)} placeholder="Max" className="w-full px-2 py-1 rounded border border-slate-200 focus:border-[var(--primary)] focus:outline-none bg-transparent text-sm" />
                  </div>
                )}
              </div>
            </div>
            {!readOnly && item._isNew && (
              <button type="button" onClick={() => handleSaveRow(idx)} disabled={savingIndex === idx || !item.productName || !item.estimatedQuantity} className="w-full py-1.5 rounded text-xs font-medium bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40">
                {savingIndex === idx ? "Saving…" : "Save product"}
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
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <Plus size={15} />
          Add product
        </button>
      )}

      {/* Required indicator */}
      {!readOnly && items.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle size={13} />
          At least one product is required to advance to Technical Discussion
        </p>
      )}
    </div>
  );
}
