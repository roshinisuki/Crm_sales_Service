"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getDealByIdAction, updateDealStatusAction, saveOpportunityDetailAction } from "@/app/actions/deals";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { NotePanel } from "@/components/ui/NotePanel";
import { formatCurrency, formatDate } from "@/lib/ui-utils";
import { ArrowLeft, CheckCircle, Clock, Save, LayoutTemplate, Briefcase, FileText, Check, AlertTriangle, ChevronRight, CheckSquare, Square, FileUp, Circle } from "lucide-react";

const STAGES = {
  SalesOpportunity: "New Opportunity",
  RequirementGathering: "Requirement Gathering",
  PreSalesReview: "Pre-Sales Review",
  MeetingScheduled: "Meeting Scheduled",
  DemoConducted: "Demo Conducted",
  RejectedDemo: "Rejected Demo",
  ProposalSent: "Proposal Sent",
  ApprovalQueue: "Approval Queue",
  ActiveNegotiation: "Negotiation",
  Won: "Closed Won",
  Lost: "Closed Lost"
};

const MODULES_LIST = ["Leads Management", "Contacts Management", "Sales Pipeline", "Follow-Ups", "Proposal Management", "Reports & Analytics", "Marketing", "Inventory", "Asset Management", "Custom Module"];
const PAIN_POINTS_LIST = ["No CRM System", "Manual Excel Tracking", "Poor Follow-up Tracking", "No Reporting", "No Customer Visibility", "Other"];
const INTEGRATIONS_LIST = ["WhatsApp", "Email", "ERP", "Tally", "SAP", "API Integration", "Other"];
const TIMELINE_OPTIONS = ["Immediate", "1 Month", "3 Months", "6 Months", "Later"];
const BUDGET_OPTIONS = ["< ₹50,000", "₹50,000 - ₹2,00,000", "₹2,00,000 - ₹5,00,000", "₹5,00,000+"];

