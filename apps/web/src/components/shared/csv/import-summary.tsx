"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "cn";

export interface ImportErrorRow {
  row: number;
  address: string;
  reason: string;
}

export interface ImportSummaryProps {
  inserted?: number;
  skipped?: number;
  errors?: ImportErrorRow[];
  className?: string;
}

export function ImportSummary({
  inserted = 0,
  skipped = 0,
  errors = [],
  className,
}: ImportSummaryProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const total = inserted + skipped + errors.length;

  return (
    <div className={cn("space-y-4 w-full", className)} data-testid="import-summary">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
        {/* Inserted */}
        <div
          className="flex flex-col items-center justify-center p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          data-testid="summary-stat-inserted"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <CheckCircle2 className="size-3.5" />
            <span>Imported</span>
          </div>
          <span className="text-xl font-bold mt-0.5">{inserted}</span>
        </div>

        {/* Skipped */}
        <div
          className="flex flex-col items-center justify-center p-3 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
          data-testid="summary-stat-skipped"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="size-3.5" />
            <span>Skipped</span>
          </div>
          <span className="text-xl font-bold mt-0.5">{skipped}</span>
        </div>

        {/* Failed */}
        <div
          className={cn(
            "flex flex-col items-center justify-center p-3 rounded-xl border text-muted-foreground",
            errors.length > 0
              ? "bg-destructive/10 border-destructive/20 text-destructive"
              : "bg-muted/40 border-border"
          )}
          data-testid="summary-stat-failed"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <XCircle className="size-3.5" />
            <span>Failed</span>
          </div>
          <span className="text-xl font-bold mt-0.5">{errors.length}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Total rows evaluated: <span className="font-semibold text-foreground">{total}</span>
      </p>

      {/* Row-level errors accordion / details */}
      {errors.length > 0 && (
        <div className="border rounded-xl overflow-hidden text-xs" data-testid="import-errors-container">
          <button
            type="button"
            onClick={() => setShowErrorDetails((prev) => !prev)}
            className="flex items-center justify-between w-full p-3 font-medium bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            data-testid="toggle-error-details-btn"
          >
            <span className="text-destructive font-semibold">
              View {errors.length} Failed Row Details
            </span>
            {showErrorDetails ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>

          {showErrorDetails && (
            <div className="max-h-60 overflow-y-auto divide-y">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/50 text-muted-foreground font-medium sticky top-0">
                  <tr>
                    <th className="py-2 px-3 w-16">Row</th>
                    <th className="py-2 px-3">Value</th>
                    <th className="py-2 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {errors.map((err, index) => (
                    <tr key={`${err.row}-${err.address}-${index}`} className="hover:bg-muted/20">
                      <td className="py-1.5 px-3 font-mono text-muted-foreground">#{err.row}</td>
                      <td className="py-1.5 px-3 font-mono font-medium truncate max-w-[140px]">
                        {err.address || "—"}
                      </td>
                      <td className="py-1.5 px-3 text-destructive/90">{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
