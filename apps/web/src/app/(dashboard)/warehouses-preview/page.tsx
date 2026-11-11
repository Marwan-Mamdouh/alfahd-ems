"use client";

import { useMemo, useState } from "react";
import {
  Warehouse,
  Plus,
  ArrowRight,
  MapPin,
  Users,
  Package,
  Pencil,
  History,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";
import { useAuthStore } from "@/core/auth/auth.store";
import { Role } from "@alfahd/types";
import { WarehouseTable } from "@/components/warehouses/warehouse-table";
import { WarehouseForm } from "@/components/warehouses/warehouse-form";
import { WarehouseStaffTable } from "@/components/warehouses/warehouse-staff-table";
import { WarehouseMovementsTable } from "@/components/warehouses/warehouse-movements-table";
import {
  WarehouseStockTable,
  type WarehouseStockRow,
} from "@/components/warehouses/warehouse-stock-table";

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

import type {
  WarehouseRow,
  WarehouseFormValues,
  WarehouseStaffRow,
  WarehouseMovementRow,
} from "@/components/warehouses/types";

type ViewMode = "list" | "create" | "edit" | "details";

function WarehousePreviewContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === Role.ADMIN;

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState<string | null>(null);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);

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

  const lowStockItems = selectedStock.filter((item) => item.quantity <= item.lowStockThreshold);

  const filteredWarehouses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return warehouses;
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.address.toLowerCase().includes(term)
    );
  }, [warehouses, search]);

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
    setDeactivationError(null);
    setViewMode("create");
  }

  function openEdit(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setNotification(null);
    setDeactivationError(null);
    setViewMode("edit");
  }

  function openDetails(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setNotification(null);
    setDeactivationError(null);
    setViewMode("details");
  }

  function backToList() {
    setSelectedWarehouseId(null);
    setViewMode("list");
  }

  async function handleDeactivateWarehouse(warehouse: WarehouseRow) {
    const confirmed = window.confirm(
      `هل أنت متأكد من رغبتك في تعطيل ${warehouse.name}؟ لن يمكن استخدامه في عمليات الصرف والاستلام الجديدة.`
    );
    if (!confirmed) return;

    setDeactivationError(null);
    try {
      await deleteMutation.mutateAsync(warehouse.id);
      setNotification(`تم تعطيل ${warehouse.name} بنجاح.`);
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "فشل تعطيل المخزن. يرجى التحقق من عدم وجود أصناف نشطة أو فنيين أو أجهزة راوتر تابعة له."
      );
      setDeactivationError(msg);
    }
  }

  async function handleWarehouseSubmit(values: WarehouseFormValues) {
    const name = values.name.trim();
    const address = values.address.trim();
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    const geofenceRadiusMeters = Number(values.geofenceRadiusMeters);
    const managerId = values.managerId.trim() || undefined;

    setDeactivationError(null);

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

      {/* 409 Conflict Deactivation Blocker Alert */}
      {deactivationError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">تعذر تعطيل المخزن (تعارض في البيانات)</p>
            <p className="mt-1 text-sm">{deactivationError}</p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            title: "إجمالي المخازن المسجلة",
            value: stats.total,
            icon: Warehouse,
          },
          {
            title: "المخازن النشطة",
            value: stats.active,
            icon: Users,
          },
          {
            title: "المخازن المعطلة",
            value: stats.inactive,
            icon: Package,
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value.toLocaleString("ar-EG")}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* List View */}
      {viewMode === "list" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">قائمة المخازن</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                عرض تفاصيل المخازن وإحداثياتها ونطاق السياج الجغرافي.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                إضافة مخزن
              </button>
            )}
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المخزن أو العنوان..."
            aria-label="البحث عن مخزن"
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-teal-500 sm:max-w-md"
          />

          <WarehouseTable
            warehouses={filteredWarehouses}
            isLoading={isLoadingWarehouses}
            error={warehousesError ? new Error(warehousesError) : null}
            onRetry={() => refetchWarehouses()}
            onWarehouseClick={openDetails}
            onDeactivateClick={handleDeactivateWarehouse}
            canManage={isAdmin}
          />
        </section>
      )}

      {/* Create / Edit View */}
      {(viewMode === "create" || viewMode === "edit") && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة إلى المخازن
          </button>

          <WarehouseForm
            key={viewMode === "edit" ? (selectedWarehouseId ?? "edit") : "create"}
            warehouse={viewMode === "edit" ? selectedWarehouse : null}
            onSubmit={handleWarehouseSubmit}
            onCancel={backToList}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </section>
      )}

      {/* Details View */}
      {viewMode === "details" && selectedWarehouse && (
        <div className="space-y-6">
          <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              <ArrowRight className="h-4 w-4" />
              العودة إلى المخازن
            </button>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{selectedWarehouse.name}</h2>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedWarehouse.isActive
                        ? "border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
                        : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {selectedWarehouse.isActive ? "نشط" : "معطل"}
                  </span>
                </div>

                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {selectedWarehouse.address}
                </p>
              </div>

              {isAdmin && selectedWarehouse.isActive && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(selectedWarehouse)}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <Pencil className="h-4 w-4" />
                    تعديل المخزن
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeactivateWarehouse(selectedWarehouse)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    تعطيل المخزن
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">خط العرض (Latitude)</p>
                <p className="mt-2 font-mono text-lg" dir="ltr">
                  {selectedWarehouse.latitude}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">خط الطول (Longitude)</p>
                <p className="mt-2 font-mono text-lg" dir="ltr">
                  {selectedWarehouse.longitude}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">السياج الجغرافي للحضور</p>
                <p className="mt-2 flex items-center gap-1.5 font-bold text-lg text-teal-700 dark:text-teal-300">
                  <ShieldAlert className="h-5 w-5" />
                  {selectedWarehouse.geofenceRadiusMeters ?? 150} متر
                </p>
              </div>
            </div>
          </section>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">تنبيه انخفاض المخزون</p>
                <p className="mt-1 text-sm">
                  يوجد {lowStockItems.length} صنف يحتاج إلى مراجعة مستوى المخزون، بما في ذلك الأصناف
                  التي نفدت كميتها.
                </p>
              </div>
            </div>
          )}

          {/* Current Stock */}
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-teal-600" />
                <div>
                  <h3 className="text-lg font-semibold">المخزون الحالي بالمستودع</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    الأصناف المتاحة والكميات المسجلة داخل المستودع.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refetchStock()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                تحديث
              </button>
            </div>

            <WarehouseStockTable
              items={selectedStock}
              isLoading={isLoadingStock}
              error={stockError ? new Error(stockError) : null}
              onRetry={() => refetchStock()}
            />
          </section>

          {/* Warehouse Staff */}
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-teal-600" />
                <div>
                  <h3 className="text-lg font-semibold">الموظفون التابعون للمخزن</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    الموظفون والفنيون المعينون لهذا المخزن (عبر واجهة التحقق الرسمية).
                  </p>
                </div>
              </div>
              {!isStaffForbidden && (
                <button
                  type="button"
                  onClick={() => refetchStaff()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" />
                  تحديث
                </button>
              )}
            </div>

            {isStaffForbidden ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                قائمة الموظفين مخصصة لمديري النظام ومسؤولي المستودعات فقط.
              </div>
            ) : (
              <WarehouseStaffTable
                staff={selectedStaff}
                isLoading={isLoadingStaff}
                error={staffError ? new Error(staffError) : null}
                onRetry={() => refetchStaff()}
              />
            )}
          </section>

          {/* Movement History — Scoped by Permission */}
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-teal-600" />
                <div>
                  <h3 className="text-lg font-semibold">سجل حركات المخزون</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    عمليات الوارد والصادر والمرتجعات (متاحة للإدارة ومسؤولي المستودعات فقط).
                  </p>
                </div>
              </div>
              {!isMovementsForbidden && (
                <button
                  type="button"
                  onClick={() => refetchMovements()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" />
                  تحديث
                </button>
              )}
            </div>

            {isMovementsForbidden ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                سجل حركات المخزون مخصص لمديري النظام ومسؤولي المستودعات فقط.
              </div>
            ) : (
              <WarehouseMovementsTable
                movements={[...selectedMovements].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )}
                isLoading={isLoadingMovements}
                error={movementsError ? new Error(movementsError) : null}
                onRetry={() => refetchMovements()}
              />
            )}
          </section>
        </div>
      )}
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
