"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { Star, MessageSquare, ClipboardList, CheckCircle, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/ui-utils";

export default function MyVisitsFeedbackPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [visits, setVisits] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch engineer's visits
      const visitsRes = await fetch("/api/service/visits");
      // Fetch engineer's reviews
      const reviewsRes = await fetch("/api/service/reviews");

      if (visitsRes.ok && reviewsRes.ok) {
        const visitsData = await visitsRes.json();
        const reviewsData = await reviewsRes.json();

        // Only show completed visits for feedback logging
        const completedVisits = visitsData.filter((v: any) => v.status?.name === "Closed" || v.completedAt);
        setVisits(completedVisits);
        setReviews(reviewsData);
      }
    } catch (e) {
      console.error("Error loading feedback data:", e);
      toast.error("Failed to load visits or feedback data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map review to visit ID
  const reviewMap = useMemo(() => {
    const map: Record<string, any> = {};
    reviews.forEach(r => {
      if (r.serviceVisitId) {
        map[r.serviceVisitId] = r;
      }
    });
    return map;
  }, [reviews]);

  // Compute Stats
  const stats = useMemo(() => {
    const totalCompleted = visits.length;
    const withFeedback = visits.filter(v => reviewMap[v.id]).length;
    const submittedReviews = reviews.filter(r => r.status === "Submitted" && typeof r.rating === "number");
    const avgRating = submittedReviews.length > 0
      ? (submittedReviews.reduce((sum, r) => sum + r.rating, 0) / submittedReviews.length).toFixed(1)
      : "–";

    return {
      totalCompleted,
      withFeedback,
      avgRating,
    };
  }, [visits, reviewMap, reviews]);

  const handleOpenLogModal = (visit: any) => {
    setSelectedVisit(visit);
    setRating(5);
    setComment("");
  };

  const handleCloseLogModal = () => {
    setSelectedVisit(null);
  };

  const handleLogFeedback = async () => {
    if (!selectedVisit) return;
    try {
      setSubmitting(true);

      // 1. Create a Pending Review first
      const payload = {
        customerId: selectedVisit.customerId,
        engineerId: selectedVisit.engineerId,
        serviceVisitId: selectedVisit.id,
      };

      const createRes = await fetch("/api/service/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json();
        throw new Error(errJson.error || "Failed to initialize review record.");
      }

      const review = await createRes.json();

      // 2. Submit the rating and comments via PATCH
      const patchRes = await fetch(`/api/service/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });

      if (!patchRes.ok) {
        const errJson = await patchRes.json();
        throw new Error(errJson.error || "Failed to submit rating values.");
      }

      toast.success("Feedback logged successfully on behalf of the customer!");
      handleCloseLogModal();
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to log feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)]">My Ratings & Feedback</h1>
          <p className="text-xs text-[var(--text-muted)]">Log and track customer feedback for your completed service visits.</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-all"
          title="Refresh Data"
        >
          <RefreshCw size={15} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-primary)]">{stats.totalCompleted}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Completed Visits</div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-primary)]">{stats.withFeedback}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Visits with Feedback</div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <Star size={20} className="fill-yellow-500/30" />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-primary)]">★ {stats.avgRating}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Average Rating</div>
          </div>
        </div>
      </div>

      {/* Main completed visits list */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden backdrop-blur-md">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Completed Visits & Feedback Status</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Loading completed visits...
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {visits.map((visit) => {
              const review = reviewMap[visit.id];
              return (
                <div key={visit.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--surface-2)]/30 transition-colors">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{visit.title}</span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {visit.customerAsset?.productName} (S/N: {visit.customerAsset?.serialNumber})
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Customer: <span className="font-semibold text-[var(--text-primary)]">{visit.customer?.name}</span>
                    </p>
                    {visit.completedAt && (
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Completed on: {new Date(visit.completedAt).toLocaleDateString()}
                      </p>
                    )}
                    {visit.outcomeNotes && (
                      <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface-2)] p-2 rounded-lg border border-[var(--border)]">
                        <strong>Outcome:</strong> {visit.outcomeNotes}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center">
                    {review ? (
                      <div className="space-y-1 text-right">
                        <div className="flex items-center gap-0.5 justify-end text-yellow-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              className={cn(i < (review.rating || 0) ? "fill-yellow-500" : "text-gray-400")}
                            />
                          ))}
                        </div>
                        {review.comment ? (
                          <div className="flex items-start gap-1 justify-end text-[11px] text-[var(--text-secondary)] italic max-w-xs">
                            <MessageSquare size={10} className="mt-0.5 shrink-0" />
                            <span>"{review.comment}"</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]">No comment provided</span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenLogModal(visit)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                      >
                        Log Feedback
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {visits.length === 0 && (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No completed service visits found. Ensure visits are transitioned to Completed or Closed.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Feedback Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Log Customer Feedback</h3>
              <button onClick={handleCloseLogModal} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <p className="text-[var(--text-secondary)]">
                <strong>Visit:</strong> {selectedVisit.title}
              </p>
              <p className="text-[var(--text-secondary)]">
                <strong>Customer:</strong> {selectedVisit.customer?.name}
              </p>
            </div>

            {/* Star Selector */}
            <div className="space-y-1.5 text-center py-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Rating</label>
              <div className="flex items-center justify-center gap-1.5 text-yellow-500">
                {Array.from({ length: 5 }).map((_, i) => {
                  const starVal = i + 1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(starVal)}
                      className="hover:scale-115 transition-transform"
                    >
                      <Star
                        size={28}
                        className={cn(starVal <= rating ? "fill-yellow-500" : "text-gray-400")}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Customer Comment / Remarks</label>
              <textarea
                placeholder="Enter comments, suggestions, or verbal feedback provided by the customer..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors placeholder-[var(--text-muted)]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={handleCloseLogModal}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogFeedback}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                {submitting ? "Logging..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
