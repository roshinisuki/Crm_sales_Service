"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTasksAction, updateTaskAction, deleteTaskAction } from "@/app/actions/tasks";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination, usePagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ConfirmModal";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { PLANNER_STATUS } from "@/lib/module-status-config";
import { formatDate, cn } from "@/lib/ui-utils";
import { Plus, Search, Filter, CheckSquare, Clock, AlertTriangle, CheckCircle2, Pencil, Trash2, CalendarClock, Tag, User2 } from "lucide-react";

const TASK_STATUSES = ["Open", "InProgress", "Done", "Overdue", "Cancelled"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const PRIORITY_COLOR: Record<string, string> = {
  Low:    "bg-slate-100 text-slate-500",
  Medium: "bg-blue-50 text-blue-600",
  High:   "bg-amber-50 text-amber-600",
  Urgent: "bg-red-50 text-red-600",
};

function TasksPageContent() {
  const router = useRouter();
  const toast = useToast();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const statusFilter = useStatusFromUrl("status");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({
    isOpen: false, title: "", message: "", action: () => {},
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      fetch("/api/cron/tasks-overdue", { method: "POST" }).catch(() => {});
    }
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await getTasksAction({ search, status: statusFilter || undefined, priority: priorityFilter || undefined });
      if (res.success && res.data) { setTasks(res.data); }
      else { toast.error(res.message || "Failed to load tasks"); }
    } catch { toast.error("An error occurred while loading tasks"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, [search, statusFilter, priorityFilter]);

  const itemsPerPage = 20;
  const { page, setPage, totalPages, paged: pagedTasks } = usePagination(tasks, itemsPerPage);

  const kpiTotal = tasks.length;
  const kpiPending = tasks.filter(t => t.status === "Open" || t.status === "InProgress").length;
  const kpiOverdue = tasks.filter(t => t.status === "Overdue").length;
  const kpiDone = tasks.filter(t => t.status === "Done").length;

  const confirmDelete = (task: any) => {
    setConfirmState({
      isOpen: true, title: "Delete Task",
      message: `Delete "${task.title}"? This cannot be undone.`,
      action: async () => {
        const res = await deleteTaskAction(task.id);
        if (res.success) { toast.success("Task deleted"); loadTasks(); }
        else { toast.error(res.message || "Delete failed"); }
        setConfirmState(s => ({ ...s, isOpen: false }));
      },
    });
  };

  const toggleDone = async (task: any) => {
    const newStatus = task.status === "Done" ? "Open" : "Done";
    const res = await updateTaskAction(task.id, { status: newStatus });
    if (res.success) { loadTasks(); } else { toast.error(res.message || "Update failed"); }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageShell
      title="Planner"
      subtitle="Create, assign, and track tasks across your team."
      action={
        <Link href="/tasks/new" className="btn-primary text-xs flex items-center gap-2">
          <Plus size={14} /> Add Task
        </Link>
      }
    >
      <div className="space-y-4">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Tasks" value={kpiTotal} icon={<CheckSquare size={20} />} variant="blue" subtitle="All tasks" />
          <SummaryCard label="Pending" value={kpiPending} icon={<Clock size={20} />} variant="amber" subtitle="Open / In Progress" />
          <SummaryCard label="Overdue" value={kpiOverdue} icon={<AlertTriangle size={20} />} variant="red" subtitle="Past due dates" />
          <SummaryCard label="Completed" value={kpiDone} icon={<CheckCircle2 size={20} />} variant="green" subtitle="Finished tasks" />
        </div>

        {/* Status Filter Bar */}
        <StatusFilterBar
          statuses={PLANNER_STATUS}
          paramKey="status"
          basePath="/tasks"
        />

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
            <div className="flex items-center gap-2 text-xs text-slate-500"><Filter size={14} /> Priority:</div>
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
        <div className="crm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="crm-th w-8"></th>
                  <th className="crm-th">Code</th>
                  <th className="crm-th">Title</th>
                  <th className="crm-th">Priority</th>
                  <th className="crm-th">Due Date</th>
                  <th className="crm-th">Assigned To</th>
                  <th className="crm-th">Status</th>
                  <th className="crm-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="crm-td text-center py-10 text-sm text-muted-foreground">Loading tasks...</td>
                  </tr>
                ) : pagedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="crm-td text-center py-16">
                      <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><CheckSquare size={20} className="text-amber-400" /></div>
                      <p className="text-sm font-semibold text-foreground">No tasks found</p>
                    </td>
                  </tr>
                ) : pagedTasks.map((task) => {
                  const isOverdue = task.status === "Overdue" || (task.dueDate && task.status !== "Done" && task.status !== "Cancelled" && new Date(task.dueDate) < new Date());
                  return (
                    <tr
                      key={task.id}
                      className={cn("crm-tr table-row-clickable", task.status === "Done" && "opacity-60")}
                      onClick={() => router.push(`/tasks/${task.id}`)}
                    >
                      <td className="crm-td" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleDone(task)} title={task.status === "Done" ? "Mark as open" : "Mark as done"} className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors", task.status === "Done" ? "border-green-400 bg-green-400" : "border-slate-300 hover:border-green-400")}>
                          {task.status === "Done" && <CheckCircle2 size={12} className="text-white" />}
                        </button>
                      </td>
                      <td className="crm-td font-mono text-xs font-semibold text-[var(--primary)]">{task.taskCode}</td>
                      <td className="crm-td max-w-xs">
                        <span className={cn("row-primary-link truncate", task.status === "Done" && "line-through text-muted-foreground")}>{task.title}</span>
                        {task.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>}
                      </td>
                      <td className="crm-td"><span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full", PRIORITY_COLOR[task.priority] ?? "bg-slate-100 text-slate-500")}><Tag size={10} /> {task.priority}</span></td>
                      <td className="crm-td">
                        {task.dueDate ? (
                          <div className={cn("flex items-center gap-1.5 text-xs font-medium", isOverdue ? "text-red-500" : "text-muted-foreground")}>
                            <CalendarClock size={12} /> {formatDate(task.dueDate)}
                            {isOverdue && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-bold">Overdue</span>}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="crm-td"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User2 size={12} /><span className="truncate max-w-[120px]">{task.User?.name || "—"}</span></div></td>
                      <td className="crm-td"><StatusBadge status={task.status} size="sm" /></td>
                      <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => router.push(`/tasks/${task.id}`)} className="row-action-btn" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => confirmDelete(task)} className="row-action-btn row-action-btn-danger" title="Delete"><Trash2 size={14} /></button>
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

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <TasksPageContent />
    </Suspense>
  );
}
