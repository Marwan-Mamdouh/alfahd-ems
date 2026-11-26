"use client";

import { useMemo, useState } from "react";
import {
  Warehouse,
  Plus,
  RefreshCw,
} from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";
import { useAuthStore } from "@/core/auth/auth.store";
import { Role } from "@alfahd/types";
import {
  WarehouseTable,
  WarehouseForm,
  WarehouseDetail,
  WarehouseDeactivateDialog,
  WarehouseFilters,
} from "@/components/warehouses";

import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  useWarehouseStaff,
  useWarehouseStock,
  useWarehouseMovements,
  extractErrorMessage,
} from "@/core/query/use-warehouses";
import { useEmployeeLookup } from "@/core/query/use-employee-lookup";

import type {
  WarehouseRow,
  WarehouseFormValues,
  WarehouseStaffRow,
  WarehouseMovementRow,
  WarehouseStockRow,
  WarehouseFilter,
} from "@/components/warehouses/types";

type ViewMode = "list" | "create" | "edit" | "details";

function WarehousePreviewContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === Role.ADMIN;

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [filter, setFilter] = useState<WarehouseFilter>({ search: "", isActive: "all" });
  const [notification, setNotification] = useState<string | null>(null);
  const [warehouseToDeactivate, setWarehouseToDeactivate] = useState<WarehouseRow | null>(null);
  const [deactivationConflict, setDeactivationConflict] = useState<string | null>(null);

  // Live Query Hooks
  const {
    warehouses: rawWarehouses,
    isLoading: isLoadingWarehouses,
    error: warehousesError,
    refetch: refetchWarehouses,
  } = useWarehouses();

  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const deleteMutation = useDeleteWarehouse();

  // Selected warehouse sub-queries
  const { employees: managers, isLoading: isLoadingManagers } = useEmployeeLookup();

  const {
    employees: staffList,
    isLoading: isLoadingStaff,
    error: staffError,
    isForbidden: isStaffForbidden,
    refetch: refetchStaff,
  } = useWarehouseStaff(selectedWarehouseId ?? undefined, user?.role);

  const {
    stockItems,
    isLoading: isLoadingStock,
    error: stockError,
    refetch: refetchStock,
  } = useWarehouseStock(selectedWarehouseId ?? undefined);

  const {
    movements: rawMovements,
    isLoading: isLoadingMovements,
    error: movementsError,
    isForbidden: isMovementsForbidden,
    refetch: refetchMovements,
  } = useWarehouseMovements(selectedWarehouseId ?? undefined, user?.role);

  const warehouses: WarehouseRow[] = useMemo(
    () =>
      rawWarehouses.map((w) => ({
        id: w.id,
        name: w.name,
        address: w.address,
        latitude: w.latitude,
        longitude: w.longitude,
        geofenceRadiusMeters: w.geofenceRadiusMeters,
        managerId: w.managerId,
        isActive: w.isActive,
        staffCount: 0,
        itemCount: 0,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    [rawWarehouses]
  );

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === selectedWarehouseId) ?? null,
    [warehouses, selectedWarehouseId]
  );

  const selectedStaff: WarehouseStaffRow[] = useMemo(
    () =>
      staffList.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        status: s.status,
        isEligible: s.isEligible,
      })),
    [staffList]
  );

  const selectedStock: WarehouseStockRow[] = useMemo(
    () =>
      stockItems.map((s) => ({
        id: s.id,
        itemId: s.productId,
        itemName: `صنف ${s.productId.slice(0, 8)}`,
        model: "—",
        category: "مخزون",
        quantity: s.quantity,
        lowStockThreshold: 10,
      })),
    [stockItems]
  );

  const selectedMovements: WarehouseMovementRow[] = useMemo(
    () =>
      rawMovements.map((m) => ({
        id: m.id,
        itemName: `صنف ${m.productId.slice(0, 8)}`,
        type: m.movementType,
        quantity: m.quantity,
        createdAt: m.createdAt,
        performedBy: m.responsibleUserId,
      })),
    [rawMovements]
  );

  const filteredWarehouses = useMemo(() => {
    let result = warehouses;
    const term = (filter.search ?? "").trim().toLowerCase();
    if (term) {
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.address.toLowerCase().includes(term)
      );
    }
    if (filter.isActive === true) {
      result = result.filter((w) => w.isActive);
    } else if (filter.isActive === false) {
      result = result.filter((w) => !w.isActive);
    }
    return result;
  }, [warehouses, filter]);

  const stats = useMemo(
    () => ({
      total: warehouses.length,
      active: warehouses.filter((w) => w.isActive).length,
      inactive: warehouses.filter((w) => !w.isActive).length,
    }),
    [warehouses]
  );

  function openCreate() {
    setSelectedWarehouseId(null);
    setNotification(null);
    setDeactivationConflict(null);
    setViewMode("create");
  }

  function openEdit(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setNotification(null);
    setDeactivationConflict(null);
    setViewMode("edit");
  }

  function openDetails(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setNotification(null);
    setDeactivationConflict(null);
    setViewMode("details");
  }

  function backToList() {
    setSelectedWarehouseId(null);
    setViewMode("list");
  }

  function openDeactivateModal(warehouse: WarehouseRow) {
    setDeactivationConflict(null);
    setWarehouseToDeactivate(warehouse);
  }

  async function handleConfirmDeactivate(warehouseId: string) {
    setDeactivationConflict(null);
    try {
      await deleteMutation.mutateAsync(warehouseId);
      setNotification("تم تعطيل المخزن بنجاح.");
      setWarehouseToDeactivate(null);
      if (viewMode === "details") {
        backToList();
      }
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "تعذر تعطيل المخزن بسبب وجود أصناف نشطة أو فنيين أو أجهزة راوتر تابعة له."
      );
      setDeactivationConflict(msg);
      throw new Error(msg);
    }
  }

  async function handleWarehouseSubmit(values: WarehouseFormValues) {
    const name = values.name.trim();
    const address = values.address.trim();
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    const geofenceRadiusMeters = Number(values.geofenceRadiusMeters);
    const managerId = values.managerId.trim() || undefined;

    setDeactivationConflict(null);

    if (viewMode === "edit") {
      if (!selectedWarehouse) throw new Error("لم يتم العثور على المخزن.");
      await updateMutation.mutateAsync({
        id: selectedWarehouse.id,
        dto: {
          name,
          address,
          latitude,
          longitude,
          geofenceRadiusMeters,
          managerId,
        },
      });
      setNotification("تم تحديث بيانات المخزن بنجاح.");
    } else if (viewMode === "create") {
      await createMutation.mutateAsync({
        name,
        address,
        latitude,
        longitude,
        geofenceRadiusMeters,
        managerId,
      });
      setNotification("تمت إضافة المخزن بنجاح.");
    }

    backToList();
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <Warehouse className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">إدارة المخازن</h1>
              <p className="mt-1 text-sm text-white/80">
                شبكة المخازن ونقاط الإمداد والتوزيع — ربط مباشر مع قاعدة البيانات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetchWarehouses()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث
            </button>
            <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
              {warehouses.length} مخزن
            </span>
          </div>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300"
        >
          {notification}
        </div>
      )}

      {/* Statistics */}
      {viewMode === "list" && (
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
      )}

      {/* List View */}
      {viewMode === "list" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[280px]">
              <WarehouseFilters
                filter={filter}
                onFilterChange={setFilter}
                disabled={isLoadingWarehouses}
              />
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 shrink-0"
              >
                <Plus className="h-4 w-4" />
                إضافة مخزن
              </button>
            )}
          </div>

          <WarehouseTable
            warehouses={filteredWarehouses}
            isLoading={isLoadingWarehouses}
            error={warehousesError ? new Error(warehousesError) : null}
            onRetry={() => refetchWarehouses()}
            onWarehouseClick={openDetails}
            onEditClick={openEdit}
            onDeactivateClick={openDeactivateModal}
            canManage={isAdmin}
          />
        </section>
      )}

      {/* Create / Edit View */}
      {(viewMode === "create" || viewMode === "edit") && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <WarehouseForm
            key={viewMode === "edit" ? (selectedWarehouseId ?? "edit") : "create"}
            warehouse={viewMode === "edit" ? selectedWarehouse : null}
            managers={managers}
            isLoadingManagers={isLoadingManagers}
            onSubmit={handleWarehouseSubmit}
            onCancel={backToList}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </section>
      )}

      {/* Details View */}
      {viewMode === "details" && selectedWarehouse && (
        <WarehouseDetail
          warehouse={selectedWarehouse}
          managerName={selectedWarehouse.managerName}
          staff={selectedStaff}
          stock={selectedStock}
          movements={selectedMovements}
          isLoadingStaff={isLoadingStaff}
          isLoadingStock={isLoadingStock}
          isLoadingMovements={isLoadingMovements}
          staffError={staffError}
          stockError={stockError}
          movementsError={movementsError}
          isStaffForbidden={isStaffForbidden}
          isMovementsForbidden={isMovementsForbidden}
          onRetryStaff={() => refetchStaff()}
          onRetryStock={() => refetchStock()}
          onRetryMovements={() => refetchMovements()}
          onBack={backToList}
          onEdit={openEdit}
          onDeactivate={openDeactivateModal}
          canManage={isAdmin}
        />
      )}

      {/* Accessible Deactivation Dialog */}
      <WarehouseDeactivateDialog
        warehouse={warehouseToDeactivate}
        isOpen={Boolean(warehouseToDeactivate)}
        onClose={() => setWarehouseToDeactivate(null)}
        onConfirm={handleConfirmDeactivate}
        isPending={deleteMutation.isPending}
        conflict={deactivationConflict}
      />
    </div>
  );
}

export default function WarehousesPreviewPage() {
  return (
    <RoleGuard permission="warehouses.manage">
      <WarehousePreviewContent />
    </RoleGuard>
  );
}
