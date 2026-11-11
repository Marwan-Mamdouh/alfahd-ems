"use client";

import { useMemo } from "react";
import {
  Router as RouterIcon,
  Eye,
  MapPin,
  UserRound,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Building2,
} from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import type { RouterRow, RouterStatus, RouterPhysicalCondition } from "./types";

interface RouterTableProps {
  routers: RouterRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onRouterClick?: (router: RouterRow) => void;
}

const STATUS_CONFIG: Record<
  RouterStatus,
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "متاح بالمخزن",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  },
  ASSIGNED_TO_TECHNICIAN: {
    label: "بعهدة الفني",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  },
  INSTALLED_AT_CUSTOMER: {
    label: "مركب لدى عميل",
    className:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
  },
  RETURNED: {
    label: "مرتجع للمخزن",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  DAMAGED: {
    label: "تالف",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  },
  UNDER_REPAIR: {
    label: "قيد الصيانة",
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  },
  LOST: {
    label: "مفقود",
    className:
      "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
  },
  DECOMMISSIONED: {
    label: "مكهن / خارج الخدمة",
    className:
      "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

const CONDITION_CONFIG: Record<
  RouterPhysicalCondition,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  SERVICEABLE: {
    label: "سليم",
    icon: CheckCircle2,
    className: "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 border-teal-200",
  },
  DAMAGED: {
    label: "تالف",
    icon: AlertTriangle,
    className: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200",
  },
  UNDER_REPAIR: {
    label: "قيد الإصلاح",
    icon: Wrench,
    className: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200",
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
        header: "السيريال والموديل",
        render: (router) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <RouterIcon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="font-mono font-semibold text-foreground" dir="ltr">
                {router.serialNumber}
              </p>

              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {router.productName} {router.productModel ? `(${router.productModel})` : ""}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "حالة الدورة",
        render: (router) => {
          const config = STATUS_CONFIG[router.status] ?? {
            label: router.status,
            className: "border-gray-200 bg-gray-50 text-gray-700",
          };

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
        key: "physicalCondition",
        header: "الحالة الفيزيائية",
        render: (router) => {
          const config = CONDITION_CONFIG[router.physicalCondition] ?? {
            label: router.physicalCondition,
            icon: CheckCircle2,
            className: "text-gray-700 bg-gray-50 border-gray-200",
          };
          const Icon = config.icon;

          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${config.className}`}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </span>
          );
        },
      },
      {
        key: "warehouseName",
        header: "الموقع الفيزيائي",
        render: (router) => (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {router.warehouseName || router.externalLocation || "—"}
          </span>
        ),
      },
      {
        key: "currentHolderType",
        header: "العهدة الحالية",
        hideOnMobile: true,
        render: (router) => {
          if (!router.currentHolderType) {
            return <span className="text-xs text-muted-foreground">بدون عهدة</span>;
          }
          if (router.currentHolderType === "WAREHOUSE") {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-teal-600" />
                عهدة المخزن ({router.warehouseName ?? "المخزن"})
              </span>
            );
          }
          if (router.currentHolderType === "TECHNICIAN") {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                <UserRound className="h-3.5 w-3.5" />
                {router.currentHolderName || `فني (${router.currentHolderId?.slice(0, 8)})`}
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              مركب لدى عميل
            </span>
          );
        },
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
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
          >
            <Eye className="h-3.5 w-3.5" />
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
      emptyDescription="لم يتم تسجيل أي أجهزة راوتر مطابقة لمعايير البحث الحالية."
    />
  );
}
