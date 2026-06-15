"use client";
import React from "react";
import { cn } from "@/lib/ui-utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPages = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={cn("flex items-center justify-center gap-1.5 py-4", className)}>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-slate-200"
      >
        <ChevronLeft size={15} />
      </button>

      {getPages().map((p, i) => (
        <React.Fragment key={i}>
          {p === "..." ? (
            <span className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">…</span>
          ) : (
            <button
              onClick={() => onPageChange(p as number)}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold transition-all",
                page === p
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200",
              )}
            >
              {p}
            </button>
          )}
        </React.Fragment>
      ))}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-transparent hover:border-slate-200"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// Hook to use pagination
export function usePagination<T>(items: T[], perPage = 10) {
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const start = (page - 1) * perPage;
  const paged = items.slice(start, start + perPage);

  return { page, setPage, totalPages, paged, total: items.length };
}
