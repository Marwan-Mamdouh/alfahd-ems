"use client";

import { useMemo, useState } from "react";
import { Plus, Warehouse, RefreshCw } from "lucide-react";

import { WarehouseTable } from "./warehouse-table";
import { WarehouseForm } from "./warehouse-form";
import { WarehouseDetail } from "./warehouse-detail";
import { WarehouseDeactivateDialog } from "./warehouse-deactivate-dialog";
import { WarehouseFilters } from "./warehouse-filters";

import type {
  WarehouseRow,
  WarehouseFilter,
  WarehouseFormValues,
  WarehouseCapabilities,
  ManagerSelector,
  WarehouseStockRow,
  WarehouseStaffRow,
  WarehouseMovementRow,
} from "./types";

export interface WarehouseManagementProps {
  warehouses: WarehouseRow[];
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  capabilities?: WarehouseCapabilities;
  canManage?: boolean;
  managers?: ManagerSelector;
  isLoadingManagers?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  filter?: WarehouseFilter;
  onFilterChange?: (filter: WarehouseFilter) => void;
  onCreate?: (values: WarehouseFormValues) => Promise<void> | void;
  onUpdate?: (id: string, values: WarehouseFormValues) => Promise<void> | void;
  onDeactivate?: (id: string) => Promise<void> | void;
  isCreating?: boolean;
  isUpdating?: boolean;
  isDeactivating?: boolean;
  deactivateError?: string | null;
  deactivateConflict?: string | null;
  // Detail data passed when available
  selectedWarehouseStock?: WarehouseStockRow[];
  selectedWarehouseStaff?: WarehouseStaffRow[];
  selectedWarehouseMovements?: WarehouseMovementRow[];
  isLoadingStock?: boolean;
  isLoadingStaff?: boolean;
  isLoadingMovements?: boolean;
  stockError?: Error | string | null;
  staffError?: Error | string | null;
  movementsError?: Error | string | null;
  isStaffForbidden?: boolean;
  isMovementsForbidden?: boolean;
  onRetryStock?: () => void;
  onRetryStaff?: () => void;
  onRetryMovements?: () => void;
}

type ManagementView = "list" | "create" | "edit" | "detail";

