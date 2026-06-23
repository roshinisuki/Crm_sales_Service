"use client";
import { CRMSpinner } from "@/components/CRMSpinner";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getActivityByIdAction, updateActivityAction } from "@/app/actions/activities";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { formatDateTime, cn } from "@/lib/ui-utils";
import { ArrowLeft, Phone, Video, Save, Pencil, X, Check, Clock, Calendar, User, MapPin } from "lucide-react";

export default function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const toast = useToast();

  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActivityByIdAction(id);
      if (res.success && res.data) {
        setActivity(res.data);
        setForm({
          content: res.data.content ?? "",
          status: res.data.status ?? "",
          direction: res.data.direction ?? "",
          duration: res.data.duration ?? "",
          meetingDate: res.data.meetingDate ? new Date(res.data.meetingDate).toISOString().slice(0, 16) : "",
          location: res.data.location ?? "",
          mode: res.data.mode ?? "",
          agenda: res.data.agenda ?? "",
          outcome: res.data.outcome ?? "",
        });
      } else {
        toast.error("Activity not found.");
        router.push("/activities");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateActivityAction(id, {
        content: form.content || undefined,
        status: form.status || undefined,
        direction: form.direction || undefined,
        duration: form.duration ? parseInt(form.duration) : undefined,
        meetingDate: form.meetingDate || undefined,
        location: form.location || undefined,
        mode: form.mode || undefined,
        agenda: form.agenda || undefined,
        outcome: form.outcome || undefined,
      });
      if (res.success) {
        toast.success("Activity updated");
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
      <div className="flex items-center justify-center h-64"><CRMSpinner size={40} label="Loading activity..." /></div>
    );
  }

  if (!activity) return null;

  const isCall = activity.channel === "Call";
  const isMeeting = activity.channel === "Meeting";

  return (
    <div className="page-shell max-w-3xl mx-auto">
      <button onClick={() => router.push("/activities")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors mb-4">
        <ArrowLeft size={16} /> Back to Activities
      </button>

      <div className="crm-card p-6 border-t-4 border-t-[var(--primary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
              {isCall ? <Phone size={20} className="text-[var(--primary)]" /> : isMeeting ? <Video size={20} className="text-[var(--primary)]" /> : <Clock size={20} className="text-[var(--primary)]" />}
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{isCall ? "Call Log" : isMeeting ? "Meeting" : "Activity"}</h1>
              <p className="text-xs text-slate-400">{formatDateTime(activity.sentAt)}</p>
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
                { label: "Channel", value: activity.channel },
                { label: "Linked To", value: activity.customer?.name || activity.lead?.name || "â€”" },
                { label: "Direction", value: activity.direction },
                ...(isCall ? [{ label: "Duration", value: activity.duration ? `${activity.duration} min` : "â€”" }] : []),
                ...(isMeeting ? [
                  { label: "Meeting Date", value: activity.meetingDate ? formatDateTime(activity.meetingDate) : "â€”" },
                  { label: "Mode", value: activity.mode || "â€”" },
                  { label: "Location", value: activity.location || "â€”" },
                  { label: "Agenda", value: activity.agenda || "â€”" },
                  { label: "Outcome", value: activity.outcome || "â€”" },
                ] : []),
                { label: "Status", value: <StatusBadge status={activity.status} size="sm" /> },
                { label: "Content", value: activity.content || "â€”" },
                { label: "Created By", value: activity.sentByUser?.name || "â€”" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <dt className="text-xs font-semibold text-slate-400 shrink-0">{label}</dt>
                  <dd className="text-xs font-semibold text-slate-700 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="space-y-4">
              {isCall && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Direction"><Select value={form.direction} onChange={(e) => setForm((f: any) => ({ ...f, direction: e.target.value }))}><option value="Outbound">Outbound</option><option value="Inbound">Inbound</option></Select></FormField>
                  <FormField label="Duration (min)"><Input type="number" value={form.duration} onChange={(e) => setForm((f: any) => ({ ...f, duration: e.target.value }))} /></FormField>
                  <FormField label="Status"><Select value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}><option value="Completed">Completed</option><option value="NoAnswer">No Answer</option><option value="Scheduled">Scheduled</option></Select></FormField>
                </div>
              )}
              {isMeeting && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Meeting Date"><Input type="datetime-local" value={form.meetingDate} onChange={(e) => setForm((f: any) => ({ ...f, meetingDate: e.target.value }))} /></FormField>
                  <FormField label="Mode"><Select value={form.mode} onChange={(e) => setForm((f: any) => ({ ...f, mode: e.target.value }))}><option value="In-person">In-person</option><option value="Virtual">Virtual</option></Select></FormField>
                  <FormField label="Location"><Input value={form.location} onChange={(e) => setForm((f: any) => ({ ...f, location: e.target.value }))} /></FormField>
                  <FormField label="Status"><Select value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}><option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></Select></FormField>
                </div>
              )}
              {isMeeting && <FormField label="Agenda"><Textarea value={form.agenda} onChange={(e) => setForm((f: any) => ({ ...f, agenda: e.target.value }))} rows={3} /></FormField>}
              {isMeeting && <FormField label="Outcome"><Textarea value={form.outcome} onChange={(e) => setForm((f: any) => ({ ...f, outcome: e.target.value }))} rows={3} /></FormField>}
              <FormField label="Content / Notes"><Textarea value={form.content} onChange={(e) => setForm((f: any) => ({ ...f, content: e.target.value }))} rows={4} /></FormField>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

