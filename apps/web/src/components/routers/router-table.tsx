"use client";

import { useMemo } from "react";
import { Router as RouterIcon, Eye, MapPin, UserRound } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import type { RouterRow, RouterStatus } from "./types";

interface RouterTableProps {
  routers: RouterRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onRouterClick?: (router: RouterRow) => void;
}

const STATUS_CONFIG: Record<RouterStatus, { label: string; className: string }> = {
  IN_STOCK: {
    label: "بالمخزن",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  },
  ASSIGNED: {
    label: "مخصص لفني",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  INSTALLED: {
    label: "تم التركيب",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  },
  RETURNED: {
    label: "مرتجع",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  DAMAGED: {
    label: "تالف",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  },
};

export function RouterTable({
  routers,
  isLoading = false,
  error,
  onRetry,
  onRouterClick,
}: RouterTableProps) {
  const columns = useMemo<ColumnDef<RouterRow>[]>(
    () => [
      {
        key: "serialNumber",
        header: "السيريال نمبر",
        render: (router) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <RouterIcon className="h-5 w-5" />
            </div>

            <div>
              <p className="font-mono font-semibold text-foreground" dir="ltr">
                {router.serialNumber}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {router.brand} — {router.model}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "الحالة",
        render: (router) => {
          const config = STATUS_CONFIG[router.status];

          return (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${config.className}`}
            >
              {config.label}
            </span>
          );
        },
      },
      {
        key: "warehouseName",
        header: "المخزن",
        render: (router) => (
          <span className="inline-flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {router.warehouseName || "—"}
          </span>
        ),
      },
      {
        key: "assignedToName",
        header: "المسؤول",
        hideOnMobile: true,
        render: (router) => (
          <span className="inline-flex items-center gap-2 text-sm">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            {router.assignedToName || "غير مخصص"}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: "تاريخ التسجيل",
        hideOnMobile: true,
        render: (router) => {
          const date = new Date(router.createdAt);

          if (Number.isNaN(date.getTime())) return "—";

          return new Intl.DateTimeFormat("ar-EG", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "Africa/Cairo",
          }).format(date);
        },
      },
      {
        key: "actions",
        header: "التفاصيل",
        render: (router) => (
          <button
            type="button"
            disabled={!onRouterClick}
            onClick={(event) => {
              event.stopPropagation();
              onRouterClick?.(router);
            }}
            aria-label={`عرض تفاصيل الراوتر ${router.serialNumber}`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
          >
            <Eye className="h-4 w-4" />
            عرض
          </button>
        ),
      },
    ],
    [onRouterClick]
  );

  return (
    <DataTable
      columns={columns}
      data={routers}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(router) => router.id}
      onRowClick={onRouterClick}
      emptyTitle="لا توجد أجهزة راوتر"
      emptyDescription="لم يتم تسجيل أي أجهزة راوتر حتى الآن."
    />
  );
}
