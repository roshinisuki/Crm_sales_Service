"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "@/app/actions/tasks";
import { getContactsAction } from "@/app/actions/contacts";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { ArrowLeft, Save, CheckSquare } from "lucide-react";
import Link from "next/link";

const TASK_STATUSES = ["Open", "InProgress", "Done", "Overdue", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export default function NewTaskPage() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Open",
    priority: "Medium",
    dueDate: "",
    contactId: "",
  });

  const loadContacts = async () => {
    const res = await getContactsAction();
    if (res.success && res.data) setContacts(res.data);
  };

  useState(() => { loadContacts(); });

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const res = await createTaskAction({
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        contactId: form.contactId || null,
      });
      if (res.success) {
        toast.success("Task created");
        router.push("/tasks");
      } else {
        toast.error(res.message || "Failed to create task");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
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

          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Follow up with Acme Corp" />
          </FormField>

          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional details..." rows={3} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {TASK_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{p}</option>))}
              </Select>
            </FormField>
            <FormField label="Due Date">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </FormField>
            <FormField label="Linked Contact">
              <Select value={form.contactId} onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}>
                <option value="">— None —</option>
                {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>))}
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
    </PageShell>
  );
}
