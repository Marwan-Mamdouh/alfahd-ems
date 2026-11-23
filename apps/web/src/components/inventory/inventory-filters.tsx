"use client";

import { Search, RotateCcw } from "lucide-react";
import type { MovementFilter, SelectOption, InventoryMovementType } from "./types";

export interface InventoryFiltersProps {
  filter: MovementFilter;
  warehouses?: SelectOption[];
  onFilterChange: (filter: MovementFilter) => void;
  onReset?: () => void;
  disabled?: boolean;
}

export function InventoryFilters({
  filter,
  warehouses = [],
  onFilterChange,
  onReset,
  disabled = false,
}: InventoryFiltersProps) {
  const search = filter.search ?? "";
  const warehouseId = filter.warehouseId ?? "all";
  const movementType = filter.movementType ?? "all";

  function handleSearchChange(value: string) {
    onFilterChange({
      ...filter,
      search: value,
    });
  }

  function handleWarehouseChange(value: string) {
    onFilterChange({
      ...filter,
      warehouseId: value === "all" ? undefined : value,
    });
  }

  function handleTypeChange(value: string) {
    onFilterChange({
      ...filter,
      movementType: value === "all" ? "all" : (value as InventoryMovementType),
    });
  }

  function handleReset() {
    if (onReset) {
      onReset();
    } else {
      onFilterChange({ search: "", warehouseId: undefined, movementType: "all" });
    }
  }

  const hasActiveFilters = Boolean(search || (warehouseId && warehouseId !== "all") || (movementType && movementType !== "all"));

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm"
      dir="rtl"
    >
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            disabled={disabled}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="ابحث باسم الصنف أو المورد أو الملاحظات..."
            aria-label="البحث في حركات المخزون"
            className="h-10 w-full rounded-lg border bg-background pr-9 pl-3 text-sm outline-none transition-colors focus:border-teal-500 disabled:opacity-50"
          />
        </div>

        {/* Warehouse Filter */}
        {warehouses.length > 0 && (
          <div className="w-44">
            <select
              value={warehouseId}
              disabled={disabled}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              aria-label="تصفية حسب المخزن"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 disabled:opacity-50"
            >
              <option value="all">كافة المخازن</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Movement Type Filter */}
        <div className="w-44">
          <select
            value={movementType}
            disabled={disabled}
            onChange={(e) => handleTypeChange(e.target.value)}
            aria-label="تصفية حسب نوع الحركة"
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-teal-500 disabled:opacity-50"
          >
            <option value="all">كافة الحركات</option>
            <option value="INBOUND_SUPPLIER">وارد مورد</option>
            <option value="OUTBOUND_TECHNICIAN">صرف لفني</option>
            <option value="RETURN_TECHNICIAN">مرتجع فني</option>
            <option value="TRANSFER_WAREHOUSE">تحويل مخزني</option>
            <option value="ADJUSTMENT">تسوية جردية</option>
          </select>
        </div>
      </div>

      {/* Reset */}
      {hasActiveFilters && (
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
