"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface EmployeeFiltersValue {
  search: string;
  department: string;
  role: string;
  status: string;
}

interface EmployeeFiltersProps {
  value: EmployeeFiltersValue;
  onChange: (value: EmployeeFiltersValue) => void;
}

const DEPARTMENTS = [
  { value: "WAREHOUSE", label: "المخازن" },
  { value: "TECHNICAL", label: "الفنيون" },
  { value: "CUSTOMER_SERVICE", label: "خدمة العملاء" },
  { value: "MANAGEMENT", label: "الإدارة" },
];

const ROLES = [
  { value: "ADMIN", label: "مدير النظام" },
  { value: "WAREHOUSE_STAFF", label: "موظف مخزن" },
  { value: "CS", label: "خدمة العملاء" },
  { value: "TECHNICIAN", label: "فني" },
];

const STATUSES = [
  { value: "ACTIVE", label: "نشط" },
  { value: "INACTIVE", label: "غير نشط" },
];

export function EmployeeFilters({ value, onChange }: EmployeeFiltersProps) {
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
    });
  };

  const selectClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />

          <Input
            value={value.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            aria-label="البحث عن موظف"
            className="pr-9"
          />
        </div>

        <select
          value={value.department}
          onChange={(event) => update("department", event.target.value)}
          aria-label="تصفية حسب القسم"
          className={selectClass}
        >
          <option value="">كل الأقسام</option>
          {DEPARTMENTS.map((department) => (
            <option key={department.value} value={department.value}>
              {department.label}
            </option>
          ))}
        </select>

        <select
          value={value.role}
          onChange={(event) => update("role", event.target.value)}
          aria-label="تصفية حسب الدور"
          className={selectClass}
        >
          <option value="">كل الأدوار</option>
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>

        <select
          value={value.status}
          onChange={(event) => update("status", event.target.value)}
          aria-label="تصفية حسب الحالة"
          className={selectClass}
        >
          <option value="">كل الحالات</option>
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <X className="h-4 w-4" />
            مسح الفلاتر
          </Button>
        </div>
      )}
    </div>
  );
}
