"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createTaskAction } from "@/app/actions/tasks";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { SuccessOverlay, SuccessAction } from "@/components/SuccessOverlay";
import { ArrowLeft, Save, CheckSquare, Building2 } from "lucide-react";
import Link from "next/link";

const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

function NewTaskPageInner() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();

  const urlDealId = searchParams.get("dealId") || "";
  const urlLeadId = searchParams.get("leadId") || "";

  const [saving, setSaving] = useState(false);
  const [executives, setExecutives] = useState<any[]>([]);

  // Success overlay
  const [overlay, setOverlay] = useState<{ open: boolean; message: string; primary: SuccessAction; secondary?: SuccessAction; alternate?: SuccessAction }>({
    open: false, message: "", primary: { label: "", href: "" },
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Open",
    priority: "Medium",
    dueDate: "",
    assignedTo: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && (user.role === "Admin" || user.role === "SalesManager")) {
      getUsersAction().then(res => {
        if (res.success && res.data) {
          setExecutives((res.data as any[]).filter(
            (u: any) => u.role === "SalesExecutive" || u.role === "SalesManager"
          ));
        }
      });
    }
  }, [user]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 3) e.title = "Title must be at least 3 characters";
    if (!form.priority) e.priority = "Priority is required";
    if (!form.assignedTo && user?.role !== "SalesExecutive") e.assignedTo = "Assigned To is required";
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
      const res = await createTaskAction({
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        assignedTo: form.assignedTo || null,
      });
      if (res.success) {
        toast.success("Task created successfully!");
        const taskCode = (res.data as any)?.taskCode || "TSK-0001";

        setOverlay({
          open: true,
          message: `Task ${taskCode}: ${form.title} assigned successfully`,
          primary: { label: "View Pending Tasks", href: "/tasks?status=Pending", icon: <CheckSquare size={16} /> },
          secondary: urlDealId
            ? { label: "Back to Opportunity", href: `/sales-pipeline/${urlDealId}` }
            : { label: "View All Tasks", href: "/tasks" },
          alternate: urlLeadId ? { label: "Back to Lead", href: `/leads/${urlLeadId}` } : undefined,
        });
      } else {
        toast.error(res.message || "Failed to create task");
        setSaving(false);
      }
    } catch {
      toast.error("An error occurred");
      setSaving(false);
    }
  };

  return (
    <PageShell title="New Task" subtitle="Create a new task for your team."
      action={
        <Link href="/tasks" className="btn-secondary text-xs flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Tasks
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto">
        <div className="crm-card bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center"><CheckSquare size={20} className="text-[var(--primary)]" /></div>
            <h2 className="text-lg font-semibold text-slate-800">Task Details</h2>
          </div>

          {/* Auto-filled linked entity */}
          {urlDealId && (
            <FormField label="Linked Opportunity (auto-filled)">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <Building2 size={14} className="text-slate-400" />
                <span className="font-semibold text-slate-700">Opportunity ID: {urlDealId}</span>
              </div>
            </FormField>
          )}

          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Prepare Proposal" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </FormField>

          <FormField label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional details..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Priority" required>
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p}</option>))}
              </Select>
              {errors.priority && <p className="text-xs text-red-500 mt-1">{errors.priority}</p>}
            </FormField>
            <FormField label="Due Date">
              <Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </FormField>
            <FormField label="Assigned To" required>
              {user?.role === "SalesExecutive" ? (
                <Input value={user.name || "You (default)"} disabled className="bg-slate-50 text-slate-500" />
              ) : (
                <Select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                  <option value="">Select user...</option>
                  {executives.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name} — {ex.role}</option>
                  ))}
                </Select>
              )}
              {errors.assignedTo && <p className="text-xs text-red-500 mt-1">{errors.assignedTo}</p>}
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="Open">Open</option>
                <option value="InProgress">In Progress</option>
                <option value="Done">Done</option>
              </Select>
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/tasks" className="btn-secondary text-sm">Cancel</Link>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving ? "Saving…" : <><Save size={14} /> Create Task</>}
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

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading...</div>}>
      <NewTaskPageInner />
    </Suspense>
  );
}
