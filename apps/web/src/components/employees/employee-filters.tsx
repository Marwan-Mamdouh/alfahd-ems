"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EmployeeFiltersValue, WarehouseOption } from "./types";
import { EMPLOYEE_STATUS_OPTIONS } from "./employee-status-badge";

export type { EmployeeFiltersValue };

interface EmployeeFiltersProps {
  value: EmployeeFiltersValue;
  onChange: (value: EmployeeFiltersValue) => void;
  warehouses?: WarehouseOption[];
  isLoading?: boolean;
}

export const EMPLOYEE_DEPARTMENTS = [
  { value: "MANAGEMENT", label: "الإدارة" },
  { value: "TECHNICAL", label: "القسم الفني" },
  { value: "CUSTOMER_SERVICE", label: "خدمة العملاء" },
  { value: "WAREHOUSE", label: "المخازن" },
];

export const EMPLOYEE_ROLES = [
  { value: "ADMIN", label: "مدير النظام (ADMIN)" },
  { value: "WAREHOUSE_STAFF", label: "مسؤول مخزن (WAREHOUSE_STAFF)" },
  { value: "CS", label: "خدمة عملاء (CS)" },
  { value: "TECHNICIAN", label: "فني ميداني (TECHNICIAN)" },
];

export function EmployeeFilters({
  value,
  onChange,
  warehouses = [],
  isLoading = false,
}: EmployeeFiltersProps) {
  const update = (field: keyof EmployeeFiltersValue, newValue: string) => {
    onChange({ ...value, [field]: newValue });
  };

  const hasFilters = Object.values(value).some(Boolean);

  const reset = () => {
    onChange({
      search: "",
      department: "",
      role: "",
      status: "",
      warehouseId: "",
    });
  };

  const selectClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="بحث بالاسم، البريد، أو الرقم القومي..."
            aria-label="البحث عن موظف"
            disabled={isLoading}
            className="pr-9"
          />
        </div>

        {/* Department Filter */}
        <div>
          <select
            value={value.department}
            onChange={(event) => update("department", event.target.value)}
            aria-label="تصفية حسب القسم"
            disabled={isLoading}
            className={selectClass}
          >
            <option value="">كل الأقسام</option>
            {EMPLOYEE_DEPARTMENTS.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>

        {/* Role Filter */}
        <div>
          <select
            value={value.role}
            onChange={(event) => update("role", event.target.value)}
            aria-label="تصفية حسب الدور"
            disabled={isLoading}
            className={selectClass}
          >
            <option value="">كل الأدوار</option>
            {EMPLOYEE_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={value.status}
            onChange={(event) => update("status", event.target.value)}
            aria-label="تصفية حسب الحالة"
            disabled={isLoading}
            className={selectClass}
          >
            <option value="">كل الحالات</option>
            {EMPLOYEE_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Warehouse Filter (if warehouses supplied) */}
        <div>
          <select
            value={value.warehouseId ?? ""}
            onChange={(event) => update("warehouseId", event.target.value)}
            aria-label="تصفية حسب المخزن"
            disabled={isLoading || warehouses.length === 0}
            className={selectClass}
          >
            <option value="">كل المخازن</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={isLoading}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="ml-1 h-3.5 w-3.5" />
            مسح جميع الفلاتر
          </Button>
        </div>
      )}
    </div>
  );
}
