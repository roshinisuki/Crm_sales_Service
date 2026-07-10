"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import {
  listCompetitorInvolvements,
  createCompetitorInvolvement,
  updateCompetitorInvolvement,
  deleteCompetitorInvolvement,
  getCompetitorsList,
  getLossReasonsList,
  type CompetitorInvolvementInput,
} from "@/app/actions/competitorInvolvement";
import { Plus, Trash2, Pencil, Eye, EyeOff, AlertTriangle } from "lucide-react";

const STAGES = ["New Lead", "SQL", "Qualified", "Requirement Gathering", "Technical Discussion", "RFQ", "Quotation", "Negotiation", "Deal"];
const DISCOVERY_CHANNELS = ["Call", "Meeting", "WhatsApp", "Email", "Form"];
const COMPETITOR_STATUSES = ["Current Provider", "Evaluating", "Shortlisted"];
const THREAT_LEVELS = ["Low", "Medium", "High"];
const DISCOUNT_STATUS = ["Pending", "Approved", "Rejected"];
const FINAL_RESULTS = ["Open", "Won", "Lost"];

type EntityContext = {
  leadId?: string;
  dealId?: string;
  customerId?: string;
  rfqId?: string;
  quotationId?: string;
  negotiationId?: string;
  currentStage: string;
};

const STAGE_GROUPS: Record<string, string[]> = {
  "Early Discovery": ["currentVendor", "customerPainPoint", "customerPreference", "requiredFeatures"],
  "Technical Comparison": ["competitorStrengths", "competitorWeaknesses", "ourAdvantages", "ourGaps", "technicalComparisonNotes", "demoFeedback"],
  "Commercial Competition": ["competitorQuotedPrice", "ourQuotedPrice", "commercialTermsComparison", "paymentTermsComparison", "deliveryComparison", "negotiationActionPlan", "discountRequestedDueToComp", "expectedCompetitorDiscount", "discountApprovalStatus"],
  "Final Outcome": ["finalResult", "selectedCompetitorId", "winLossReasonId", "secondaryReason", "correctiveAction", "managerReviewNotes"],
};

function getStageGroup(stage: string): string {
  if (["New Lead", "SQL", "Qualified"].includes(stage)) return "Early Discovery";
  if (["Requirement Gathering", "Technical Discussion"].includes(stage)) return "Technical Comparison";
  if (["RFQ", "Quotation", "Negotiation"].includes(stage)) return "Commercial Competition";
  if (stage === "Deal") return "Final Outcome";
  return "Early Discovery";
}

const emptyForm: CompetitorInvolvementInput = {
  competitorId: "",
  competitorProductId: null,
  discoveredAtStage: "New Lead",
  discoveredThrough: "Call",
  competitorStatus: "Evaluating",
  threatLevel: "Medium",
  discountRequestedDueToComp: false,
  finalResult: "Open",
};

