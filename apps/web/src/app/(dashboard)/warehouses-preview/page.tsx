"use client";

import { useMemo, useState } from "react";
import {
  Warehouse,
  Plus,
  ArrowRight,
  FlaskConical,
  MapPin,
  Users,
  Package,
  Pencil,
  History,
  AlertTriangle,
} from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";
import { WarehouseTable } from "@/components/warehouses/warehouse-table";
import { WarehouseForm } from "@/components/warehouses/warehouse-form";
import { WarehouseStaffTable } from "@/components/warehouses/warehouse-staff-table";
import { WarehouseMovementsTable } from "@/components/warehouses/warehouse-movements-table";
import {
  WarehouseStockTable,
  type WarehouseStockRow,
} from "@/components/warehouses/warehouse-stock-table";

import type {
  WarehouseRow,
  WarehouseFormValues,
  WarehouseStaffRow,
  WarehouseMovementRow,
} from "@/components/warehouses/types";

// DEMO ONLY — No API calls or database persistence.

const DEMO_STAFF: Record<string, WarehouseStaffRow[]> = {
  "warehouse-1": [
    {
      id: "staff-1",
      name: "أحمد محمد",
      email: "ahmed@example.com",
      role: "WAREHOUSE_STAFF",
    },
    {
      id: "staff-2",
      name: "محمد علي",
      email: "mohamed@example.com",
      role: "WAREHOUSE_STAFF",
    },
  ],
  "warehouse-2": [
    {
      id: "staff-3",
      name: "خالد محمود",
      email: "khaled@example.com",
      role: "WAREHOUSE_STAFF",
    },
  ],
  "warehouse-3": [
    {
      id: "staff-4",
      name: "عمر أحمد",
      email: "omar@example.com",
      role: "WAREHOUSE_STAFF",
    },
  ],
};

const DEMO_STOCK: Record<string, WarehouseStockRow[]> = {
  "warehouse-1": [
    {
      id: "stock-1",
      itemName: "راوتر TP-Link",
      model: "Archer C6",
      category: "راوترات",
      quantity: 45,
      lowStockThreshold: 10,
    },
    {
      id: "stock-2",
      itemName: "كابل إنترنت",
      model: "CAT6",
      category: "كابلات",
      quantity: 8,
      lowStockThreshold: 15,
    },
    {
      id: "stock-3",
      itemName: "راوتر Huawei",
      model: "HG8245H",
      category: "راوترات",
      quantity: 0,
      lowStockThreshold: 5,
    },
  ],
  "warehouse-2": [
    {
      id: "stock-4",
      itemName: "راوتر Huawei",
      model: "HG8245H",
      category: "راوترات",
      quantity: 25,
      lowStockThreshold: 10,
    },
    {
      id: "stock-5",
      itemName: "كابل فايبر",
      model: "Single Mode",
      category: "كابلات",
      quantity: 6,
      lowStockThreshold: 10,
    },
  ],
  "warehouse-3": [
    {
      id: "stock-6",
      itemName: "راوتر TP-Link",
      model: "Archer C6",
      category: "راوترات",
      quantity: 30,
      lowStockThreshold: 10,
    },
    {
      id: "stock-7",
      itemName: "كابل فايبر",
      model: "Single Mode",
      category: "كابلات",
      quantity: 20,
      lowStockThreshold: 10,
    },
  ],
};

const DEMO_MOVEMENTS: Record<string, WarehouseMovementRow[]> = {
  "warehouse-1": [
    {
      id: "movement-1",
      itemName: "راوتر TP-Link",
      type: "INBOUND",
      quantity: 20,
      createdAt: "2026-10-15T09:00:00+03:00",
      performedBy: "أحمد محمد",
    },
    {
      id: "movement-2",
      itemName: "كابل إنترنت",
      type: "OUTBOUND",
      quantity: 10,
      createdAt: "2026-10-15T11:30:00+03:00",
      performedBy: "محمد علي",
    },
    {
      id: "movement-3",
      itemName: "راوتر TP-Link",
      type: "RETURN",
      quantity: 2,
      createdAt: "2026-10-16T13:00:00+03:00",
      performedBy: "أحمد محمد",
    },
  ],
  "warehouse-2": [
    {
      id: "movement-4",
      itemName: "راوتر Huawei",
      type: "INBOUND",
      quantity: 15,
      createdAt: "2026-10-14T10:00:00+03:00",
      performedBy: "خالد محمود",
    },
  ],
  "warehouse-3": [
    {
      id: "movement-5",
      itemName: "كابل فايبر",
      type: "INBOUND",
      quantity: 30,
      createdAt: "2026-10-13T09:30:00+03:00",
      performedBy: "عمر أحمد",
    },
  ],
};

