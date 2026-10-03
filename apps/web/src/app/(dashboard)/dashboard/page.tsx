// src/app/(dashboard)/dashboard/page.tsx

"use client";

import type { UserDto } from "@alfahd/types";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";
import { fetchUsers, USERS_QUERY_KEY } from "@/core/api/users";

/**
 * Three metrics derived from `GET /users`, plus KPI slots that have **no** data
 * source (R7). Tickets and inventory alerts are placeholders, not errors: there
 * is no backend endpoint for them in this feature.
 */
type Metrics = {
  totalUsers: number | null;
  activeUsers: number | null;
  activeTechnicians: number | null;
};

/**
 * A real KPI with no data yet renders the same `—` as a placeholder, so "no data
 * source" and "zero records" look identical here. That is deliberate (FR-023):
 * the users page carries the precise empty-state signal instead.
 */
const EMPTY_METRICS: Metrics = {
  totalUsers: null,
  activeUsers: null,
  activeTechnicians: null,
};

function deriveMetrics(users: UserDto[]): Metrics {
  if (users.length === 0) return EMPTY_METRICS;

  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive === true).length,
    activeTechnicians: users.filter((u) => u.role === "TECHNICIAN" && u.isActive === true).length,
  };
}

export default function DashboardPage() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: fetchUsers,
  });

  const metrics = data ? deriveMetrics(data) : EMPTY_METRICS;

  return (
    <RoleGuard permission="dashboard.view">
      <div className="space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 px-6 py-8 text-white shadow-sm">
          <div className="relative z-10">
            <p className="mb-2 text-sm font-medium text-teal-100">نظرة عامة</p>

            <h1 className="text-2xl font-bold md:text-3xl">لوحة التحكم</h1>

            <p className="mt-2 max-w-xl text-sm text-teal-50/80">
              تابع أهم مؤشرات النظام والبيانات الرئيسية من مكان واحد.
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -left-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 left-24 h-40 w-40 rounded-full bg-white/5" />
        </div>

        {/* KPI Cards — each card owns its own loading/error state; the two
            placeholder KPIs never retry (R8: no retry on a no-data-source card). */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            title="إجمالي المستخدمين"
            value={metrics.totalUsers}
            isLoading={isPending}
            onRetry={isError ? () => void refetch() : undefined}
            isRetrying={isFetching}
          />

          <KpiCard
            title="مستخدمون نشطون"
            value={metrics.activeUsers}
            isLoading={isPending}
            onRetry={isError ? () => void refetch() : undefined}
            isRetrying={isFetching}
          />

          <KpiCard
            title="فنيون نشطون"
            value={metrics.activeTechnicians}
            isLoading={isPending}
            onRetry={isError ? () => void refetch() : undefined}
            isRetrying={isFetching}
          />

          {/* No data source in this feature — a static placeholder with NO
              retry control (R8). */}
          <KpiCard title="تذاكر مفتوحة" value={null} />

          <KpiCard title="تنبيهات المخزون" value={null} />
        </div>
      </div>
    </RoleGuard>
  );
}

function KpiCard({
  title,
  value,
  isLoading,
  onRetry,
  isRetrying,
}: {
  title: string;
  value: number | null;
  isLoading?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-teal-100/80 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-md">
      {/* Accent */}
      <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-teal-500 to-teal-700" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>

          {isLoading ? (
            <div
              className="mt-3 h-9 w-16 animate-pulse rounded-md bg-teal-100 dark:bg-teal-900/40"
              aria-hidden
            />
          ) : onRetry ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">تعذّر التحميل</p>

              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-transparent dark:text-red-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                إعادة المحاولة
              </button>
            </div>
          ) : (
            /* `—` is the shared "no value" mark for both a placeholder KPI and an
                empty dataset. Neither offers a retry control (R8). */
            <p className="mt-3 text-3xl font-bold text-teal-700 dark:text-teal-400">
              {value ?? "—"}
            </p>
          )}
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/50">
          <span className="h-2.5 w-2.5 rounded-full bg-teal-600 shadow-[0_0_0_5px_rgba(13,148,136,0.10)]" />
        </div>
      </div>
    </div>
  );
}
