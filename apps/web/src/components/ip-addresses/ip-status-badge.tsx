"use client";

import React from "react";
import { CheckCircle2, Lock, Archive, Check } from "lucide-react";
import { IpStatus } from "@alfahd/types";
import { StatusBadge, type StatusBadgeConfig } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

export const IP_OPERATIONAL_STATUS_CONFIG: Record<IpStatus, StatusBadgeConfig> = {
  [IpStatus.FREE]: {
    label: "متاح (FREE)",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  [IpStatus.RESERVED]: {
    label: "محجوز (RESERVED)",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    icon: Lock,
  },
};

export const IP_ARCHIVED_STATUS_CONFIG: Record<"archived" | "active", StatusBadgeConfig> = {
  archived: {
    label: "مؤرشف",
    className:
      "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: Archive,
  },
  active: {
    label: "نشط",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
    icon: Check,
  },
};

export interface IpOperationalStatusBadgeProps {
  status: IpStatus;
  className?: string;
  testId?: string;
}

export function IpOperationalStatusBadge({
  status,
  className,
  testId,
}: IpOperationalStatusBadgeProps) {
  const config = IP_OPERATIONAL_STATUS_CONFIG[status];
  if (!config) return null;

  const defaultTestId =
    status === IpStatus.FREE ? "status-badge-free" : "status-badge-reserved";

  return (
    <StatusBadge
      config={config}
      className={className}
      data-testid={testId ?? defaultTestId}
    />
  );
}

export interface IpArchivedStatusBadgeProps {
  isArchived: boolean;
  className?: string;
  testId?: string;
}

export function IpArchivedStatusBadge({
  isArchived,
  className,
  testId,
}: IpArchivedStatusBadgeProps) {
  const config = isArchived
    ? IP_ARCHIVED_STATUS_CONFIG.archived
    : IP_ARCHIVED_STATUS_CONFIG.active;

  const defaultTestId = isArchived ? "status-badge-archived" : "status-badge-active";

  return (
    <StatusBadge
      config={config}
      className={className}
      data-testid={testId ?? defaultTestId}
    />
  );
}

export interface IpStatusBadgeProps {
  status: IpStatus;
  isArchived: boolean;
  className?: string;
}

export function IpStatusBadge({ status, isArchived, className }: IpStatusBadgeProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      data-testid="ip-status-badge-container"
    >
      <IpOperationalStatusBadge status={status} />
      <IpArchivedStatusBadge isArchived={isArchived} />
    </div>
  );
}