export function WarehouseManagement({
  warehouses,
  isLoading = false,
  error = null,
  onRetry,
  capabilities = { create: true, edit: true, deactivate: true },
  canManage = false,
  managers,
  isLoadingManagers = false,
  page,
  pageSize = 10,
  total,
  onPageChange,
  filter: controlledFilter,
  onFilterChange: controlledOnFilterChange,
  onCreate,
  onUpdate,
  onDeactivate,
  isCreating = false,
  isUpdating = false,
  isDeactivating = false,
  deactivateError = null,
  deactivateConflict = null,
  selectedWarehouseStock = [],
  selectedWarehouseStaff = [],
  selectedWarehouseMovements = [],
  isLoadingStock = false,
  isLoadingStaff = false,
  isLoadingMovements = false,
  stockError = null,
  staffError = null,
  movementsError = null,
  isStaffForbidden = false,
  isMovementsForbidden = false,
  onRetryStock,
  onRetryStaff,
  onRetryMovements,
}: WarehouseManagementProps) {
  const [internalView, setInternalView] = useState<ManagementView>("list");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [internalFilter, setInternalFilter] = useState<WarehouseFilter>({
    search: "",
    isActive: "all",
  });
  const [warehouseToDeactivate, setWarehouseToDeactivate] = useState<WarehouseRow | null>(null);

  const activeFilter = controlledFilter ?? internalFilter;
  const handleFilterChange = controlledOnFilterChange ?? setInternalFilter;

  const canCreate = capabilities.create || canManage;

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === selectedWarehouseId) ?? null,
    [warehouses, selectedWarehouseId]
  );

  // Client-side filtering when server filter not fully driving array
  const filteredWarehouses = useMemo(() => {
    let result = warehouses;
    const term = (activeFilter.search ?? "").trim().toLowerCase();
    if (term) {
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.address.toLowerCase().includes(term)
      );
    }

    if (activeFilter.isActive === true) {
      result = result.filter((w) => w.isActive);
    } else if (activeFilter.isActive === false) {
      result = result.filter((w) => !w.isActive);
    }

    return result;
  }, [warehouses, activeFilter]);

  const stats = useMemo(() => {
    const totalCount = total ?? warehouses.length;
    const activeCount = warehouses.filter((w) => w.isActive).length;
    const inactiveCount = warehouses.filter((w) => !w.isActive).length;
    return { total: totalCount, active: activeCount, inactive: inactiveCount };
  }, [warehouses, total]);

  function handleCreateClick() {
    setSelectedWarehouseId(null);
    setInternalView("create");
  }

  function handleEditClick(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setInternalView("edit");
  }

  function handleDetailClick(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setInternalView("detail");
  }

  function handleBackToList() {
    setSelectedWarehouseId(null);
    setInternalView("list");
  }

  function handleDeactivateClick(warehouse: WarehouseRow) {
    setWarehouseToDeactivate(warehouse);
  }

  async function handleConfirmDeactivate(warehouseId: string) {
    if (onDeactivate) {
      await onDeactivate(warehouseId);
    }
  }

  async function handleFormSubmit(values: WarehouseFormValues) {
    if (internalView === "create" && onCreate) {
      await onCreate(values);
      handleBackToList();
    } else if (internalView === "edit" && selectedWarehouse && onUpdate) {
      await onUpdate(selectedWarehouse.id, values);
      handleBackToList();
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <Warehouse className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إدارة المستودعات ونقاط الإمداد</h1>
              <p className="mt-1 text-sm text-white/80">
                تهيئة المخازن، إدارة الإحداثيات، وتحديد نطاق السياج الجغرافي للموظفين
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                تحديث
              </button>
            )}
            <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
              {stats.total.toLocaleString("ar-EG")} مخزن
            </span>
          </div>
        </div>
      </div>

      {/* Main Views */}
      {internalView === "list" && (
        <div className="space-y-5">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: "إجمالي المخازن المسجلة",
                value: stats.total,
              },
              {
                title: "المخازن النشطة",
                value: stats.active,
              },
              {
                title: "المخازن المعطلة",
                value: stats.inactive,
              },
            ].map((stat) => (
              <div
                key={stat.title}
                className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                  <Warehouse className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold">{stat.value.toLocaleString("ar-EG")}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters and Add button */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[280px]">
              <WarehouseFilters
                filter={activeFilter}
                onFilterChange={handleFilterChange}
                disabled={isLoading}
              />
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={handleCreateClick}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-700 shrink-0"
              >
                <Plus className="h-4 w-4" />
                إضافة مخزن جديد
              </button>
            )}
          </div>

          {/* Table */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <WarehouseTable
              warehouses={filteredWarehouses}
              isLoading={isLoading}
              error={error}
              onRetry={onRetry}
              onWarehouseClick={handleDetailClick}
              onEditClick={handleEditClick}
              onDeactivateClick={handleDeactivateClick}
              canManage={canManage}
              capabilities={capabilities}
              page={page}
              pageSize={pageSize}
              total={total ?? warehouses.length}
              onPageChange={onPageChange}
            />
          </section>
        </div>
      )}

      {(internalView === "create" || internalView === "edit") && (
        <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <WarehouseForm
            key={internalView === "edit" ? (selectedWarehouseId ?? "edit") : "create"}
            warehouse={internalView === "edit" ? selectedWarehouse : null}
            managers={managers}
            isLoadingManagers={isLoadingManagers}
            onSubmit={handleFormSubmit}
            onCancel={handleBackToList}
            isSubmitting={isCreating || isUpdating}
          />
        </section>
      )}

      {internalView === "detail" && selectedWarehouse && (
        <WarehouseDetail
          warehouse={selectedWarehouse}
          managerName={selectedWarehouse.managerName}
          staff={selectedWarehouseStaff}
          stock={selectedWarehouseStock}
          movements={selectedWarehouseMovements}
          isLoadingStaff={isLoadingStaff}
          isLoadingStock={isLoadingStock}
          isLoadingMovements={isLoadingMovements}
          staffError={staffError}
          stockError={stockError}
          movementsError={movementsError}
          isStaffForbidden={isStaffForbidden}
          isMovementsForbidden={isMovementsForbidden}
          onRetryStaff={onRetryStaff}
          onRetryStock={onRetryStock}
          onRetryMovements={onRetryMovements}
          onBack={handleBackToList}
          onEdit={handleEditClick}
          onDeactivate={handleDeactivateClick}
          canManage={canManage}
          capabilities={capabilities}
        />
      )}

      {/* Deactivate Dialog */}
      <WarehouseDeactivateDialog
        warehouse={warehouseToDeactivate}
        isOpen={Boolean(warehouseToDeactivate)}
        onClose={() => setWarehouseToDeactivate(null)}
        onConfirm={handleConfirmDeactivate}
        isPending={isDeactivating}
        error={deactivateError}
        conflict={deactivateConflict}
      />
    </div>
  );
}