export function CompetitorIntelligenceTab({ entity }: { entity: EntityContext }) {
  const { user } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompetitorInvolvementInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentGroup = getStageGroup(entity.currentStage);
  const canApproveDiscount = ["SalesManager", "Admin", "SuperAdmin"].includes(user?.role || "");

  const load = useCallback(async () => {
    setLoading(true);
    const [ciRes, compRes, lrRes] = await Promise.all([
      listCompetitorInvolvements(entity),
      getCompetitorsList(),
      getLossReasonsList(),
    ]);
    if (ciRes.success && ciRes.data) setRecords(ciRes.data);
    if (compRes.success && compRes.data) setCompetitors(compRes.data);
    if (lrRes.success && lrRes.data) setLossReasons(lrRes.data);
    setLoading(false);
  }, [entity.leadId, entity.dealId, entity.customerId, entity.rfqId, entity.quotationId, entity.negotiationId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ ...emptyForm, ...entity });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (r: any) => {
    setForm({
      competitorId: r.competitorId,
      competitorProductId: r.competitorProductId || null,
      discoveredAtStage: r.discoveredAtStage,
      discoveredThrough: r.discoveredThrough,
      competitorStatus: r.competitorStatus,
      threatLevel: r.threatLevel,
      currentVendor: r.currentVendor || null,
      customerPainPoint: r.customerPainPoint || null,
      customerPreference: r.customerPreference || null,
      requiredFeatures: r.requiredFeatures || null,
      competitorStrengths: r.competitorStrengths || null,
      competitorWeaknesses: r.competitorWeaknesses || null,
      ourAdvantages: r.ourAdvantages || null,
      ourGaps: r.ourGaps || null,
      technicalComparisonNotes: r.technicalComparisonNotes || null,
      demoFeedback: r.demoFeedback || null,
      competitorQuotedPrice: r.competitorQuotedPrice || null,
      ourQuotedPrice: r.ourQuotedPrice || null,
      commercialTermsComparison: r.commercialTermsComparison || null,
      paymentTermsComparison: r.paymentTermsComparison || null,
      deliveryComparison: r.deliveryComparison || null,
      negotiationActionPlan: r.negotiationActionPlan || null,
      discountRequestedDueToComp: r.discountRequestedDueToComp || false,
      expectedCompetitorDiscount: r.expectedCompetitorDiscount || null,
      discountApprovalStatus: r.discountApprovalStatus || null,
      finalResult: r.finalResult || "Open",
      selectedCompetitorId: r.selectedCompetitorId || null,
      winLossReasonId: r.winLossReasonId || null,
      secondaryReason: r.secondaryReason || null,
      correctiveAction: r.correctiveAction || null,
      managerReviewNotes: r.managerReviewNotes || null,
    });
    setEditingId(r.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.competitorId) { toast.error("Please select a competitor."); return; }
    setSaving(true);
    const data = { ...form, ...entity };
    let res;
    if (editingId) {
      res = await updateCompetitorInvolvement(editingId, data);
    } else {
      res = await createCompetitorInvolvement(data);
    }
    if (res.success) {
      toast.success(editingId ? "Updated." : "Competitor involvement added.");
      setShowModal(false);
      load();
    } else {
      toast.error(res.message || "Failed to save.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this competitor involvement record?")) return;
    const res = await deleteCompetitorInvolvement(id);
    if (res.success) { toast.success("Deleted."); load(); }
    else { toast.error("Failed to delete."); }
  };

  const handleDiscountApprove = async (id: string, status: string) => {
    if (status === "Approved" && !canApproveDiscount) {
      toast.error("Only Sales Manager or Admin can approve.");
      return;
    }
    const res = await updateCompetitorInvolvement(id, { discountApprovalStatus: status });
    if (res.success) { toast.success("Discount " + status + "."); load(); }
    else { toast.error(res.message || "Failed."); }
  };

  const visibleGroups = showAllGroups ? Object.keys(STAGE_GROUPS) : [currentGroup];

  const renderField = (key: string, label: string, type: "text" | "number" | "textarea" | "select" | "checkbox", options?: string[]) => {
    const value = (form as any)[key];
    if (type === "checkbox") {
      return (
        <FormField label={label}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!value} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))} className="w-4 h-4 rounded" />
            <span className="text-xs">Yes</span>
          </label>
        </FormField>
      );
    }
    if (type === "select") {
      return (
        <FormField label={label}>
          <Select value={value || ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value || null }))}>
            <option value="">—</option>
            {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
        </FormField>
      );
    }
    if (type === "textarea") {
      return (
        <FormField label={label}>
          <Textarea rows={2} value={value || ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value || null }))} />
        </FormField>
      );
    }
    return (
      <FormField label={label}>
        <Input type={type === "number" ? "number" : "text"} value={value ?? ""} onChange={e => setForm(p => ({ ...p, [key]: type === "number" ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value || null }))} />
      </FormField>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-theme-primary">Competitor Intelligence</h3>
          <p className="text-xs text-theme-muted mt-0.5">Track competitors involved in this deal cycle</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAllGroups(v => !v)} className="btn-ghost text-xs flex items-center gap-1">
            {showAllGroups ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAllGroups ? "Show relevant only" : "Show all fields"}
          </button>
          <button onClick={openCreate} className="btn-primary text-xs flex items-center gap-1">
            <Plus size={14} /> Add Competitor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-theme-muted">Loading...</div>
      ) : records.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-theme-muted">No competitor involvement records yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="crm-card p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{r.competitor?.name || "—"}</p>
                    {r.competitorProduct && <p className="text-[11px] text-theme-muted">{r.competitorProduct.name}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={"px-2 py-0.5 rounded-full text-[10px] font-bold " + (
                      r.threatLevel === "High" ? "bg-red-50 text-red-700 border border-red-200" :
                      r.threatLevel === "Medium" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    )}>{r.threatLevel}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">{r.competitorStatus}</span>
                    {r.finalResult && r.finalResult !== "Open" && (
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-bold " + (
                        r.finalResult === "Won" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        "bg-red-50 text-red-700 border border-red-200"
                      )}>{r.finalResult}</span>
                    )}
                    {r.discountRequestedDueToComp && r.discountApprovalStatus === "Pending" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <AlertTriangle size={10} /> Discount Pending
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} className="row-action-btn" title="Toggle details">
                    {expandedId === r.id ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => openEdit(r)} className="row-action-btn" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="row-action-btn row-action-btn-danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedId === r.id && (
                <div className="mt-3 pt-3 border-t border-theme grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                  {r.currentVendor && <div><span className="text-theme-muted">Current Vendor:</span> <span className="text-theme-secondary">{r.currentVendor}</span></div>}
                  {r.customerPainPoint && <div><span className="text-theme-muted">Pain Point:</span> <span className="text-theme-secondary">{r.customerPainPoint}</span></div>}
                  {r.competitorQuotedPrice != null && <div><span className="text-theme-muted">Competitor Price:</span> <span className="text-theme-secondary">Rs.{r.competitorQuotedPrice}</span></div>}
                  {r.ourQuotedPrice != null && <div><span className="text-theme-muted">Our Price:</span> <span className="text-theme-secondary">Rs.{r.ourQuotedPrice}</span></div>}
                  {r.competitorStrengths && <div><span className="text-theme-muted">Strengths:</span> <span className="text-theme-secondary">{r.competitorStrengths}</span></div>}
                  {r.competitorWeaknesses && <div><span className="text-theme-muted">Weaknesses:</span> <span className="text-theme-secondary">{r.competitorWeaknesses}</span></div>}
                  {r.ourAdvantages && <div><span className="text-theme-muted">Our Advantages:</span> <span className="text-theme-secondary">{r.ourAdvantages}</span></div>}
                  {r.ourGaps && <div><span className="text-theme-muted">Our Gaps:</span> <span className="text-theme-secondary">{r.ourGaps}</span></div>}
                  {r.discountRequestedDueToComp && (
                    <div className="col-span-2 md:col-span-3">
                      <span className="text-theme-muted">Discount Approval:</span>
                      <span className="ml-2 text-theme-secondary">{r.discountApprovalStatus || "Pending"}</span>
                      {r.discountApprovalStatus === "Pending" && canApproveDiscount && (
                        <>
                          <button onClick={() => handleDiscountApprove(r.id, "Approved")} className="ml-2 text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white">Approve</button>
                          <button onClick={() => handleDiscountApprove(r.id, "Rejected")} className="ml-1 text-[10px] px-2 py-0.5 rounded bg-red-600 text-white">Reject</button>
                        </>
                      )}
                    </div>
                  )}
                  {r.finalResult && r.finalResult !== "Open" && (
                    <div className="col-span-2 md:col-span-3">
                      <span className="text-theme-muted">Result:</span>
                      <span className="ml-2 text-theme-secondary">{r.finalResult}</span>
                      {r.winLossReason && <span className="ml-2 text-theme-muted">({r.winLossReason.name})</span>}
                      {r.correctiveAction && <div className="mt-1"><span className="text-theme-muted">Corrective Action:</span> <span className="text-theme-secondary">{r.correctiveAction}</span></div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="crm-card border-2 border-[var(--primary)]/20 p-5 mt-4 bg-[var(--surface-2)]">
          <div className="mb-4 pb-3 border-b border-border">
            <h3 className="text-[15px] font-bold text-text-primary">
              {editingId ? "Edit Competitor Involvement" : "Add Competitor Involvement"}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">Track competitor activity and intelligence</p>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Competitor" required>
                <Select value={form.competitorId} onChange={e => setForm(p => ({ ...p, competitorId: e.target.value }))}>
                  <option value="">Select competitor...</option>
                  {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
  
              <FormField label="Competitor Product">
                <Select value={form.competitorProductId || ""} onChange={e => setForm(p => ({ ...p, competitorProductId: e.target.value || null }))}>
                  <option value="">—</option>
                  {competitors.find(c => c.id === form.competitorId)?.products?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </FormField>
  
              <FormField label="Discovered At Stage" required>
                <Select value={form.discoveredAtStage} onChange={e => setForm(p => ({ ...p, discoveredAtStage: e.target.value }))}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>
  
              <FormField label="Discovered Through" required>
                <Select value={form.discoveredThrough} onChange={e => setForm(p => ({ ...p, discoveredThrough: e.target.value }))}>
                  {DISCOVERY_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
  
              <FormField label="Competitor Status" required>
                <Select value={form.competitorStatus} onChange={e => setForm(p => ({ ...p, competitorStatus: e.target.value }))}>
                  {COMPETITOR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormField>
  
              <FormField label="Threat Level" required>
                <Select value={form.threatLevel} onChange={e => setForm(p => ({ ...p, threatLevel: e.target.value }))}>
                  {THREAT_LEVELS.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </FormField>
            </div>
  
            {visibleGroups.includes("Early Discovery") && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">Early Discovery</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderField("currentVendor", "Current Vendor", "text")}
                  {renderField("customerPainPoint", "Customer Pain Point", "textarea")}
                  {renderField("customerPreference", "Customer Preference", "textarea")}
                  {renderField("requiredFeatures", "Required Features", "textarea")}
                </div>
              </div>
            )}
  
            {visibleGroups.includes("Technical Comparison") && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">Technical Comparison</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderField("competitorStrengths", "Competitor Strengths", "textarea")}
                  {renderField("competitorWeaknesses", "Competitor Weaknesses", "textarea")}
                  {renderField("ourAdvantages", "Our Advantages", "textarea")}
                  {renderField("ourGaps", "Our Gaps", "textarea")}
                  {renderField("technicalComparisonNotes", "Technical Comparison Notes", "textarea")}
                  {renderField("demoFeedback", "Demo Feedback", "textarea")}
                </div>
              </div>
            )}
  
            {visibleGroups.includes("Commercial Competition") && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">Commercial Competition</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderField("competitorQuotedPrice", "Competitor Quoted Price", "number")}
                  {renderField("ourQuotedPrice", "Our Quoted Price", "number")}
                  {renderField("commercialTermsComparison", "Commercial Terms Comparison", "textarea")}
                  {renderField("paymentTermsComparison", "Payment Terms Comparison", "textarea")}
                  {renderField("deliveryComparison", "Delivery Comparison", "textarea")}
                  {renderField("negotiationActionPlan", "Negotiation Action Plan", "textarea")}
                  {renderField("discountRequestedDueToComp", "Discount Requested Due to Competitor", "checkbox")}
                  {renderField("expectedCompetitorDiscount", "Expected Competitor Discount", "number")}
                  <FormField label="Discount Approval Status">
                    <Select value={form.discountApprovalStatus || ""} onChange={e => setForm(p => ({ ...p, discountApprovalStatus: e.target.value || null }))}>
                      <option value="">—</option>
                      {DISCOUNT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </FormField>
                </div>
                {form.discountApprovalStatus === "Approved" && !canApproveDiscount && (
                  <p className="text-[11px] text-amber-600 font-medium">Only Sales Manager or Admin can set status to Approved.</p>
                )}
              </div>
            )}
  
            {visibleGroups.includes("Final Outcome") && (
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">Final Outcome</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Final Result">
                    <Select value={form.finalResult || "Open"} onChange={e => setForm(p => ({ ...p, finalResult: e.target.value }))}>
                      {FINAL_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Selected Competitor">
                    <Select value={form.selectedCompetitorId || ""} onChange={e => setForm(p => ({ ...p, selectedCompetitorId: e.target.value || null }))}>
                      <option value="">—</option>
                      {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Win/Loss Reason">
                    <Select value={form.winLossReasonId || ""} onChange={e => setForm(p => ({ ...p, winLossReasonId: e.target.value || null }))}>
                      <option value="">—</option>
                      {lossReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  </FormField>
                  {renderField("secondaryReason", "Secondary Reason", "text")}
                  {renderField("correctiveAction", "Corrective Action", "textarea")}
                  {renderField("managerReviewNotes", "Manager Review Notes", "textarea")}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-border">
              <button onClick={() => setShowModal(false)} className="btn-secondary text-sm px-4">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-4">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
