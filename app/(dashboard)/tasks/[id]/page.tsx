"use client";
import { CRMSpinner } from "@/components/CRMSpinner";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getTaskByIdAction, updateTaskAction } from "@/app/actions/tasks";
import { getContactsAction } from "@/app/actions/contacts";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { formatDate, cn } from "@/lib/ui-utils";
import { ArrowLeft, CheckSquare, Save, Pencil, X, Check, CalendarClock, Tag, User2, Clock } from "lucide-react";

const TASK_STATUSES = ["Open", "InProgress", "Done", "Overdue", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTaskByIdAction(id);
      if (res.success && res.data) {
        setTask(res.data);
        setForm({
          title: res.data.title,
          description: res.data.description ?? "",
          status: res.data.status,
          priority: res.data.priority,
          dueDate: res.data.dueDate ? new Date(res.data.dueDate).toISOString().slice(0, 10) : "",
          contactId: res.data.contactId ?? "",
        });
      } else {
        toast.error("Task not found.");
        router.push("/tasks");
      }
    } finally { setLoading(false); }
  }, [id, router, toast]);

  useEffect(() => { load(); }, [load]);

  const loadContacts = async () => {
    const res = await getContactsAction();
    if (res.success && res.data) setContacts(res.data);
  };
  useEffect(() => { loadContacts(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateTaskAction(id, {
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        contactId: form.contactId || null,
      });
      if (res.success) {
        toast.success("Task updated");
        setEditing(false);
        load();
      } else {
        toast.error(res.message || "Update failed");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><CRMSpinner size={40} label="Loading task..." /></div>
    );
  }

  if (!task) return null;

  const isOverdue = task.status === "Overdue" || (task.dueDate && task.status !== "Done" && task.status !== "Cancelled" && new Date(task.dueDate) < new Date());

  return (
    <div className="page-shell max-w-3xl mx-auto">
      <button onClick={() => router.push("/tasks")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors mb-4">
        <ArrowLeft size={16} /> Back to Tasks
      </button>

      <div className="crm-card p-6 border-t-4 border-t-[var(--primary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
              <CheckSquare size={20} className="text-[var(--primary)]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{task.title}</h1>
              <p className="text-xs text-slate-400">{task.taskCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Pencil size={13} /> Edit</button>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="btn-secondary text-xs flex items-center gap-1.5"><X size={13} /> Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5"><Save size={13} /> {saving ? "Savingâ€¦" : "Save"}</button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {!editing ? (
            <dl className="space-y-3">
              {[
                { label: "Title", value: task.title },
                { label: "Description", value: task.description || "â€”" },
                { label: "Priority", value: <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full", task.priority === "Low" ? "bg-slate-100 text-slate-500" : task.priority === "Medium" ? "bg-blue-50 text-blue-600" : task.priority === "High" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600")}><Tag size={10} /> {task.priority}</span> },
                { label: "Due Date", value: task.dueDate ? <div className={cn("flex items-center gap-1.5 text-xs", isOverdue ? "text-red-500" : "text-slate-500")}><CalendarClock size={12} /> {formatDate(task.dueDate)} {isOverdue && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-bold">Overdue</span>}</div> : "â€”" },
                { label: "Assigned To", value: <div className="flex items-center gap-1.5 text-xs text-slate-500"><User2 size={12} /> {task.User?.name || "â€”"}</div> },
                { label: "Linked Contact", value: task.Contact ? <div className="flex items-center gap-1.5 text-xs text-slate-500"><User2 size={12} /> {task.Contact.name}</div> : "â€”" },
                { label: "Status", value: <StatusBadge status={task.status} size="sm" /> },
                { label: "Created", value: formatDate(task.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <dt className="text-xs font-semibold text-slate-400 shrink-0">{label}</dt>
                  <dd className="text-xs font-semibold text-slate-700 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="space-y-4">
              <FormField label="Title" required><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} /></FormField>
              <FormField label="Description"><Textarea value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={3} /></FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Status">
                  <Select value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    {TASK_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </Select>
                </FormField>
                <FormField label="Priority">
                  <Select value={form.priority} onChange={(e) => setForm((f: any) => ({ ...f, priority: e.target.value }))}>
                    {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </Select>
                </FormField>
                <FormField label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f: any) => ({ ...f, dueDate: e.target.value }))} /></FormField>
                <FormField label="Linked Contact">
                  <Select value={form.contactId} onChange={(e) => setForm((f: any) => ({ ...f, contactId: e.target.value }))}>
                    <option value="">â€” None â€”</option>
                    {contacts.map((c: any) => (<option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>))}
                  </Select>
                </FormField>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

