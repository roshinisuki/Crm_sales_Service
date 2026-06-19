"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createFollowUpAction } from "@/app/actions/followUps";
import { getLeadByIdAction } from "@/app/actions/leads";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { SuccessOverlay, SuccessAction } from "@/components/SuccessOverlay";
import { ArrowLeft, Save, CalendarClock, User } from "lucide-react";
import Link from "next/link";

function FollowUpNewPageInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const urlLeadId = searchParams.get("leadId") || "";
  const urlDealId = searchParams.get("dealId") || "";

  const [saving, setSaving] = useState(false);
  const [linkedLead, setLinkedLead] = useState<any>(null);
  const [executives, setExecutives] = useState<any[]>([]);

  // Success overlay
  const [overlay, setOverlay] = useState<{ open: boolean; message: string; primary: SuccessAction; secondary?: SuccessAction; alternate?: SuccessAction }>({
    open: false, message: "", primary: { label: "", href: "" },
  });

  // Form state
  const [form, setForm] = useState({
    assignedUserId: "",
    nextMeetingDate: "",
    priority: "Medium" as "High" | "Medium" | "Low",
    followUpType: "Call" as "Call" | "Meeting" | "Note",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load linked lead + executives
  useEffect(() => {
    if (urlLeadId) {
      getLeadByIdAction(urlLeadId).then(res => {
        if (res.success && res.data) {
          setLinkedLead(res.data);
          // Pre-fill assigned user with lead owner
          if (res.data.assignedUserId) {
            setForm(f => ({ ...f, assignedUserId: res.data.assignedUserId as string }));
          }
        }
      });
    }
    if (user && (user.role === "Admin" || user.role === "SalesManager")) {
      getUsersAction().then(res => {
        if (res.success && res.data) {
          setExecutives((res.data as any[]).filter(
            (u: any) => u.role === "SalesExecutive" || u.role === "SalesManager"
          ));
        }
      });
    }
  }, [urlLeadId, user]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.assignedUserId) e.assignedUserId = "Assigned To is required";
    if (!form.nextMeetingDate) e.nextMeetingDate = "Follow-up date is required";
    else {
      const selected = new Date(form.nextMeetingDate);
      const now = new Date();
      if (selected < now) e.nextMeetingDate = "Date must be today or later";
    }
    if (!form.priority) e.priority = "Priority is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the validation errors.");
      return;
    }
    setSaving(true);
    try {
      const res = await createFollowUpAction({
        leadId: urlLeadId || undefined,
        customerId: undefined,
        nextMeetingDate: form.nextMeetingDate,
        remarks: `${form.followUpType}: ${form.notes}`.trim(),
        notes: form.notes || null,
        priority: form.priority,
        assignedUserId: form.assignedUserId || undefined,
        sourceType: "MANUAL",
        type: form.followUpType,
      });

      if (res.success) {
        toast.success("Follow-up scheduled! Log the activity now.");

        const leadId = urlLeadId;
        const newFollowUpId = res.data?.id || "";
        const dateStr = new Date(form.nextMeetingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

        // MANDATORY: redirect to activity form to log the actual interaction
        setOverlay({
          open: true,
          message: `Follow-up scheduled for ${dateStr}, Priority: ${form.priority}. Now log the ${form.followUpType} activity.`,
          primary: { label: `Log ${form.followUpType} Activity`, href: `/activities/new?type=${form.followUpType.toLowerCase()}&leadId=${leadId}&followUpId=${newFollowUpId}`, icon: <CalendarClock size={16} /> },
          secondary: { label: "View Pending Follow-Ups", href: "/follow-up?status=Pending" },
          alternate: { label: "Back to Lead", href: `/leads/${leadId}` },
        });
      } else {
        toast.error(res.message || "Failed to create follow-up");
        setSaving(false);
      }
    } catch {
      toast.error("An error occurred");
      setSaving(false);
    }
  };

  return (
    <PageShell title="Create Follow-Up" subtitle="Schedule a call, meeting, or demo follow-up."
      action={
        <Link href="/follow-up" className="btn-secondary text-xs flex items-center gap-2">
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto">
        <div className="crm-card bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          {/* Auto-filled linked entity */}
          {linkedLead && (
            <FormField label="Linked Lead (auto-filled)">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <User size={14} className="text-slate-400" />
                <span className="font-semibold text-slate-700">{linkedLead.name}</span>
                {linkedLead.companyName && <span className="text-xs text-slate-400">— {linkedLead.companyName}</span>}
              </div>
            </FormField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Assigned To" required>
              {user?.role === "SalesExecutive" ? (
                <Input value={user.name || "You (default)"} disabled className="bg-slate-50 text-slate-500" />
              ) : (
                <Select value={form.assignedUserId} onChange={e => setForm(f => ({ ...f, assignedUserId: e.target.value }))}>
                  <option value="">Select user...</option>
                  {executives.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name} — {ex.role}</option>
                  ))}
                </Select>
              )}
              {errors.assignedUserId && <p className="text-xs text-red-500 mt-1">{errors.assignedUserId}</p>}
            </FormField>

            <FormField label="Follow-Up Date & Time" required>
              <Input type="datetime-local" value={form.nextMeetingDate} onChange={e => setForm(f => ({ ...f, nextMeetingDate: e.target.value }))} />
              {errors.nextMeetingDate && <p className="text-xs text-red-500 mt-1">{errors.nextMeetingDate}</p>}
            </FormField>

            <FormField label="Priority" required>
              <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}>
                <option value="High">🔴 High</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🟢 Low</option>
              </Select>
              {errors.priority && <p className="text-xs text-red-500 mt-1">{errors.priority}</p>}
            </FormField>

            <FormField label="Follow-Up Type">
              <Select value={form.followUpType} onChange={e => setForm(f => ({ ...f, followUpType: e.target.value as any }))}>
                <option value="Call">Call</option>
                <option value="Meeting">Meeting</option>
                <option value="Note">Note</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Call me next Monday"
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/follow-up" className="btn-secondary text-sm">Cancel</Link>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving ? "Saving…" : <><Save size={14} /> Create Follow-Up</>}
            </button>
          </div>
        </div>
      </div>

      <SuccessOverlay
        open={overlay.open}
        message={overlay.message}
        primary={overlay.primary}
        secondary={overlay.secondary}
        alternate={overlay.alternate}
        onClose={() => setOverlay(o => ({ ...o, open: false }))}
      />
    </PageShell>
  );
}

export default function FollowUpNewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading...</div>}>
      <FollowUpNewPageInner />
    </Suspense>
  );
}
