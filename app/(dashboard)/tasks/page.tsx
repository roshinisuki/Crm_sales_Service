"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getTasksAction,
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "@/app/actions/tasks";
import { getContactsAction } from "@/app/actions/contacts";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ConfirmModal";
import { formatDate, cn } from "@/lib/ui-utils";
import {
  Plus, Search, Filter, CheckSquare, Clock, AlertTriangle,
  CheckCircle2, Pencil, Trash2, CalendarClock, Tag, User2,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const TASK_STATUSES = ["Open", "InProgress", "Done", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const PRIORITY_COLOR: Record<string, string> = {
  Low:    "bg-slate-100 text-slate-500",
  Medium: "bg-blue-50 text-blue-600",
  High:   "bg-amber-50 text-amber-600",
  Urgent: "bg-red-50 text-red-600",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  Open:       <CheckSquare size={14} className="text-slate-400" />,
  InProgress: <Clock size={14} className="text-blue-500" />,
  Done:       <CheckCircle2 size={14} className="text-green-500" />,
  Cancelled:  <AlertTriangle size={14} className="text-slate-300" />,
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  contactId: string | null;
  assignedTo: string;
  createdAt: Date | string;
  Contact?: { id: string; name: string; company: string | null } | null;
};

const emptyForm = {
  title: "",
  description: "",
  status: "Open",
  priority: "Medium",
  dueDate: "",
  contactId: "",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const toast = useToast();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; company: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean; title: string; message: string; action: () => void;
  }>({ isOpen: false, title: "", message: "", action: () => {} });

  // ── Load tasks ──────────────────────────────────────────────────────────────

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await getTasksAction({ search, status: statusFilter || undefined, priority: priorityFilter || undefined });
      if (res.success && res.data) {
        setTasks(res.data as TaskRow[]);
      } else {
        toast.error(res.message || "Failed to load tasks");
      }
    } catch {
      toast.error("An error occurred while loading tasks");
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await getContactsAction();
      if (res.success && res.data) {
        setContacts(res.data.map((c: any) => ({ id: c.id, name: c.name, company: c.company })));
      }
    } catch { /* non-critical */ }
  };

  useEffect(() => { loadTasks(); }, [search, statusFilter, priorityFilter]);
  useEffect(() => { loadContacts(); }, []);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpiTotal     = tasks.length;
  const kpiInProgress = tasks.filter(t => t.status === "InProgress").length;
  const kpiOverdue   = tasks.filter(t => {
    if (!t.dueDate || t.status === "Done" || t.status === "Cancelled") return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const kpiDone      = tasks.filter(t => t.status === "Done").length;

  // ── Pagination ──────────────────────────────────────────────────────────────

  const itemsPerPage = 10;
  const { page, setPage, totalPages, paged: pagedTasks } = usePagination(tasks, itemsPerPage);

  // ── Modal helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (task: TaskRow) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
      contactId: task.contactId ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        contactId: form.contactId || null,
      };

      const res = editingId
        ? await updateTaskAction(editingId, payload)
        : await createTaskAction(payload);

      if (res.success) {
        toast.success(editingId ? "Task updated" : "Task created");
        closeModal();
        loadTasks();
      } else {
        toast.error(res.message || "Save failed");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (task: TaskRow) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Task",
      message: `Are you sure you want to delete "${task.title}"? This cannot be undone.`,
      action: async () => {
        const res = await deleteTaskAction(task.id);
        if (res.success) {
          toast.success("Task deleted");
          loadTasks();
        } else {
          toast.error(res.message || "Delete failed");
        }
        setConfirmState(s => ({ ...s, isOpen: false }));
      },
    });
  };

  // ── Quick status toggle ──────────────────────────────────────────────────────

  const toggleDone = async (task: TaskRow) => {
    const newStatus = task.status === "Done" ? "Open" : "Done";
    const res = await updateTaskAction(task.id, { status: newStatus });
    if (res.success) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } else {
      toast.error(res.message || "Update failed");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Tasks"
      subtitle="Create, assign, and track tasks across your team."
      action={
        <button onClick={openCreate} className="btn-primary text-xs flex items-center gap-2">
          <Plus size={14} /> Add Task
        </button>
      }
    >
      <div className="space-y-4">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Tasks"  value={kpiTotal}      icon={<CheckSquare size={20} />} variant="blue"   subtitle="All tasks" />
          <SummaryCard label="In Progress"  value={kpiInProgress} icon={<Clock size={20} />}       variant="amber"  subtitle="Currently working" />
          <SummaryCard label="Overdue"      value={kpiOverdue}    icon={<AlertTriangle size={20} />} variant="red"  subtitle="Past due dates" />
          <SummaryCard label="Completed"    value={kpiDone}       icon={<CheckCircle2 size={20} />} variant="green" subtitle="Finished tasks" />
        </div>

        {/* Filter bar */}
        <div className="crm-card bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-500"><Filter size={14} /> Filter:</div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
            >
              <option value="">All Statuses</option>
              {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none"
            >
              <option value="">All Priorities</option>
              {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Tasks table */}
        <div className="crm-card overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-4 w-8"></th>
                  <th className="px-4 py-4">Task</th>
                  <th className="px-4 py-4">Priority</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Due Date</th>
                  <th className="px-4 py-4">Contact</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-400">Loading tasks...</td>
                  </tr>
                ) : pagedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <CheckSquare size={20} className="text-amber-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No tasks found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {search || statusFilter || priorityFilter
                          ? "Try adjusting your filters."
                          : "Click \"Add Task\" to create your first task."}
                      </p>
                    </td>
                  </tr>
                ) : pagedTasks.map((task) => {
                  const isOverdue = task.dueDate && task.status !== "Done" && task.status !== "Cancelled"
                    && new Date(task.dueDate) < new Date();

                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        "border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-slate-600 text-sm",
                        task.status === "Done" && "opacity-60",
                      )}
                    >
                      {/* Quick done toggle */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleDone(task)}
                          title={task.status === "Done" ? "Mark as open" : "Mark as done"}
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            task.status === "Done"
                              ? "border-green-400 bg-green-400"
                              : "border-slate-300 hover:border-green-400",
                          )}
                        >
                          {task.status === "Done" && <CheckCircle2 size={12} className="text-white" />}
                        </button>
                      </td>

                      {/* Title + description */}
                      <td className="px-4 py-4 max-w-xs">
                        <p className={cn("font-semibold text-slate-800 truncate", task.status === "Done" && "line-through text-slate-400")}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-4">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full", PRIORITY_COLOR[task.priority] ?? "bg-slate-100 text-slate-500")}>
                          <Tag size={10} /> {task.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          {STATUS_ICON[task.status]}
                          <StatusBadge status={task.status} size="sm" />
                        </div>
                      </td>

                      {/* Due date */}
                      <td className="px-4 py-4">
                        {task.dueDate ? (
                          <div className={cn("flex items-center gap-1.5 text-xs font-medium", isOverdue ? "text-red-500" : "text-slate-500")}>
                            <CalendarClock size={12} />
                            {formatDate(task.dueDate as string)}
                            {isOverdue && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-bold">Overdue</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Contact link */}
                      <td className="px-4 py-4">
                        {task.Contact ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User2 size={12} />
                            <span className="truncate max-w-[120px]">{task.Contact.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(task)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                            title="Edit task"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => confirmDelete(task)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete task"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit Task" : "New Task"}
        subtitle={editingId ? "Update task details" : "Create a new task for your team"}
        size="md"
        headerColor="from-amber-50 to-white"
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Task"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Title" required>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Follow up with Acme Corp"
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional details..."
              rows={3}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Status">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Due Date">
            <Input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </FormField>

          <FormField label="Linked Contact" hint="Optionally link this task to a contact">
            <Select value={form.contactId} onChange={e => setForm(f => ({ ...f, contactId: e.target.value }))}>
              <option value="">— None —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` (${c.company})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(s => ({ ...s, isOpen: false }))}
      />
    </PageShell>
  );
}
