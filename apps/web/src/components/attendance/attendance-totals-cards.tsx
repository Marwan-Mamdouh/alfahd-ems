"use client";

import React from "react";
import { Users, CheckCircle2, Clock3 } from "lucide-react";
import type { AttendanceTotals } from "./types";
import { cn } from "@/lib/utils";

export interface AttendanceTotalsCardsProps {
  totals?: AttendanceTotals | null;
  filteredTotal?: number | null;
  isLoading?: boolean;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  iconClassName: string;
  isLoading?: boolean;
  testId: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconClassName,
  isLoading,
  testId,
}: StatCardProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-all"
      dir="rtl"
      data-testid={testId}
    >
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {isLoading ? (
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
        ) : (
          <p className="text-3xl font-bold tracking-tight text-foreground">
            {value.toLocaleString("ar-EG")}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground/80">{subtitle}</p>
      </div>

      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          iconClassName
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
    </div>
  );
}

/**
 * Renders server-provided attendance totals across all matching records.
 *
 * IMPORTANT CONTRACT COMPLIANCE:
 * - Uses ONLY server-provided filteredTotal and totals.
 * - Represents all records matching the filters across pages, NOT just current-page rows.
 * - Never calculates authoritative totals from visible records.
 * - Never invents ABSENT records.
 */
export function AttendanceTotalsCards({
  totals,
  filteredTotal,
  isLoading = false,
  className,
}: AttendanceTotalsCardsProps) {
  // Use server totals directly, prioritizing filteredTotal if passed for the total count
  const effectiveTotal = filteredTotal ?? totals?.total ?? 0;
  const onTimeCount = totals?.onTime ?? 0;
  const lateCount = totals?.late ?? 0;

  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-3", className)}
      data-testid="attendance-totals-cards"
    >
      <StatCard
        title="إجمالي السجلات المطابقة"
        value={effectiveTotal}
        subtitle="شامل لكافة الصفحات بالمرشحات الحالية"
        icon={<Users className="h-6 w-6" />}
        iconClassName="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        isLoading={isLoading}
        testId="stat-total-records"
      />

      <StatCard
        title="في الموعد"
        value={onTimeCount}
        subtitle="مطابق لشرط الحضور في الوقت المحدد"
        icon={<CheckCircle2 className="h-6 w-6" />}
        iconClassName="bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
        isLoading={isLoading}
        testId="stat-on-time-records"
      />

      <StatCard
        title="المتأخرون"
        value={lateCount}
        subtitle="حالات الحضور المسجلة بعد الموعد"
        icon={<Clock3 className="h-6 w-6" />}
        iconClassName="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        isLoading={isLoading}
        testId="stat-late-records"
      />
    </div>
  );
}
