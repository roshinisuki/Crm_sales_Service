"use client";

import { useState, useTransition } from "react";
import { createCustomerSupportAction } from "@/app/actions/visits";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  x: "M6 18L18 6M6 6l12 12",
  chat: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M5 13l4 4L19 7"
};

type Ticket = {
  id: string;
  meetingSummary: string | null;
  outcome: string | null;
  createdAt: Date;
  status: string;
};

export default function SupportClient({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const parseSupportTicket = (summary: string | null) => {
    if (!summary) return { subject: "Support Request", description: "" };
    const subjectPrefix = "Support Ticket Subject: ";
    const descPrefix = ". Description: ";
    if (summary.startsWith(subjectPrefix)) {
      const parts = summary.split(descPrefix);
      const sub = parts[0].replace(subjectPrefix, "");
      const desc = parts[1] || "";
      return { subject: sub, description: desc };
    }
    return { subject: "Support Request", description: summary };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!subject.trim() || !description.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    startTransition(async () => {
      const res = await createCustomerSupportAction({ subject, description, severity });
      if (res.success) {
        setSuccess("Support ticket submitted successfully!");
        setSubject("");
        setDescription("");
        setSeverity("Medium");
        
        // Add ticket locally for instant feedback
        const newTicket: Ticket = {
          id: Math.random().toString(),
          meetingSummary: `Support Ticket Subject: ${subject}. Description: ${description}`,
          outcome: "Enquired to IT",
          createdAt: new Date(),
          status: "CHECKED_IN"
        };
        setTickets([newTicket, ...tickets]);
        
        setTimeout(() => {
          setIsOpen(false);
          setSuccess("");
        }, 1500);
      } else {
        setError(res.message || "Failed to submit support ticket.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Support & IT Requests</h1>
          <p className="text-[var(--text-secondary)] mt-1">Submit tickets to resolve IT issues or ask queries.</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 bg-[var(--primary)] text-[var(--accent-contrast)] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[var(--primary-hover)] transition-all shadow-sm"
        >
          <Ico d={icons.plus} size={16} />
          New Ticket
        </button>
      </div>

      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-[var(--surface-2)] text-[var(--text-muted)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Ico d={icons.chat} size={24} />
            </div>
            <h3 className="text-[var(--text-primary)] font-semibold mb-1">No support tickets</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
              If you have any technical queries or issues with  SUKI  CRM portal, create a new support ticket.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {tickets.map(ticket => {
              const { subject: parsedSubject, description: parsedDesc } = parseSupportTicket(ticket.meetingSummary);
              const outcome = ticket.outcome || "Enquired to IT";
              
              return (
                <div key={ticket.id} className="p-6 hover:bg-[var(--surface-2)] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-[var(--text-primary)] text-base">{parsedSubject}</h3>
                        {outcome === "Resolved" ? (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Resolved
                          </span>
                        ) : outcome === "Resolving" ? (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Resolving
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Enquired to IT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{parsedDesc}</p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-xs text-[var(--text-muted)] font-medium">Submitted on</p>
                      <p className="text-sm text-[var(--text-primary)] font-medium mt-0.5">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW SUPPORT TICKET MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity bg-black/60 backdrop-blur-sm"
              onClick={() => !isPending && setIsOpen(false)}
            />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-[var(--surface)] rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-[var(--border)]">
              <div className="bg-[var(--surface-2)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">New Support Ticket</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center transition-colors"
                >
                  <Ico d={icons.x} size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 font-medium flex items-center gap-2">
                    <Ico d={icons.check} size={16} className="text-emerald-600" />
                    {success}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Subject / Issue Title</label>
                  <input
                    type="text"
                    required
                    disabled={isPending}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Cannot download invoice reports"
                    className="input-field w-full px-4 py-2.5 rounded-xl transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Severity Level</label>
                    <select
                      disabled={isPending}
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="select-field w-full px-4 py-2.5 rounded-xl transition-all"
                    >
                      <option value="Low">Low (General Query)</option>
                      <option value="Medium">Medium (Workflow Issue)</option>
                      <option value="High">High (Service Blocked)</option>
                      <option value="Critical">Critical (System Downtime)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">Detailed Description</label>
                  <textarea
                    required
                    disabled={isPending}
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe exactly what happened, and any steps to reproduce the issue..."
                    className="input-field w-full px-4 py-2.5 rounded-xl transition-all resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 bg-[var(--primary)] text-[var(--accent-contrast)] rounded-xl text-sm font-bold hover:bg-[var(--primary-hover)] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Ticket"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
