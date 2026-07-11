"use client";

import { cn } from "@/lib/ui-utils";
import { FileText, Download } from "lucide-react";
import EntityDocumentTab from "@/components/documents/EntityDocumentTab";
import { statusColors } from "./QuotationStatusColors";
import { Ico, icons } from "./QuotationIcons";

interface QuotationTabsProps {
  q: any;
  quotation: any;
  formatCurrency: (value: number) => string;
  toast: { error: (message: string) => void };
}

export default function QuotationTabs({ q, quotation, formatCurrency, toast }: QuotationTabsProps) {
  return (
    <>
{/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-1">
          {[
            { key: "items", label: "Line Items" },
            { key: "history", label: "Status History" },
            { key: "revisions", label: "Revisions" },
            { key: "approvals", label: "Approvals" },
            { key: "documents", label: "Documents" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => q.setActiveTab(tab.key as any)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                q.activeTab === tab.key
                  ? "border-[var(--primary)] text-[var(--primary)] font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line Items Tab */}
      {q.activeTab === "items" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Line Items</h2>
            {q.editMode && (
              <button onClick={q.addEditItem} className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer">
                <Ico d={icons.plus} size={14} /> Add Item
              </button>
            )}
          </div>

          {q.editMode ? (
            <div className="p-6 space-y-4">
              {q.showBelowFloorWarning && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
                  <Ico d={icons.alert} size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Low Margin Override Alert</p>
                    <p>One or more edited prices will drop the margin below the {q.marginFloor}% floor. A Sales Manager or Admin approval will be required to send this quotation.</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {q.editItems.map((item: any, idx: number) => {
                  const rfqLine = quotation.rfq?.lineItems?.find(
                    (li: any) => li.productId === item.productId || li.itemDescription === item.description
                  );
                  const qtyBreaks = rfqLine?.quantityBreaks || [];
                  const price = parseFloat(item.unitPrice) || 0;
                  const cost = parseFloat(item.costBasisUnitPrice) || 0;
                  const liveMargin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;

                  let liveMarginText = "";
                  let liveMarginCls = "text-slate-400";
                  if (liveMargin !== null) {
                    liveMarginText = `Margin: ${liveMargin.toFixed(1)}%`;
                    if (liveMargin >= 20) liveMarginCls = "text-emerald-600 font-bold";
                    else if (liveMargin >= q.marginFloor) liveMarginCls = "text-amber-600 font-bold";
                    else liveMarginCls = "text-rose-600 font-bold animate-pulse";
                  } else {
                    liveMarginText = "unknown — no cost basis";
                  }

                  return (
                    <div key={item.id || idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-4 relative">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Description / Product</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => { q.updateEditItem(idx, "description", e.target.value); q.searchProducts(e.target.value, idx); }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                            placeholder="Type to search products..."
                          />
                          {q.productSearch?.idx === idx && q.productResults.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {q.productResults.map((p: any) => (
                                <button key={p.id} onClick={() => q.selectProduct(p, idx)} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs cursor-pointer">
                                  <span className="font-medium">{p.name}</span>
                                  <span className="text-[10px] text-slate-500 ml-2">({p.productCode})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">HSN</label>
                          <input type="text" value={item.hsn} onChange={(e) => q.updateEditItem(idx, "hsn", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Qty</label>
                          <input type="number" step="0.01" value={item.quantity} onChange={(e) => q.updateEditItem(idx, "quantity", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">UOM</label>
                          <input type="text" value={item.unit} onChange={(e) => q.updateEditItem(idx, "unit", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none" />
                        </div>

                        <div className="col-span-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Price (₹)</label>
                          <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => { q.updateEditItem(idx, "unitPrice", e.target.value); q.updateEditItem(idx, "priceSource", "ManualOverride"); }} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none" />
                          <p className={cn("text-[9px] mt-0.5 font-medium whitespace-nowrap", liveMarginCls)}>{liveMarginText}</p>
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Disc%</label>
                          <input type="number" step="0.01" min="0" max="100" value={item.discountPercent} onChange={(e) => q.updateEditItem(idx, "discountPercent", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Tax%</label>
                          <input type="number" step="0.01" value={item.taxPercent} onChange={(e) => q.updateEditItem(idx, "taxPercent", e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none" />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total</label>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 py-2">{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0) * (1 - (parseFloat(item.discountPercent) || 0) / 100))}</p>
                        </div>

                        <div className="col-span-0.5 flex justify-end items-end pb-2">
                          <button onClick={() => q.removeEditItem(idx)} className="p-1 rounded-md hover:bg-rose-50 text-rose-500 cursor-pointer" title="Remove"><Ico d={icons.x} size={14} /></button>
                        </div>
                      </div>

                      {qtyBreaks.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">RFQ Price Ladder:</span>
                          {qtyBreaks.map((qb: any) => (
                            <button
                              key={qb.id}
                              type="button"
                              onClick={() => {
                                const costing = qb.costingSheets?.[0];
                                const marginPct = costing?.marginPercent ?? 0;
                                const costBasis = marginPct > 0 ? qb.computedUnitPrice / (1 + marginPct / 100) : qb.computedUnitPrice;
                                q.updateEditItem(idx, "quantity", String(qb.quantity));
                                q.updateEditItem(idx, "unitPrice", String(qb.computedUnitPrice));
                                q.updateEditItem(idx, "costBasisUnitPrice", String(costBasis));
                                q.updateEditItem(idx, "quantityBreakId", qb.id);
                                q.updateEditItem(idx, "priceSource", "RFQCosting");
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-semibold transition-all border",
                                item.quantityBreakId === qb.id
                                  ? "bg-slate-850 text-white border-slate-850 dark:bg-slate-100 dark:text-slate-900"
                                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                              )}
                            >
                              {qb.quantity} pcs @ ₹{qb.computedUnitPrice.toFixed(2)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Discount (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={q.editDiscount} onChange={(e) => q.setEditDiscount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Valid Until</label>
                  <input type="date" value={q.editValidUntil} onChange={(e) => q.setEditValidUntil(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Lead Time (days)</label>
                  <input type="number" value={q.editLeadTimeDays} onChange={(e) => q.setEditLeadTimeDays(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Terms</label>
                  <textarea value={q.editPaymentTerms} onChange={(e) => q.setEditPaymentTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Delivery Terms</label>
                  <textarea value={q.editDeliveryTerms} onChange={(e) => q.setEditDeliveryTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Freight Terms</label>
                  <textarea value={q.editFreightTerms} onChange={(e) => q.setEditFreightTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Terms & Conditions</label>
                  <textarea value={q.editTerms} onChange={(e) => q.setEditTerms(e.target.value)} rows={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">Totals and tax percents are server-computed on save — client values are automatically reconciled</p>
            </div>
          ) : (
            <>
              <table className="crm-table">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/40">
                    <th className="crm-th text-left w-10">#</th>
                    <th className="crm-th text-left">Description</th>
                    <th className="crm-th text-center">HSN</th>
                    <th className="crm-th text-right">Qty</th>
                    <th className="crm-th text-center">UOM</th>
                    <th className="crm-th text-right">Unit Price</th>
                    <th className="crm-th text-center">Margin</th>
                    <th className="crm-th text-right">Disc%</th>
                    <th className="crm-th text-right">Tax%</th>
                    <th className="crm-th text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items?.map((item: any, idx: number) => {
                    const margin = item.marginPercent ? parseFloat(String(item.marginPercent)) : null;
                    let marginColor = "text-slate-400";
                    if (margin !== null) {
                      if (margin >= 20) marginColor = "text-emerald-600 font-semibold";
                      else if (margin >= q.marginFloor) marginColor = "text-amber-600 font-semibold";
                      else marginColor = "text-rose-600 font-semibold";
                    }
                    return (
                      <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/40">
                        <td className="crm-td text-left text-slate-400">{idx + 1}</td>
                        <td className="crm-td font-semibold text-slate-700 dark:text-slate-200">
                          {item.description}
                          {item.product && <span className="text-[10px] text-slate-400 ml-2 font-normal">({item.product.productCode})</span>}
                          {item.priceSource && (
                            <div className="text-[9px] mt-0.5 font-bold uppercase tracking-wider">
                              {item.priceSource === "RFQCosting" ? <span className="text-emerald-600">from RFQ costing</span> : item.priceSource === "ManualOverride" ? <span className="text-amber-500">manual override</span> : <span className="text-slate-400">no cost basis</span>}
                            </div>
                          )}
                        </td>
                        <td className="crm-td text-center text-slate-500">{item.hsn || "—"}</td>
                        <td className="crm-td text-right text-slate-700 dark:text-slate-200">{item.quantity}</td>
                        <td className="crm-td text-center text-slate-500">{item.unit || "Nos"}</td>
                        <td className="crm-td text-right text-slate-700 dark:text-slate-200">{formatCurrency(item.unitPrice)}</td>
                        <td className="crm-td text-center"><span className={marginColor}>{margin !== null ? `${margin.toFixed(1)}%` : "unknown"}</span></td>
                        <td className="crm-td text-right text-slate-500">{item.discountPercent || 0}%</td>
                        <td className="crm-td text-right text-slate-500">{item.taxPercent || 18}%</td>
                        <td className="crm-td text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.lineTotal || item.totalPrice)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700">
                <div className="ml-auto w-full max-w-xs space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Subtotal:</span><span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(quotation.subtotal || quotation.totalAmount)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Discount ({quotation.discountPercent}%):</span><span className="font-semibold text-rose-600">-{formatCurrency((quotation.subtotal || quotation.totalAmount) * quotation.discountPercent / 100)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Tax (GST):</span><span className="font-semibold text-slate-800 dark:text-slate-200">+{formatCurrency(quotation.taxAmount || 0)}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-300 dark:border-slate-600"><span className="text-slate-800 dark:text-slate-200">Grand Total:</span><span className="text-[var(--primary)] font-black">{formatCurrency(quotation.finalAmount)}</span></div>
                </div>
              </div>

              {(quotation.paymentTerms || quotation.deliveryTerms || quotation.freightTerms || quotation.leadTimeDays || quotation.termsAndConditions) && (
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Commercial Terms</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {quotation.paymentTerms && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Payment:</span> <span className="text-slate-700 dark:text-slate-300 ml-1">{quotation.paymentTerms}</span></div>}
                    {quotation.deliveryTerms && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Delivery:</span> <span className="text-slate-700 dark:text-slate-300 ml-1">{quotation.deliveryTerms}</span></div>}
                    {quotation.freightTerms && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Freight:</span> <span className="text-slate-700 dark:text-slate-300 ml-1">{quotation.freightTerms}</span></div>}
                    {quotation.leadTimeDays && <div><span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Lead Time:</span> <span className="text-slate-700 dark:text-slate-300 ml-1">{quotation.leadTimeDays} days</span></div>}
                  </div>
                  {quotation.termsAndConditions && <p className="text-[11px] text-slate-500 mt-3 whitespace-pre-wrap leading-relaxed">{quotation.termsAndConditions}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Status History Tab */}
      {q.activeTab === "history" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Status History</h2>
          <div className="space-y-3">
            {quotation.quotationStatusHistories?.map((h: any, idx: number) => (
              <div key={h.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${idx === 0 ? "bg-[var(--primary)]" : "bg-slate-300 dark:bg-slate-600"}`} />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[h.toStatus] || "bg-slate-100 text-slate-600"}`}>{h.toStatus}</span>
                    {h.fromStatus && <span className="text-[10px] text-slate-400">from {h.fromStatus}</span>}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{h.notes}</p>
                  <p className="text-slate-400 mt-0.5">{new Date(h.changedAt).toLocaleString()} by {h.changedBy?.name || "System"}</p>
                </div>
              </div>
            )) || <p className="text-xs text-slate-400 italic">No status history</p>}
          </div>
        </div>
      )}

      {/* Revisions Tab */}
      {q.activeTab === "revisions" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-xs">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Revision History</h2>
          <div className="space-y-3">
            {quotation.revisionSnapshots?.length > 0 ? (
              quotation.revisionSnapshots.map((rev: any) => (
                <div key={rev.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold">R{rev.revisionNumber}</span>
                    {rev.revisionNumber === 1 ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[9px] font-bold">Root</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[9px] font-bold">v{rev.revisionNumber}</span>
                    )}
                    <span className="text-slate-700 dark:text-slate-300 font-medium ml-1">{new Date(rev.createdAt).toLocaleString()}</span>
                    <span className="text-slate-400">by {rev.createdBy?.name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { try { const snap = JSON.parse(rev.snapshotJson); q.setRevisionModal({ open: true, revisionNumber: rev.revisionNumber, data: snap }); } catch { toast.error("Failed to load snapshot"); } }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      View Snapshot
                    </button>
                    <a
                      href={`/api/quotations/${q.id}/pdf?revision=${rev.revisionNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No revisions cloned yet</p>
            )}
            <p className="text-slate-400 italic mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
              <span>Current version:</span>
              <span className={cn(
                "px-2 py-0.5 rounded-md font-bold text-[11px]",
                quotation.revisionNumber === 1
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                  : "bg-blue-50 text-blue-700 border border-blue-200/50"
              )}>
                R{quotation.revisionNumber || 1} {quotation.revisionNumber === 1 ? "(Root)" : ""}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {q.activeTab === "approvals" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6 text-xs">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Approval History</h2>
          <div className="space-y-3">
            {quotation.quotationApprovals?.length > 0 ? (
              quotation.quotationApprovals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.status === "Approved" ? "bg-green-100 text-green-700 border border-green-200/50" : a.status === "Rejected" ? "bg-red-100 text-red-700 border-red-200/50" : "bg-amber-100 text-amber-700 border-amber-200/50"}`}>{a.status}</span>
                    <div>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold">Requested by {a.requestedBy?.name || "—"}</p>
                      <p className="text-slate-400 text-[10px]">Required: {a.requiredApproverRole || "SalesManager"}{a.approver && ` (Assigned: ${a.approver.name})`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700 dark:text-slate-300">{a.discountPercent?.toFixed(1)}% Discount</p>
                    <p className="text-slate-400 text-[10px]">{new Date(a.createdAt).toLocaleDateString()}{a.decidedAt && ` → ${new Date(a.decidedAt).toLocaleDateString()}`}</p>
                    {a.notes && <p className="text-[10px] text-slate-500 mt-1">{a.notes}</p>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No approval requests</p>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {q.activeTab === "documents" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Generated PDFs</h2>
              <button onClick={q.handleGeneratePdf} disabled={q.generatingPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer disabled:opacity-60">
                <FileText size={15} /> {q.generatingPdf ? "Generating..." : "Generate PDF"}
              </button>
            </div>
            {q.quotationDocuments.length > 0 ? (
              <div className="space-y-2">
                {q.quotationDocuments.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-indigo-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{doc.fileName}</p>
                        <p className="text-xs text-slate-400">R{doc.revisionNumber} · {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : "—"} · {new Date(doc.generatedAt).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    <button onClick={() => q.handleDownloadDoc(doc)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer">
                      <Download size={14} /> Download
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm">No PDFs generated yet. Click &quot;Generate PDF&quot; to create one for this revision.</p>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Uploaded Documents</h2>
            <EntityDocumentTab entityType="Quotation" entityId={quotation.id} defaultDocumentType="Quotation" />
          </div>
        </div>
      )}
{/* Revision Snapshot Modal */}
      {q.revisionModal.open && q.revisionModal.data && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => q.setRevisionModal({ open: false, revisionNumber: 0, data: null })}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wide">Revision R{q.revisionModal.revisionNumber} Snapshot</h3>
              <button onClick={() => q.setRevisionModal({ open: false, revisionNumber: 0, data: null })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"><Ico d={icons.x} size={18} /></button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Code:</span> <span className="text-slate-800 dark:text-slate-200">{q.revisionModal.data.quotationCode}</span></div>
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Status:</span> <span className="text-slate-800 dark:text-slate-200">{q.revisionModal.data.status}</span></div>
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Subtotal:</span> <span className="text-slate-800 dark:text-slate-200">₹{q.revisionModal.data.subtotal?.toFixed(2)}</span></div>
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Tax:</span> <span className="text-slate-800 dark:text-slate-200">₹{q.revisionModal.data.taxAmount?.toFixed(2)}</span></div>
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Discount:</span> <span className="text-slate-800 dark:text-slate-200">{q.revisionModal.data.discountPercent}%</span></div>
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Final:</span> <span className="text-slate-800 dark:text-slate-200">₹{q.revisionModal.data.finalAmount?.toFixed(2)}</span></div>
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Valid Until:</span> <span className="text-slate-800 dark:text-slate-200">{q.revisionModal.data.validUntil ? new Date(q.revisionModal.data.validUntil).toLocaleDateString() : "—"}</span></div>
                <div><span className="font-semibold text-slate-600 dark:text-slate-400">Lead Time:</span> <span className="text-slate-800 dark:text-slate-200">{q.revisionModal.data.leadTimeDays ? `${q.revisionModal.data.leadTimeDays} days` : "—"}</span></div>
              </div>
              {(q.revisionModal.data.paymentTerms || q.revisionModal.data.deliveryTerms || q.revisionModal.data.freightTerms) && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-600 dark:text-slate-400">Commercial Terms:</p>
                  {q.revisionModal.data.paymentTerms && <p className="text-slate-700 dark:text-slate-300"><span className="font-medium">Payment:</span> {q.revisionModal.data.paymentTerms}</p>}
                  {q.revisionModal.data.deliveryTerms && <p className="text-slate-700 dark:text-slate-300"><span className="font-medium">Delivery:</span> {q.revisionModal.data.deliveryTerms}</p>}
                  {q.revisionModal.data.freightTerms && <p className="text-slate-700 dark:text-slate-300"><span className="font-medium">Freight:</span> {q.revisionModal.data.freightTerms}</p>}
                </div>
              )}
              {q.revisionModal.data.items?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-400 mb-2">Line Items:</p>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-1.5 font-semibold text-slate-600 dark:text-slate-400">Description</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 dark:text-slate-400 text-right">Qty</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 dark:text-slate-400 text-right">Price</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 dark:text-slate-400 text-center">Disc%</th>
                        <th className="px-3 py-1.5 font-semibold text-slate-600 dark:text-slate-400 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.revisionModal.data.items.map((it: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{it.description}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{it.quantity}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">₹{it.unitPrice?.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-center text-slate-600 dark:text-slate-400">{it.discountPercent || 0}%</td>
                          <td className="px-3 py-1.5 text-right font-medium text-slate-800 dark:text-slate-200">₹{it.lineTotal?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {q.revisionModal.data.termsAndConditions && (
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-400 mb-1">Terms & Conditions:</p>
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-3 leading-relaxed">{q.revisionModal.data.termsAndConditions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