const INITIAL_WAREHOUSES: WarehouseRow[] = [
  {
    id: "warehouse-1",
    name: "المخزن الرئيسي",
    address: "مدينة نصر، القاهرة",
    latitude: 30.0561,
    longitude: 31.3301,
    staffCount: DEMO_STAFF["warehouse-1"].length,
    itemCount: DEMO_STOCK["warehouse-1"].length,
  },
  {
    id: "warehouse-2",
    name: "مخزن الجيزة",
    address: "الدقي، الجيزة",
    latitude: 30.0384,
    longitude: 31.2122,
    staffCount: DEMO_STAFF["warehouse-2"].length,
    itemCount: DEMO_STOCK["warehouse-2"].length,
  },
  {
    id: "warehouse-3",
    name: "مخزن الإسكندرية",
    address: "سموحة، الإسكندرية",
    latitude: 31.2156,
    longitude: 29.9553,
    staffCount: DEMO_STAFF["warehouse-3"].length,
    itemCount: DEMO_STOCK["warehouse-3"].length,
  },
];

type ViewMode = "list" | "create" | "edit" | "details";

function WarehousePreviewContent() {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>(INITIAL_WAREHOUSES);

  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState<string | null>(null);

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ?? null,
    [warehouses, selectedWarehouseId]
  );

  const selectedStaff = selectedWarehouseId ? (DEMO_STAFF[selectedWarehouseId] ?? []) : [];

  const selectedStock = selectedWarehouseId ? (DEMO_STOCK[selectedWarehouseId] ?? []) : [];

  const selectedMovements = selectedWarehouseId ? (DEMO_MOVEMENTS[selectedWarehouseId] ?? []) : [];

  const lowStockItems = selectedStock.filter((item) => item.quantity <= item.lowStockThreshold);

  const filteredWarehouses = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return warehouses;

    return warehouses.filter(
      (warehouse) =>
        warehouse.name.toLowerCase().includes(term) ||
        warehouse.address.toLowerCase().includes(term)
    );
  }, [warehouses, search]);

  const stats = useMemo(
    () => ({
      total: warehouses.length,
      staff: warehouses.reduce((sum, warehouse) => sum + warehouse.staffCount, 0),
      items: warehouses.reduce((sum, warehouse) => sum + warehouse.itemCount, 0),
    }),
    [warehouses]
  );

  function openCreate() {
    setSelectedWarehouseId(null);
    setNotification(null);
    setViewMode("create");
  }

  function openEdit(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setNotification(null);
    setViewMode("edit");
  }

  function openDetails(warehouse: WarehouseRow) {
    setSelectedWarehouseId(warehouse.id);
    setNotification(null);
    setViewMode("details");
  }

  function backToList() {
    setSelectedWarehouseId(null);
    setViewMode("list");
  }

  async function handleWarehouseSubmit(values: WarehouseFormValues) {
    const name = values.name.trim();
    const address = values.address.trim();
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);

    if (!name || !address) {
      throw new Error("اسم المخزن والعنوان مطلوبان.");
    }

    if (
      !values.latitude.trim() ||
      !values.longitude.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error("إحداثيات المخزن غير صحيحة.");
    }

    const duplicate = warehouses.some(
      (warehouse) =>
        warehouse.name.toLowerCase() === name.toLowerCase() && warehouse.id !== selectedWarehouseId
    );

    if (duplicate) {
      throw new Error("يوجد مخزن بنفس الاسم في بيانات المعاينة.");
    }

    if (viewMode === "edit") {
      if (!selectedWarehouse) {
        throw new Error("لم يتم العثور على المخزن.");
      }

      setWarehouses((previous) =>
        previous.map((warehouse) =>
          warehouse.id === selectedWarehouse.id
            ? {
                ...warehouse,
                name,
                address,
                latitude,
                longitude,
              }
            : warehouse
        )
      );

      setNotification("تم تعديل المخزن في بيانات المعاينة فقط.");
    } else if (viewMode === "create") {
      const newWarehouse: WarehouseRow = {
        id: crypto.randomUUID(),
        name,
        address,
        latitude,
        longitude,
        staffCount: 0,
        itemCount: 0,
      };

      setWarehouses((previous) => [newWarehouse, ...previous]);

      setNotification("تمت إضافة المخزن إلى بيانات المعاينة فقط.");
    } else {
      throw new Error("عملية غير صالحة.");
    }

    backToList();
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Preview Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />

        <div>
          <p className="font-semibold">وضع المعاينة — بيانات تجريبية</p>
          <p className="mt-1 text-sm">
            جميع المخازن والموظفين والأصناف والحركات المعروضة تجريبية. التعديلات محلية ولن يتم حفظها
            في قاعدة البيانات.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <Warehouse className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">إدارة المخازن</h1>

              <p className="mt-1 text-sm text-white/80">Warehouse Management — Phase 2</p>
            </div>
          </div>

          <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            {warehouses.length} مخازن تجريبية
          </span>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300"
        >
          {notification}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            title: "إجمالي المخازن",
            value: stats.total,
            icon: Warehouse,
          },
          {
            title: "الموظفون بالمخازن",
            value: stats.staff,
            icon: Users,
          },
          {
            title: "إجمالي أصناف المخزون",
            value: stats.items,
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
                عرض المخازن والبحث عنها وإدارتها.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              إضافة مخزن
            </button>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المخزن أو العنوان..."
            aria-label="البحث عن مخزن"
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-teal-500 sm:max-w-md"
          />

          <p className="text-sm text-muted-foreground">عدد النتائج: {filteredWarehouses.length}</p>

          <WarehouseTable warehouses={filteredWarehouses} onWarehouseClick={openDetails} />
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
                <h2 className="text-2xl font-bold">{selectedWarehouse.name}</h2>

                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {selectedWarehouse.address}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openEdit(selectedWarehouse)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Pencil className="h-4 w-4" />
                تعديل المخزن
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">خط العرض</p>
                <p className="mt-2 font-mono text-lg" dir="ltr">
                  {selectedWarehouse.latitude}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">خط الطول</p>
                <p className="mt-2 font-mono text-lg" dir="ltr">
                  {selectedWarehouse.longitude}
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">عدد الموظفين</p>
                <p className="mt-2 text-2xl font-bold">{selectedWarehouse.staffCount}</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">عدد الأصناف</p>
                <p className="mt-2 text-2xl font-bold">{selectedWarehouse.itemCount}</p>
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
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-teal-600" />

              <div>
                <h3 className="text-lg font-semibold">المخزون الحالي</h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  الأصناف المتاحة والكميات وحدود التنبيه داخل المخزن.
                </p>
              </div>
            </div>

            <WarehouseStockTable items={selectedStock} />
          </section>

          {/* Warehouse Staff */}
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-teal-600" />

              <div>
                <h3 className="text-lg font-semibold">الموظفون التابعون للمخزن</h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  عدد الموظفين المعروضين: {selectedStaff.length}
                </p>
              </div>
            </div>

            <WarehouseStaffTable staff={selectedStaff} />
          </section>

          {/* Movement History */}
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-teal-600" />

              <div>
                <h3 className="text-lg font-semibold">سجل حركات المخزون</h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  عمليات الوارد والصادر والمرتجعات مرتبة من الأحدث إلى الأقدم.
                </p>
              </div>
            </div>

            <WarehouseMovementsTable
              movements={[...selectedMovements].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )}
            />
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