export default function OpportunityWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const dealId = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Tab State
  const [activeTab, setActiveTab] = useState("customer_info");
  
  // Form State
  const [detailsForm, setDetailsForm] = useState<any>({});
  
  // Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDealByIdAction(dealId);
      if (res.success && res.data) {
        setDeal(res.data);
        setDetailsForm(res.data.opportunityDetail || {});
      } else {
        toast.error("Opportunity not found.");
        router.push("/sales-pipeline");
      }
    } finally {
      setLoading(false);
    }
  }, [dealId, router, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSaveDetails = async (silent = false) => {
    if (!silent) setIsSubmitting(true);
    const res = await saveOpportunityDetailAction(dealId, detailsForm);
    if (!silent) {
      if (res.success) toast.success("Draft saved successfully.");
      else toast.error(res.message);
      setIsSubmitting(false);
      load();
    }
    return res.success;
  };

  const handleAdvanceStage = async (nextStage: string) => {
    setIsSubmitting(true);
    // Save details right before advancing to ensure backend validations pass
    await saveOpportunityDetailAction(dealId, detailsForm);
    
    const res = await updateDealStatusAction(dealId, nextStage);
    if (res.success) {
      toast.success(res.message);
      setShowCompleteModal(false);
      load();
    } else {
      toast.error(res.message);
    }
    setIsSubmitting(false);
  };

  // Checkbox helpers
  const handleCheckboxToggle = (field: string, value: string) => {
    let current = [];
    try { current = detailsForm[field] ? JSON.parse(detailsForm[field]) : []; } catch (e) {}
    if (current.includes(value)) {
      current = current.filter((v: string) => v !== value);
    } else {
      current.push(value);
    }
    setDetailsForm({ ...detailsForm, [field]: JSON.stringify(current) });
  };

  const hasCheckbox = (field: string, value: string) => {
    try {
      const current = detailsForm[field] ? JSON.parse(detailsForm[field]) : [];
      return current.includes(value);
    } catch(e) { return false; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="spinner-brand" />
          <p className="text-sm font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!deal) return null;

  // Validation Check for Modal
  const isBudgetFilled = !!detailsForm.budgetRange;
  const isTimelineFilled = !!detailsForm.timeline;
  const isDecisionMakerFilled = !!detailsForm.decisionMaker;
  const isModulesFilled = (() => { try { return JSON.parse(detailsForm.modulesRequired || "[]").length > 0; } catch { return false; } })();
  const allMandatoryFilled = isBudgetFilled && isTimelineFilled && isDecisionMakerFilled && isModulesFilled;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-20">
      {/* Header Section */}
      <div className="bg-white border-t-4 border-t-indigo-600 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/sales-pipeline")} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 shrink-0">
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">Requirement Gathering</p>
              <h1 className="text-2xl font-extrabold text-slate-900">{deal.dealName}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm font-medium text-slate-600">
                <span>Company: <span className="font-bold text-slate-800">{deal.customer?.name}</span></span>
                <span>• Expected Value: <span className="font-bold text-emerald-600">{formatCurrency(deal.dealValue)}</span></span>
                <span>• Created: <span className="text-slate-500">{formatDate(deal.createdAt)}</span></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {deal.status === "SalesOpportunity" ? (
              <button onClick={() => handleAdvanceStage("RequirementGathering")} disabled={isSubmitting} className="btn-primary text-sm shadow-sm bg-blue-600 hover:bg-blue-700">
                Start Requirement Gathering <ChevronRight size={16} className="ml-1 inline" />
              </button>
            ) : (
              <>
                <button onClick={() => handleSaveDetails(false)} disabled={isSubmitting || deal.status !== "RequirementGathering"} className="btn-secondary text-sm border-slate-200 hover:bg-slate-50 disabled:opacity-50">
                  Save Draft
                </button>
                {deal.status === "RequirementGathering" && (
                  <button onClick={() => setShowCompleteModal(true)} className="btn-primary text-sm shadow-sm bg-indigo-600 hover:bg-indigo-700">
                    Requirements Completed <ChevronRight size={16} className="ml-1 inline" />
                  </button>
                )}
                {deal.status === "PreSalesReview" && (
                  <>
                    <button onClick={() => handleAdvanceStage("RequirementGathering")} disabled={isSubmitting} className="btn-secondary text-sm border-amber-200 text-amber-700 hover:bg-amber-50">
                      Request More Info
                    </button>
                    <button onClick={() => setShowMeetingModal(true)} disabled={isSubmitting} className="btn-primary text-sm shadow-sm bg-teal-600 hover:bg-teal-700">
                      Schedule Customer Meeting <ChevronRight size={16} className="ml-1 inline" />
                    </button>
                  </>
                )}
                {deal.status === "MeetingScheduled" && (
                  <button onClick={() => setShowDemoModal(true)} disabled={isSubmitting} className="btn-primary text-sm shadow-sm bg-purple-600 hover:bg-purple-700">
                    Conduct Demo <ChevronRight size={16} className="ml-1 inline" />
                  </button>
                )}
                {deal.status === "DemoConducted" && (
                  <>
                    <button onClick={() => setShowRejectModal(true)} disabled={isSubmitting} className="btn-secondary text-sm border-rose-200 text-rose-700 hover:bg-rose-50">
                      Reject
                    </button>
                    <button onClick={() => handleAdvanceStage("RequirementGathering")} disabled={isSubmitting} className="btn-secondary text-sm border-amber-200 text-amber-700 hover:bg-amber-50">
                      Rework
                    </button>
                    <button onClick={() => handleAdvanceStage("ProposalSent")} disabled={isSubmitting} className="btn-primary text-sm shadow-sm bg-emerald-600 hover:bg-emerald-700">
                      Accept & Send Proposal <ChevronRight size={16} className="ml-1 inline" />
                    </button>
                  </>
                )}
                {deal.status !== "RequirementGathering" && deal.status !== "PreSalesReview" && deal.status !== "MeetingScheduled" && deal.status !== "DemoConducted" && (
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                    <CheckCircle size={14} /> Stage: {(STAGES as any)[deal.status] || deal.status}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Workspace Column (Left) */}
        <div className="lg:col-span-3">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl overflow-x-auto hide-scrollbar">
            {[
              { id: "customer_info", label: "Customer Info" },
              { id: "business_req", label: "Business Requirements" },
              { id: "tech_req", label: "Technical Requirements" },
              { id: "commercial_info", label: "Commercial Info" },
              { id: "internal_notes", label: "Internal Notes" },
              { id: "presales_review", label: "Pre-Sales Review", reqStatus: ["PreSalesReview", "MeetingScheduled", "DemoConducted", "RejectedDemo", "ProposalSent", "Won"] }
            ]
            .filter(tab => !tab.reqStatus || tab.reqStatus.includes(deal.status))
            .map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)} 
                className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white p-6 rounded-b-xl border border-slate-200 border-t-0 shadow-sm min-h-[500px] relative">
            
            {/* Form Lock Overlay */}
            {deal.status === "SalesOpportunity" && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-b-xl border border-slate-200">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 text-center max-w-sm">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Ready to start?</h3>
                  <p className="text-sm text-slate-500 mb-5">Click "Start Requirement Gathering" above to begin documenting the business requirements.</p>
                  <button onClick={() => handleAdvanceStage("RequirementGathering")} disabled={isSubmitting} className="btn-primary w-full bg-blue-600 hover:bg-blue-700">
                    Start Now
                  </button>
                </div>
              </div>
            )}

            <div className={deal.status !== "RequirementGathering" && deal.status !== "SalesOpportunity" ? "pointer-events-none opacity-80" : ""}>
              {activeTab === "customer_info" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Basic Details</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <FormField label="Company Name"><Input value={deal.customer?.name || ""} disabled className="bg-slate-50" /></FormField>
                    <FormField label="Industry"><Input value={deal.customer?.industry || ""} disabled className="bg-slate-50" /></FormField>
                    <FormField label="Contact Person"><Input value={deal.customer?.contactPerson || ""} disabled className="bg-slate-50" /></FormField>
                    <FormField label="Email"><Input value={deal.customer?.email || ""} disabled className="bg-slate-50" /></FormField>
                    <FormField label="Phone"><Input value={deal.customer?.phone || ""} disabled className="bg-slate-50" /></FormField>
                    <FormField label="Number of Employees"><Input value={deal.customer?.employees || ""} disabled className="bg-slate-50" /></FormField>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Decision Making</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <FormField label="Decision Maker (Name/Title)"><Input value={detailsForm.decisionMaker || ""} onChange={e => setDetailsForm({...detailsForm, decisionMaker: e.target.value})} placeholder="e.g. CEO, MD" /></FormField>
                    <FormField label="Influencer / Evaluator"><Input value={detailsForm.influencer || ""} onChange={e => setDetailsForm({...detailsForm, influencer: e.target.value})} placeholder="e.g. IT Head" /></FormField>
                    <FormField label="Budget Owner"><Input value={detailsForm.budgetOwner || ""} onChange={e => setDetailsForm({...detailsForm, budgetOwner: e.target.value})} placeholder="e.g. CFO" /></FormField>
                    <FormField label="Expected Go-Live Date"><Input type="date" value={detailsForm.expectedGoLive ? detailsForm.expectedGoLive.substring(0,10) : ""} onChange={e => setDetailsForm({...detailsForm, expectedGoLive: e.target.value ? new Date(e.target.value).toISOString() : null})} /></FormField>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "business_req" && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <FormField label="Current Process & Workflow">
                  <Textarea 
                    value={detailsForm.currentChallenges || ""} 
                    onChange={e => setDetailsForm({...detailsForm, currentChallenges: e.target.value})} 
                    rows={4} 
                    placeholder="How does the customer currently manage sales? What software are they using today? What is their workflow?"
                  />
                </FormField>
                
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Pain Points</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {PAIN_POINTS_LIST.map(pp => (
                      <label key={pp} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg border border-transparent hover:border-slate-100">
                        <button type="button" onClick={() => handleCheckboxToggle('painPointsList', pp)} className="text-indigo-600 focus:outline-none">
                          {hasCheckbox('painPointsList', pp) ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                        </button>
                        {pp}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Modules Required <span className="text-rose-500">*</span></h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {MODULES_LIST.map(mod => (
                      <label key={mod} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg border border-transparent hover:border-slate-100">
                        <button type="button" onClick={() => handleCheckboxToggle('modulesRequired', mod)} className="text-indigo-600 focus:outline-none">
                          {hasCheckbox('modulesRequired', mod) ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                        </button>
                        {mod}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tech_req" && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Deployment Type</h3>
                  <div className="flex gap-6">
                    {["Cloud SaaS", "On-Premise"].map(type => (
                      <label key={type} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <button type="button" onClick={() => setDetailsForm({...detailsForm, deploymentType: type})} className="text-indigo-600 focus:outline-none">
                          {detailsForm.deploymentType === type ? <CheckCircle size={18} /> : <Circle size={18} className="text-slate-300" />}
                        </button>
                        {type}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Integrations Required</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {INTEGRATIONS_LIST.map(int => (
                      <label key={int} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-2 rounded-lg border border-transparent hover:border-slate-100">
                        <button type="button" onClick={() => handleCheckboxToggle('integrationsRequired', int)} className="text-indigo-600 focus:outline-none">
                          {hasCheckbox('integrationsRequired', int) ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                        </button>
                        {int}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-3">User Count</h3>
                  <div className="grid grid-cols-3 gap-5">
                    <FormField label="Sales Users"><Input type="number" value={detailsForm.userCountSales || ""} onChange={e => setDetailsForm({...detailsForm, userCountSales: parseInt(e.target.value) || null})} /></FormField>
                    <FormField label="Managers"><Input type="number" value={detailsForm.userCountManagers || ""} onChange={e => setDetailsForm({...detailsForm, userCountManagers: parseInt(e.target.value) || null})} /></FormField>
                    <FormField label="Admins"><Input type="number" value={detailsForm.userCountAdmins || ""} onChange={e => setDetailsForm({...detailsForm, userCountAdmins: parseInt(e.target.value) || null})} /></FormField>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "commercial_info" && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Budget Details <span className="text-rose-500">*</span></h3>
                    <div className="space-y-3">
                      {BUDGET_OPTIONS.map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <button type="button" onClick={() => setDetailsForm({...detailsForm, budgetRange: opt})} className="text-indigo-600 focus:outline-none">
                            {detailsForm.budgetRange === opt ? <CheckCircle size={18} /> : <Circle size={18} className="text-slate-300" />}
                          </button>
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Implementation Timeline <span className="text-rose-500">*</span></h3>
                    <div className="space-y-3">
                      {TIMELINE_OPTIONS.map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <button type="button" onClick={() => setDetailsForm({...detailsForm, timeline: opt})} className="text-indigo-600 focus:outline-none">
                            {detailsForm.timeline === opt ? <CheckCircle size={18} /> : <Circle size={18} className="text-slate-300" />}
                          </button>
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Competitor Information</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <FormField label="Current Vendor"><Input value={detailsForm.currentVendor || ""} onChange={e => setDetailsForm({...detailsForm, currentVendor: e.target.value})} placeholder="e.g. Zoho CRM" /></FormField>
                    <FormField label="Competitors Evaluated"><Input value={detailsForm.competitorsEvaluated || ""} onChange={e => setDetailsForm({...detailsForm, competitorsEvaluated: e.target.value})} placeholder="e.g. Salesforce, HubSpot" /></FormField>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "internal_notes" && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <NotePanel entityType="DEAL" entityId={deal.id} />
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Requirement Attachments</h3>
                  <p className="text-xs text-slate-500 mb-4">Upload BRDs, Screenshots, Existing Process Documents, and Meeting Minutes.</p>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                      <FileUp size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Click to upload documents</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, DOCX, PNG up to 10MB</p>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === "presales_review" && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">Customer Requirement Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Budget</p><p className="font-semibold text-slate-700">{detailsForm.budgetRange || "N/A"}</p></div>
                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Timeline</p><p className="font-semibold text-slate-700">{detailsForm.timeline || "N/A"}</p></div>
                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Decision Maker</p><p className="font-semibold text-slate-700">{detailsForm.decisionMaker || "N/A"}</p></div>
                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Sales Users</p><p className="font-semibold text-slate-700">{detailsForm.userCountSales || "0"}</p></div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Solution Review</h3>
                  <div className="space-y-5">
                    <FormField label="Proposed Solution (Architecture, Modules, Scope)">
                      <Textarea value={detailsForm.proposedSolution || ""} onChange={e => setDetailsForm({...detailsForm, proposedSolution: e.target.value})} rows={4} placeholder="e.g. CRM Module with Lead Management, Custom Follow-ups..." />
                    </FormField>
                    
                    <div className="grid grid-cols-2 gap-5">
                      <FormField label="Scope Classification">
                        <Select value={detailsForm.scopeClassification || ""} onChange={e => setDetailsForm({...detailsForm, scopeClassification: e.target.value})}>
                          <option value="">Select...</option>
                          <option value="Standard Product Fit">Standard Product Fit</option>
                          <option value="Minor Customization Required">Minor Customization Required</option>
                          <option value="Major Customization Required">Major Customization Required</option>
                          <option value="Custom Development Required">Custom Development Required</option>
                        </Select>
                      </FormField>
                      <FormField label="Estimated Duration"><Input value={detailsForm.estimatedDuration || ""} onChange={e => setDetailsForm({...detailsForm, estimatedDuration: e.target.value})} placeholder="e.g. 4 Weeks" /></FormField>
                      <FormField label="Development Effort"><Input value={detailsForm.developmentEffort || ""} onChange={e => setDetailsForm({...detailsForm, developmentEffort: e.target.value})} placeholder="e.g. 80 Hours" /></FormField>
                      <FormField label="Implementation & Training"><Input value={detailsForm.implementationEffort || ""} onChange={e => setDetailsForm({...detailsForm, implementationEffort: e.target.value})} placeholder="e.g. 40 Hours" /></FormField>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            </div>
          </div>
        </div>

        {/* Right Sidebar (Sticky) */}
        <div className="lg:col-span-1 space-y-5 relative">
          <div className="sticky top-6 space-y-5">
            
            {/* Deal Summary */}
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Deal Summary</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deal Value</p>
                  <p className="text-lg font-black text-indigo-700">{formatCurrency(deal.dealValue)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Probability</p>
                    <p className="text-sm font-bold text-slate-700">60%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Expected Close</p>
                    <p className="text-sm font-bold text-slate-700">{deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "TBD"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Rep</p>
                  <p className="text-sm font-medium text-slate-700">{deal.assignedUser?.name || "Unassigned"}</p>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Progress</h3>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:w-[2px] before:bg-slate-100">
                {[
                  { key: "SalesOpportunity", label: "Opportunity Created", done: true },
                  { key: "RequirementGathering", label: "Requirement Gathering", active: deal.status === "RequirementGathering", done: deal.status !== "RequirementGathering" && deal.status !== "SalesOpportunity" },
                  { key: "PreSalesReview", label: "Pre-Sales Review", active: deal.status === "PreSalesReview", done: ["MeetingScheduled","DemoConducted","ProposalSent","Won"].includes(deal.status) },
                  { key: "MeetingScheduled", label: "Meeting Scheduled", active: deal.status === "MeetingScheduled", done: ["DemoConducted","ProposalSent","Won"].includes(deal.status) },
                  { key: "DemoConducted", label: "Demo Conducted", active: deal.status === "DemoConducted", done: ["ProposalSent","Won"].includes(deal.status) },
                  { key: "ProposalSent", label: "Proposal Sent", active: deal.status === "ProposalSent", done: ["Won"].includes(deal.status) }
                ].map((step, i) => (
                  <div key={step.key} className="relative flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${step.done ? "bg-emerald-500 text-white" : step.active ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-50" : "bg-slate-200 text-slate-400"}`}>
                      {step.done ? <Check size={12} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                    </div>
                    <span className={`text-sm ${step.done ? "text-slate-600 font-medium" : step.active ? "text-indigo-800 font-bold" : "text-slate-400 font-medium"}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="crm-card p-5">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <button className="text-left px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors">
                  + Add Note
                </button>
                <button className="text-left px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors">
                  + Upload Document
                </button>
                <button onClick={() => handleAdvanceStage("Lost")} className="text-left px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mt-2">
                  Mark as Lost
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Completion Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <LayoutTemplate size={24} />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">Have all customer requirements been captured?</h2>
              <p className="text-sm text-slate-500 mt-2">Ensure all mandatory discovery fields are collected before sending to the Solutions Team.</p>
            </div>
            
            <div className="p-6 bg-slate-50 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Required Checklist</p>
              
              <div className="flex items-center gap-3">
                {isBudgetFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isBudgetFilled ? "text-slate-700" : "text-amber-700"}`}>Budget Details</span>
              </div>
              <div className="flex items-center gap-3">
                {isTimelineFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isTimelineFilled ? "text-slate-700" : "text-amber-700"}`}>Implementation Timeline</span>
              </div>
              <div className="flex items-center gap-3">
                {isDecisionMakerFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isDecisionMakerFilled ? "text-slate-700" : "text-amber-700"}`}>Decision Maker Identified</span>
              </div>
              <div className="flex items-center gap-3">
                {isModulesFilled ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
                <span className={`text-sm font-medium ${isModulesFilled ? "text-slate-700" : "text-amber-700"}`}>Required Modules Selected</span>
              </div>
            </div>

            <div className="p-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">
                Review Again
              </button>
              <button 
                onClick={() => handleAdvanceStage("PreSalesReview")}
                disabled={!allMandatoryFilled || isSubmitting} 
                className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? <span className="spinner-white w-4 h-4" /> : null}
                Move to Pre-Sales Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-teal-50">
              <h2 className="text-lg font-extrabold text-teal-900">Schedule Customer Meeting</h2>
              <p className="text-xs text-teal-600 mt-1">Book the pre-sales demo or technical discussion.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Meeting Date & Time">
                  <Input type="datetime-local" value={detailsForm.meetingDate ? detailsForm.meetingDate.substring(0,16) : ""} onChange={e => setDetailsForm({...detailsForm, meetingDate: e.target.value ? new Date(e.target.value).toISOString() : null})} />
                </FormField>
                <FormField label="Meeting Mode">
                  <Select value={detailsForm.meetingMode || ""} onChange={e => setDetailsForm({...detailsForm, meetingMode: e.target.value})}>
                    <option value="">Select...</option>
                    <option value="Online (Zoom/Meet)">Online (Zoom/Meet)</option>
                    <option value="Offline (At Customer Site)">Offline (At Customer Site)</option>
                    <option value="Offline (At Our Office)">Offline (At Our Office)</option>
                  </Select>
                </FormField>
                <FormField label="Participants" className="col-span-2">
                  <Input value={detailsForm.meetingParticipants || ""} onChange={e => setDetailsForm({...detailsForm, meetingParticipants: e.target.value})} placeholder="e.g. John (Customer), Sarah (Pre-Sales)" />
                </FormField>
                <FormField label="Agenda" className="col-span-2">
                  <Textarea value={detailsForm.meetingAgenda || ""} onChange={e => setDetailsForm({...detailsForm, meetingAgenda: e.target.value})} rows={3} placeholder="What will be discussed/shown?" />
                </FormField>
              </div>
            </div>

            <div className="p-4 flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setShowMeetingModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button 
                onClick={() => handleAdvanceStage("MeetingScheduled")}
                disabled={!detailsForm.meetingDate || !detailsForm.meetingMode || !detailsForm.meetingParticipants || !detailsForm.meetingAgenda || isSubmitting} 
                className="px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? <span className="spinner-white w-4 h-4" /> : null}
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conduct Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-purple-50">
              <h2 className="text-lg font-extrabold text-purple-900">Conduct Demo</h2>
              <p className="text-xs text-purple-600 mt-1">Record the outcome of the customer meeting.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <FormField label="Meeting Status">
                <Select value={detailsForm.meetingStatus || ""} onChange={e => setDetailsForm({...detailsForm, meetingStatus: e.target.value})}>
                  <option value="">Select...</option>
                  <option value="Completed">Completed</option>
                  <option value="No Show">No Show</option>
                  <option value="Rescheduled">Rescheduled</option>
                </Select>
              </FormField>
              <FormField label="Meeting Outcome Notes (Mandatory)">
                <Textarea value={detailsForm.meetingOutcome || ""} onChange={e => setDetailsForm({...detailsForm, meetingOutcome: e.target.value})} rows={4} placeholder="How did the demo go? What was the customer's feedback?" />
              </FormField>
            </div>

            <div className="p-4 flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setShowDemoModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button 
                onClick={() => handleAdvanceStage("DemoConducted")}
                disabled={detailsForm.meetingStatus !== "Completed" || !detailsForm.meetingOutcome || isSubmitting} 
                className="px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? <span className="spinner-white w-4 h-4" /> : null}
                Save Outcome & Advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Demo Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-rose-50">
              <h2 className="text-lg font-extrabold text-rose-900">Reject Opportunity</h2>
              <p className="text-xs text-rose-600 mt-1">Mark the demo as rejected and provide a reason.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <FormField label="Rejection Reason">
                <Select value={detailsForm.demoRejectionReason || ""} onChange={e => setDetailsForm({...detailsForm, demoRejectionReason: e.target.value})}>
                  <option value="">Select...</option>
                  <option value="Budget Issue">Budget Issue</option>
                  <option value="Requirement Mismatch">Requirement Mismatch</option>
                  <option value="Competitor Selected">Competitor Selected</option>
                  <option value="Missing Features">Missing Features</option>
                  <option value="Internal Hold">Internal Hold</option>
                  <option value="Other">Other</option>
                </Select>
              </FormField>
              <FormField label="Remarks (Mandatory)">
                <Textarea value={detailsForm.demoRejectionRemarks || ""} onChange={e => setDetailsForm({...detailsForm, demoRejectionRemarks: e.target.value})} rows={3} placeholder="Please provide more details on why it was rejected..." />
              </FormField>
            </div>

            <div className="p-4 flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button 
                onClick={() => handleAdvanceStage("RejectedDemo")}
                disabled={!detailsForm.demoRejectionReason || !detailsForm.demoRejectionRemarks || isSubmitting} 
                className="px-5 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? <span className="spinner-white w-4 h-4" /> : null}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
