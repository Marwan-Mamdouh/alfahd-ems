"use client";

import { useMemo } from "react";
import { Users, CheckCircle2, XCircle } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import { roleLabel } from "@/core/auth/role-labels";

import type { Role } from "@alfahd/types";
import type { WarehouseStaffRow } from "./types";

interface WarehouseStaffTableProps {
  staff: WarehouseStaffRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function WarehouseStaffTable({
  staff,
  isLoading = false,
  error,
  onRetry,
}: WarehouseStaffTableProps) {
  const columns = useMemo<ColumnDef<WarehouseStaffRow>[]>(
    () => [
      {
        key: "name",
        header: "اسم الموظف",
        render: (row) => (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Users className="h-4 w-4" />
            </span>
            <span className="font-semibold text-foreground">{row.name}</span>
          </div>
        ),
      },
      {
        key: "role",
        header: "الدور الوظيفي",
        render: (row) => (
          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {roleLabel(row.role as Role)}
          </span>
        ),
      },
      {
        key: "status",
        header: "الحالة والأهلية",
        render: (row) => {
          const isEligible = row.isEligible ?? true;
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isEligible
                  ? "border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
                  : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              {isEligible ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {row.status ?? (isEligible ? "مؤهل" : "غير مؤهل")}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={staff}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(row) => row.id}
      emptyTitle="لا يوجد موظفون"
      emptyDescription="لم يتم تعيين أي موظفين لهذا المخزن حاليًا."
    />
  );
}
