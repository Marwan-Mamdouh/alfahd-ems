"use client";

import { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Camera,
  UserCheck,
  User as UserIcon,
} from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import { Button } from "@/components/ui/button";
import { EmployeeStatusBadge } from "./employee-status-badge";
import type { EmployeeRow, ServerPaginationProps } from "./types";

export type { EmployeeRow };

interface EmployeeTableProps {
  employees: EmployeeRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onEmployeeClick?: (employee: EmployeeRow) => void;
  onViewDetails?: (employee: EmployeeRow) => void;
  onEdit?: (employee: EmployeeRow) => void;
  onChangeStatus?: (employee: EmployeeRow) => void;
  onUploadPhoto?: (employee: EmployeeRow) => void;
  canEdit?: boolean;
  canChangeStatus?: boolean;
  canUploadPhoto?: boolean;
  pagination?: ServerPaginationProps;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  MANAGEMENT: "الإدارة",
  TECHNICAL: "القسم الفني",
  CUSTOMER_SERVICE: "خدمة العملاء",
  WAREHOUSE: "المخازن",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  WAREHOUSE_STAFF: "مسؤول مخزن",
  CS: "خدمة عملاء",
  TECHNICIAN: "فني ميداني",
};

export function EmployeeTable({
  employees,
  isLoading = false,
  error,
  onRetry,
  onEmployeeClick,
  onViewDetails,
  onEdit,
  onChangeStatus,
  onUploadPhoto,
  canEdit = true,
  canChangeStatus = true,
  canUploadPhoto = true,
  pagination,
}: EmployeeTableProps) {
  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      {
        key: "name",
        header: "الموظف",
        className: "font-semibold",
        render: (row) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              {row.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.profilePhotoUrl}
                  alt={row.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="font-semibold text-foreground">{row.name}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {row.email}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "phone",
        header: "رقم الهاتف",
        hideOnMobile: true,
        render: (row) => (
          <span dir="ltr" className="text-xs text-muted-foreground">
            {row.phone || "—"}
          </span>
        ),
      },
      {
        key: "department",
        header: "القسم",
        render: (row) => (row.department ? DEPARTMENT_LABELS[row.department] ?? row.department : "—"),
      },
      {
        key: "role",
        header: "الدور",
        hideOnMobile: true,
        render: (row) => ROLE_LABELS[row.role] ?? row.role,
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
      {
        key: "actions",
        header: "الإجراءات",
        className: "text-center whitespace-nowrap",
        render: (row) => {
          return (
            <div
              className="flex items-center justify-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {onViewDetails && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(row)}
                  title="عرض التفاصيل"
                  aria-label={`عرض تفاصيل ${row.name}`}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}

              {canEdit && onEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(row)}
                  title="تعديل البيانات"
                  aria-label={`تعديل بيانات ${row.name}`}
                  className="h-8 w-8 p-0 text-teal-600 hover:text-teal-700 dark:text-teal-400"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}

              {canChangeStatus && onChangeStatus && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChangeStatus(row)}
                  title="تغيير الحالة"
                  aria-label={`تغيير حالة ${row.name}`}
                  className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                >
                  <UserCheck className="h-4 w-4" />
                </Button>
              )}

              {canUploadPhoto && onUploadPhoto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onUploadPhoto(row)}
                  title="رفع / تحديث الصورة"
                  aria-label={`تحديث صورة ${row.name}`}
                  className="h-8 w-8 p-0 text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [
      onViewDetails,
      canEdit,
      onEdit,
      canChangeStatus,
      onChangeStatus,
      canUploadPhoto,
      onUploadPhoto,
    ]
  );

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const currentPage = pagination?.page ?? 1;

  return (
    <div className="space-y-4" dir="rtl">
      <DataTable
        columns={columns}
        data={employees}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        getRowKey={(employee) => employee.id}
        onRowClick={onEmployeeClick}
        emptyTitle="لا يوجد موظفون"
        emptyDescription="لم يتم العثور على أي موظفين يطابقون محددات البحث الحالية."
      />

      {/* Server Pagination Controls */}
      {pagination && (
        <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row">
          <div>
            إجمالي النتائج: <span className="font-semibold text-foreground">{pagination.total}</span>{" "}
            موظف (صفحة {currentPage} من {totalPages})
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || currentPage <= 1}
              onClick={() => pagination.onPageChange(currentPage - 1)}
              aria-label="الصفحة السابقة"
              className="gap-1"
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>

            <span className="px-2 text-xs font-medium">
              {currentPage} / {totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || currentPage >= totalPages}
              onClick={() => pagination.onPageChange(currentPage + 1)}
              aria-label="الصفحة التالية"
              className="gap-1"
            >
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
