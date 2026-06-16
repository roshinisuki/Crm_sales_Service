"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCallAction, createMeetingAction, createNoteAction } from "@/app/actions/activities";
import { getCustomersAction } from "@/app/actions/customers";
import { useToast } from "@/components/ToastProvider";
import { PageShell } from "@/components/ui/PageShell";
import { FormField, Input, Select, Textarea } from "@/components/ui/FormField";
import { ArrowLeft, Save, Phone, Video, StickyNote } from "lucide-react";
import Link from "next/link";

type ActivityType = "call" | "meeting" | "note";

export default function NewActivityPage() {
  const router = useRouter();
  const toast = useToast();
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [callForm, setCallForm] = useState({ customerId: "", leadId: "", direction: "Outbound", duration: "", content: "", status: "Completed" });
  const [meetingForm, setMeetingForm] = useState({ customerId: "", leadId: "", meetingDate: "", location: "", mode: "In-person", agenda: "", outcome: "", content: "", status: "Scheduled" });
  const [noteForm, setNoteForm] = useState({ entityType: "LEAD", entityId: "", content: "" });

  const loadCustomers = async (query: string) => {
    if (query.length < 2) return;
    const res = await getCustomersAction({ search: query });
    if (res.success && res.data) setCustomers(res.data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let res;
      if (activityType === "call") {
        res = await createCallAction({
          customerId: selectedCustomer?.id || null,
          leadId: callForm.leadId || null,
          direction: callForm.direction,
          duration: callForm.duration ? parseInt(callForm.duration) : null,
          content: callForm.content,
          status: callForm.status,
        });
      } else if (activityType === "meeting") {
        res = await createMeetingAction({
          customerId: selectedCustomer?.id || null,
          leadId: meetingForm.leadId || null,
          meetingDate: meetingForm.meetingDate,
          location: meetingForm.location || null,
          mode: meetingForm.mode,
          agenda: meetingForm.agenda || null,
          outcome: meetingForm.outcome || null,
          content: meetingForm.content,
          status: meetingForm.status,
        });
      } else {
        res = await createNoteAction({
          entityType: noteForm.entityType,
          entityId: noteForm.entityId,
          content: noteForm.content,
        });
      }

      if (res.success) {
        toast.success(`${activityType.charAt(0).toUpperCase() + activityType.slice(1)} logged`);
        router.push("/activities");
      } else {
        toast.error(res.message || "Failed to save");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const TypeButton = ({ type, icon, label }: { type: ActivityType; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setActivityType(type)}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
        activityType === type
          ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <PageShell title="Log Activity" subtitle="Record a call, meeting, or note."
      action={
        <Link href="/activities" className="btn-secondary text-xs flex items-center gap-2">
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto">
        {/* Type selector */}
        <div className="flex items-center gap-3 mb-6">
          <TypeButton type="call" icon={<Phone size={16} />} label="Call" />
          <TypeButton type="meeting" icon={<Video size={16} />} label="Meeting" />
          <TypeButton type="note" icon={<StickyNote size={16} />} label="Note" />
        </div>

        <div className="crm-card bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          {/* ── CALL FORM ── */}
          {activityType === "call" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Linked Customer">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-sm">{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500">Remove</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input type="text" placeholder="Search..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); loadCustomers(e.target.value); setShowCustomerSearch(true); }} className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none" />
                      {showCustomerSearch && customers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {customers.map((c) => (
                            <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </FormField>
                <FormField label="Direction">
                  <Select value={callForm.direction} onChange={(e) => setCallForm((f) => ({ ...f, direction: e.target.value }))}>
                    <option value="Outbound">Outbound</option>
                    <option value="Inbound">Inbound</option>
                  </Select>
                </FormField>
                <FormField label="Duration (minutes)"><Input type="number" value={callForm.duration} onChange={(e) => setCallForm((f) => ({ ...f, duration: e.target.value }))} placeholder="15" /></FormField>
                <FormField label="Status">
                  <Select value={callForm.status} onChange={(e) => setCallForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="Completed">Completed</option>
                    <option value="NoAnswer">No Answer</option>
                    <option value="Scheduled">Scheduled</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Notes / Outcome"><Textarea value={callForm.content} onChange={(e) => setCallForm((f) => ({ ...f, content: e.target.value }))} placeholder="What was discussed..." rows={4} /></FormField>
            </>
          )}

          {/* ── MEETING FORM ── */}
          {activityType === "meeting" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Linked Customer">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-sm">{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500">Remove</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input type="text" placeholder="Search..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); loadCustomers(e.target.value); setShowCustomerSearch(true); }} className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none" />
                      {showCustomerSearch && customers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {customers.map((c) => (
                            <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </FormField>
                <FormField label="Meeting Date"><Input type="datetime-local" value={meetingForm.meetingDate} onChange={(e) => setMeetingForm((f) => ({ ...f, meetingDate: e.target.value }))} /></FormField>
                <FormField label="Mode">
                  <Select value={meetingForm.mode} onChange={(e) => setMeetingForm((f) => ({ ...f, mode: e.target.value }))}>
                    <option value="In-person">In-person</option>
                    <option value="Virtual">Virtual</option>
                  </Select>
                </FormField>
                <FormField label="Location"><Input value={meetingForm.location} onChange={(e) => setMeetingForm((f) => ({ ...f, location: e.target.value }))} placeholder="Conference Room A / Zoom link" /></FormField>
                <FormField label="Status">
                  <Select value={meetingForm.status} onChange={(e) => setMeetingForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Agenda"><Textarea value={meetingForm.agenda} onChange={(e) => setMeetingForm((f) => ({ ...f, agenda: e.target.value }))} placeholder="Meeting agenda..." rows={3} /></FormField>
              <FormField label="Outcome"><Textarea value={meetingForm.outcome} onChange={(e) => setMeetingForm((f) => ({ ...f, outcome: e.target.value }))} placeholder="What was decided..." rows={3} /></FormField>
            </>
          )}

          {/* ── NOTE FORM ── */}
          {activityType === "note" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Linked To">
                  <Select value={noteForm.entityType} onChange={(e) => setNoteForm((f) => ({ ...f, entityType: e.target.value }))}>
                    <option value="LEAD">Lead</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="DEAL">Deal</option>
                  </Select>
                </FormField>
                <FormField label="Entity ID"><Input value={noteForm.entityId} onChange={(e) => setNoteForm((f) => ({ ...f, entityId: e.target.value }))} placeholder="Record ID" /></FormField>
              </div>
              <FormField label="Note Content" required><Textarea value={noteForm.content} onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))} placeholder="Write your note here..." rows={6} /></FormField>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/activities" className="btn-secondary text-sm">Cancel</Link>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving ? "Saving…" : <><Save size={14} /> Save {activityType}</>}
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
