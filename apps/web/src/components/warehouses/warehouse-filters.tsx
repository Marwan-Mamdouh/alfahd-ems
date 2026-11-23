"use client";

import { Search, RotateCcw } from "lucide-react";
import type { WarehouseFilter } from "./types";

export interface WarehouseFiltersProps {
  filter: WarehouseFilter;
  onFilterChange: (filter: WarehouseFilter) => void;
  onReset?: () => void;
  disabled?: boolean;
}

export function WarehouseFilters({
  filter,
  onFilterChange,
  onReset,
  disabled = false,
}: WarehouseFiltersProps) {
  const search = filter.search ?? "";
  const isActive = filter.isActive ?? "all";

  function handleSearchChange(value: string) {
    onFilterChange({
      ...filter,
      search: value,
    });
  }

  function handleStatusChange(value: string) {
    let nextStatus: boolean | "all" = "all";
    if (value === "active") nextStatus = true;
    else if (value === "inactive") nextStatus = false;

    onFilterChange({
      ...filter,
      isActive: nextStatus,
    });
  }

  function handleReset() {
    if (onReset) {
      onReset();
    } else {
      onFilterChange({ search: "", isActive: "all" });
    }
  }

  const statusValue = isActive === true ? "active" : isActive === false ? "inactive" : "all";

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"
      dir="rtl"
    >
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            disabled={disabled}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="ابحث باسم المخزن أو العنوان..."
            aria-label="البحث في المخازن"
            className="h-10 w-full rounded-lg border bg-background pr-9 pl-3 text-sm outline-none transition-colors focus:border-teal-500 disabled:opacity-50"
          />
        </div>

        {/* Status Filter */}
        <div className="w-40">
          <select
            value={statusValue}
            disabled={disabled}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="تصفية حسب حالة المخزن"
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 disabled:opacity-50"
          >
            <option value="all">كافة الحالات</option>
            <option value="active">المخازن النشطة فقط</option>
            <option value="inactive">المخازن المعطلة فقط</option>
          </select>
        </div>
      </div>

      {/* Reset */}
      {(search || isActive !== "all") && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleReset}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          إعادة التعيين
        </button>
      )}
    </div>
  );
}
