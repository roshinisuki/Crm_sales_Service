"use client";

import React, { useState, useEffect, useCallback } from "react";
import { StickyNote, Send, Trash2, Loader2, User } from "lucide-react";
import { getNotesAction, createNoteAction, deleteNoteAction } from "@/app/actions/notes";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/ui-utils";

type NoteEntityType = "LEAD" | "CONTACT" | "DEAL" | "PROPOSAL" | "VISIT" | "NEGOTIATION";

interface NoteAuthor {
  id: string;
  name: string;
  role: string;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
  createdBy: NoteAuthor;
}

interface NotePanelProps {
  entityType: NoteEntityType;
  entityId: string;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

const roleColors: Record<string, string> = {
  SuperAdmin: "bg-violet-600",
  Admin: "bg-rose-500",
  SalesManager: "bg-blue-600",
  SalesExecutive: "bg-emerald-600",
  Customer: "bg-amber-500",
};

export function NotePanel({ entityType, entityId, className }: NotePanelProps) {
  const toast = useToast();
  const { user } = useAuth();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const res = await getNotesAction(entityType, entityId);
    if (res.success && res.data) setNotes(res.data as Note[]);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);

    // Optimistic UI: show note immediately
    const optimisticNote: Note = {
      id: `optimistic-${Date.now()}`,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      createdBy: { id: user?.id ?? "", name: user?.name ?? "You", role: user?.role ?? "" },
    };
    setNotes((prev) => [optimisticNote, ...prev]);
    setContent("");

    const res = await createNoteAction(entityType, entityId, optimisticNote.content);
    setSubmitting(false);

    if (res.success && res.data) {
      // Replace optimistic entry with real server data
      setNotes((prev) =>
        prev.map((n) => (n.id === optimisticNote.id ? (res.data as Note) : n))
      );
      toast.success("Note added");
    } else {
      // Roll back
      setNotes((prev) => prev.filter((n) => n.id !== optimisticNote.id));
      toast.error(res.message || "Failed to add note");
    }
  };

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    const res = await deleteNoteAction(noteId);
    setDeletingId(null);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } else {
      toast.error(res.message || "Failed to delete note");
    }
  };

  const canDelete = (note: Note) =>
    note.createdBy.id === user?.id ||
    ["Admin", "SalesManager", "SuperAdmin"].includes(user?.role ?? "");

  return (
    <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <StickyNote size={16} className="text-[var(--primary)]" />
        <h3 className="text-sm font-bold text-slate-800">Notes</h3>
        {notes.length > 0 && (
          <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
            {notes.length}
          </span>
        )}
      </div>

      {/* Input */}
      {user?.role !== "Customer" && (
        <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as any);
            }}
            placeholder="Add a note… (Ctrl+Enter to submit)"
            rows={3}
            maxLength={2000}
            className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2.5 resize-none outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-slate-400">{content.length}/2000</span>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Add Note
            </button>
          </div>
        </form>
      )}

      {/* Notes list */}
      <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center">
            <Loader2 size={18} className="animate-spin text-slate-300 mx-auto" />
          </div>
        ) : notes.length === 0 ? (
          <div className="py-10 text-center">
            <StickyNote size={24} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No notes yet</p>
            <p className="text-xs text-slate-300 mt-0.5">Be the first to add a note above</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="px-5 py-4 group hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5",
                    roleColors[note.createdBy.role] ?? "bg-slate-400"
                  )}
                >
                  {getInitials(note.createdBy.name)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">
                      {note.createdBy.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{note.createdBy.role}</span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {timeAgo(note.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                </div>

                {/* Delete */}
                {canDelete(note) && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    title="Delete note"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 shrink-0"
                  >
                    {deletingId === note.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
