"use client";

import React, { useState } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui-utils";

export type ColumnDef<T> = {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
};

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalCount?: number;
    pageSize?: number;
  };
  onSort?: (key: string, direction: "asc" | "desc") => void;
  defaultSortKey?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ data, columns, pagination, onSort, defaultSortKey, onRowClick }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    let newDir: "asc" | "desc" = "asc";
    if (sortKey === key && sortDir === "asc") {
      newDir = "desc";
    }
    setSortKey(key);
    setSortDir(newDir);
    if (onSort) onSort(key, newDir);
  };

  return (
    <div className="crm-table-wrapper flex flex-col w-full">
      <div className="overflow-x-auto">
        <table className="crm-table min-w-max">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  style={{ width: col.width }}
                  className={cn(
                    "crm-th",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    col.sortable && "cursor-pointer select-none hover:bg-muted/50"
                  )}
                  onClick={() => {
                    if (col.sortable && col.accessorKey) {
                      handleSort(col.accessorKey as string);
                    }
                  }}
                >
                  <div className={cn(
                    "flex items-center gap-1",
                    col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"
                  )}>
                    {col.header}
                    {col.sortable && (
                      <span className="inline-flex flex-col ml-1">
                        <ChevronUp className={cn(
                          "w-3 h-3 -mb-1",
                          sortKey === col.accessorKey && sortDir === "asc" ? "text-foreground" : "text-muted-foreground/40"
                        )} />
                        <ChevronDown className={cn(
                          "w-3 h-3",
                          sortKey === col.accessorKey && sortDir === "desc" ? "text-foreground" : "text-muted-foreground/40"
                        )} />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="crm-td text-center text-sm text-muted-foreground">
                  No data available.
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn("crm-tr group", onRowClick && "table-row-clickable")}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      style={{ width: col.width }}
                      className={cn(
                        "crm-td",
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      )}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.closest("button") ||
                          target.closest("a") ||
                          target.closest("input") ||
                          target.closest("select") ||
                          target.closest(".row-action-btn")
                        ) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {col.cell ? col.cell(row) : col.accessorKey ? (row as any)[col.accessorKey] : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
          <div className="text-sm text-muted-foreground">
            {pagination.totalCount !== undefined && pagination.pageSize !== undefined ? (
              <>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.totalCount)}
                </span>{" "}
                to{" "}
                <span className="font-medium text-foreground">
                  {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}
                </span>{" "}
                of <span className="font-medium text-foreground">{pagination.totalCount}</span> entries
              </>
            ) : (
              <>Page {pagination.currentPage} of {pagination.totalPages}</>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              className="p-1 border border-border rounded text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="p-1 border border-border rounded text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
