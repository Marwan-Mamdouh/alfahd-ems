"use client";

import { useMemo } from "react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import { EmployeeStatusBadge } from "./employee-status-badge";

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string;
  role: string;
  warehouseName: string | null;
  status: "ACTIVE" | "INACTIVE";
}

interface EmployeeTableProps {
  employees: EmployeeRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onEmployeeClick?: (employee: EmployeeRow) => void;
}

export function EmployeeTable({
  employees,
  isLoading = false,
  error,
  onRetry,
  onEmployeeClick,
}: EmployeeTableProps) {
  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      {
        key: "name",
        header: "اسم الموظف",
        className: "font-semibold",
      },
      {
        key: "email",
        header: "البريد الإلكتروني",
      },
      {
        key: "phone",
        header: "رقم الهاتف",
        hideOnMobile: true,
        render: (row) => row.phone || "—",
      },
      {
        key: "department",
        header: "القسم",
      },
      {
        key: "role",
        header: "الدور",
        hideOnMobile: true,
      },
      {
        key: "warehouseName",
        header: "المخزن",
        hideOnMobile: true,
        render: (row) => row.warehouseName || "—",
      },
      {
        key: "status",
        header: "الحالة",
        render: (row) => <EmployeeStatusBadge status={row.status} />,
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={employees}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      getRowKey={(employee) => employee.id}
      onRowClick={onEmployeeClick}
      emptyTitle="لا يوجد موظفون"
      emptyDescription="لم تتم إضافة أي موظفين حتى الآن."
    />
  );
}
