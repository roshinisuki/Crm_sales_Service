"use client";

import React, { useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/ui-utils";

interface DeleteRestoreButtonProps {
  /** Whether the record is currently soft-deleted */
  isDeleted: boolean;
  /** Callback to run soft-delete (Admin) or hard-delete (SuperAdmin) */
  onDelete: (permanent?: boolean) => Promise<void>;
  /** Callback to run restore */
  onRestore: () => Promise<void>;
  /** Current user's role — used to gate permanent delete option */
  role: string;
  /** Name of the record being deleted, shown in the confirm dialog */
  recordLabel?: string;
  /** Extra class on the outer wrapper */
  className?: string;
  /** Button size variant */
  size?: "sm" | "md";
}

export function DeleteRestoreButton({
  isDeleted,
  onDelete,
  onRestore,
  role,
  recordLabel = "this record",
  className,
  size = "sm",
}: DeleteRestoreButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permanentMode, setPermanentMode] = useState(false);

  const isSuperAdmin = role === "SuperAdmin";
  const canManage = ["Admin", "SalesManager", "SuperAdmin"].includes(role);

  if (!canManage) return null;

  const iconSize = size === "sm" ? 14 : 16;
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (isDeleted) {
        await onRestore();
      } else {
        await onDelete(permanentMode);
      }
    } finally {
      setLoading(false);
      setShowConfirm(false);
      setPermanentMode(false);
    }
  };

  return (
    <>
      {/* ── Trigger button ── */}
      {isDeleted ? (
        <button
          onClick={() => setShowConfirm(true)}
          className={cn(
            "flex items-center gap-1.5 font-semibold rounded-lg border transition-all",
            size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
            "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
            className
          )}
          title="Restore record"
        >
          <RotateCcw size={iconSize} />
          Restore
        </button>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className={cn(
            "flex items-center gap-1.5 font-semibold rounded-lg border transition-all",
            size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
            "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100",
            className
          )}
          title="Delete record"
        >
          <Trash2 size={iconSize} />
          Delete
        </button>
      )}

      {/* ── Confirm Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-150">
            {/* Icon */}
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4",
                isDeleted
                  ? "bg-amber-100 text-amber-600"
                  : permanentMode
                  ? "bg-rose-100 text-rose-600"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {isDeleted ? (
                <RotateCcw size={22} />
              ) : permanentMode ? (
                <ShieldAlert size={22} />
              ) : (
                <AlertTriangle size={22} />
              )}
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-slate-800 text-center">
              {isDeleted
                ? "Restore Record?"
                : permanentMode
                ? "Permanently Delete?"
                : "Delete Record?"}
            </h3>

            {/* Body */}
            <p className={cn("mt-2 text-center text-slate-500", textSize)}>
              {isDeleted ? (
                <>
                  This will restore <strong>{recordLabel}</strong> and make it active again.
                </>
              ) : permanentMode ? (
                <>
                  <span className="text-rose-600 font-semibold">This cannot be undone.</span>{" "}
                  <strong>{recordLabel}</strong> will be permanently removed from the database.
                </>
              ) : (
                <>
                  <strong>{recordLabel}</strong> will be soft-deleted and hidden from all views.
                  Admins can restore it later.
                </>
              )}
            </p>

            {/* SuperAdmin permanent delete toggle */}
            {!isDeleted && isSuperAdmin && (
              <label className="flex items-center gap-2 mt-4 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permanentMode}
                  onChange={(e) => setPermanentMode(e.target.checked)}
                  className="accent-rose-600 w-4 h-4"
                />
                <span className="text-xs text-rose-700 font-semibold">
                  Permanent delete (SuperAdmin only — irreversible)
                </span>
              </label>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowConfirm(false); setPermanentMode(false); }}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={cn(
                  "flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60",
                  isDeleted
                    ? "bg-amber-500 hover:bg-amber-600"
                    : permanentMode
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-slate-700 hover:bg-slate-800"
                )}
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : isDeleted ? (
                  <><RotateCcw size={15} /> Restore</>
                ) : permanentMode ? (
                  <><ShieldAlert size={15} /> Permanently Delete</>
                ) : (
                  <><Trash2 size={15} /> Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
