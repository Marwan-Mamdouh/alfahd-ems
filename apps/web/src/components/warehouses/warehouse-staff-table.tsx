"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";

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
        key: "email",
        header: "البريد الإلكتروني",
        render: (row) => (
          <span dir="ltr" className="inline-block text-sm">
            {row.email}
          </span>
        ),
      },
      {
        key: "role",
        header: "الدور",
        render: (row) => roleLabel(row.role as Role),
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
      emptyTitle="لا يوجد موظفون تابعون لهذا المخزن"
      emptyDescription="لم يتم تعيين أي موظفين لهذا المخزن حتى الآن."
    />
  );
}
