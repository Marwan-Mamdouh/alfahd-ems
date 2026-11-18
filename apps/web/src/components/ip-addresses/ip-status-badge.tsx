"use client";

import React from "react";
import { CheckCircle2, Lock, Archive, Check } from "lucide-react";
import type { IpStatus } from "@alfahd/types";

export interface IpStatusBadgeProps {
  status: IpStatus;
  isArchived: boolean;
  className?: string;
}

export function IpStatusBadge({ status, isArchived, className }: IpStatusBadgeProps) {
  const isFree = status === "FREE";
  const isReserved = status === "RESERVED";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className ?? ""}`} data-testid="ip-status-badge-container">
      {/* Operational Status */}
      {isFree ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          data-testid="status-badge-free"
        >
          <CheckCircle2 className="size-3.5" />
          متاح (FREE)
        </span>
      ) : isReserved ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          data-testid="status-badge-reserved"
        >
          <Lock className="size-3.5" />
          محجوز (RESERVED)
        </span>
      ) : null}

      {/* Archival Status */}
      {isArchived ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          data-testid="status-badge-archived"
        >
          <Archive className="size-3.5" />
          مؤرشف
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
          data-testid="status-badge-active"
        >
          <Check className="size-3.5" />
          نشط
        </span>
      )}
    </div>
  );
}
