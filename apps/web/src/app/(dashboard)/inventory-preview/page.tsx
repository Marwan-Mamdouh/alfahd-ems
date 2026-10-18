"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  FlaskConical,
  Package,
  PackagePlus,
  Plus,
  Search,
  Warehouse,
} from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";

import { InventoryItemsTable } from "@/components/inventory/inventory-items-table";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { InventoryStockTable } from "@/components/inventory/inventory-stock-table";
import { InventoryMovementForm } from "@/components/inventory/inventory-movement-form";
import { InventoryMovementsTable } from "@/components/inventory/inventory-movements-table";

import type {
  InventoryItemRow,
  InventoryItemFormValues,
  InventoryStockRow,
  InventoryMovementRow,
  InventoryMovementFormValues,
  InventoryMovementType,
} from "@/components/inventory/types";

// ============================================================
// Inventory Preview
// DEMO ONLY: Local state, no API calls, no database persistence.
// ============================================================

const DEMO_ITEMS: InventoryItemRow[] = [
  {
    id: "item-1",
    name: "راوتر TP-Link",
    model: "Archer C6",
    category: "راوترات",
    description: "راوتر لاسلكي للاستخدام المنزلي.",
  },
  {
    id: "item-2",
    name: "راوتر Huawei",
    model: "HG8245H",
    category: "راوترات",
    description: "راوتر فايبر.",
  },
  {
    id: "item-3",
    name: "كابل إنترنت",
    model: "CAT6",
    category: "كابلات",
    description: "كابل شبكات للاستخدام الداخلي.",
  },
  {
    id: "item-4",
    name: "كابل فايبر",
    model: "Single Mode",
    category: "كابلات",
    description: "كابل فايبر ضوئي.",
  },
  {
    id: "item-5",
    name: "موصل RJ45",
    model: "CAT6 RJ45",
    category: "إكسسوارات",
    description: "موصل لكابلات الإنترنت.",
  },
];

const DEMO_WAREHOUSES = [
  { id: "warehouse-1", name: "المخزن الرئيسي" },
  { id: "warehouse-2", name: "مخزن الجيزة" },
  { id: "warehouse-3", name: "مخزن الإسكندرية" },
];

const DEMO_TECHNICIANS = [
  { id: "technician-1", name: "محمود أحمد" },
  { id: "technician-2", name: "علي حسن" },
  { id: "technician-3", name: "يوسف محمد" },
];

const DEMO_STOCKS: InventoryStockRow[] = [
  {
    id: "stock-1",
    itemId: "item-1",
    itemName: "راوتر TP-Link",
    model: "Archer C6",
    category: "راوترات",
    warehouseId: "warehouse-1",
    warehouseName: "المخزن الرئيسي",
    quantity: 45,
    lowStockThreshold: 10,
  },
  {
    id: "stock-2",
    itemId: "item-2",
    itemName: "راوتر Huawei",
    model: "HG8245H",
    category: "راوترات",
    warehouseId: "warehouse-1",
    warehouseName: "المخزن الرئيسي",
    quantity: 0,
    lowStockThreshold: 5,
  },
  {
    id: "stock-3",
    itemId: "item-3",
    itemName: "كابل إنترنت",
    model: "CAT6",
    category: "كابلات",
    warehouseId: "warehouse-1",
    warehouseName: "المخزن الرئيسي",
    quantity: 8,
    lowStockThreshold: 15,
  },
  {
    id: "stock-4",
    itemId: "item-1",
    itemName: "راوتر TP-Link",
    model: "Archer C6",
    category: "راوترات",
    warehouseId: "warehouse-2",
    warehouseName: "مخزن الجيزة",
    quantity: 20,
    lowStockThreshold: 10,
  },
  {
    id: "stock-5",
    itemId: "item-4",
    itemName: "كابل فايبر",
    model: "Single Mode",
    category: "كابلات",
    warehouseId: "warehouse-2",
    warehouseName: "مخزن الجيزة",
    quantity: 6,
    lowStockThreshold: 10,
  },
  {
    id: "stock-6",
    itemId: "item-4",
    itemName: "كابل فايبر",
    model: "Single Mode",
    category: "كابلات",
    warehouseId: "warehouse-3",
    warehouseName: "مخزن الإسكندرية",
    quantity: 30,
    lowStockThreshold: 10,
  },
  {
    id: "stock-7",
    itemId: "item-5",
    itemName: "موصل RJ45",
    model: "CAT6 RJ45",
    category: "إكسسوارات",
    warehouseId: "warehouse-3",
    warehouseName: "مخزن الإسكندرية",
    quantity: 100,
    lowStockThreshold: 20,
  },
];

const DEMO_MOVEMENTS: InventoryMovementRow[] = [
  {
    id: "movement-1",
    itemId: "item-1",
    itemName: "راوتر TP-Link",
    warehouseId: "warehouse-1",
    warehouseName: "المخزن الرئيسي",
    type: "INBOUND",
    quantity: 20,
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-15T09:00:00+03:00",
    notes: "استلام شحنة من المورد",
  },
  {
    id: "movement-2",
    itemId: "item-3",
    itemName: "كابل إنترنت",
    warehouseId: "warehouse-1",
    warehouseName: "المخزن الرئيسي",
    type: "OUTBOUND",
    quantity: 10,
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-16T11:30:00+03:00",
    notes: "صرف للفني محمود أحمد",
  },
  {
    id: "movement-3",
    itemId: "item-4",
    itemName: "كابل فايبر",
    warehouseId: "warehouse-2",
    warehouseName: "مخزن الجيزة",
    type: "RETURN",
    quantity: 2,
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-17T13:00:00+03:00",
    notes: "مرتجع من الفني علي حسن",
  },
];

type InventoryTab = "items" | "stocks" | "movements";
type PageMode = "overview" | "create-item" | "edit-item" | "movement";

const TAB_OPTIONS: {
  value: InventoryTab;
  label: string;
  icon: typeof Package;
}[] = [
  {
    value: "items",
    label: "كتالوج الأصناف",
    icon: Package,
  },
  {
    value: "stocks",
    label: "المخزون الحالي",
    icon: Warehouse,
  },
  {
    value: "movements",
    label: "سجل الحركات",
    icon: ClipboardList,
  },
];

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-teal-500";

function getStockStatus(stock: InventoryStockRow) {
  if (stock.quantity <= 0) return "out";
  if (stock.quantity <= stock.lowStockThreshold) return "low";
  return "available";
}

function InventoryPreviewContent() {
  const [items, setItems] = useState<InventoryItemRow[]>(DEMO_ITEMS);

  const [stocks, setStocks] = useState<InventoryStockRow[]>(DEMO_STOCKS);

  const [movements, setMovements] = useState<InventoryMovementRow[]>(DEMO_MOVEMENTS);

  const [activeTab, setActiveTab] = useState<InventoryTab>("items");

  const [pageMode, setPageMode] = useState<PageMode>("overview");

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  const [notification, setNotification] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: `${item.name} — ${item.model}`,
      })),
    [items]
  );

  const statistics = useMemo(() => {
    const lowStock = stocks.filter((stock) => getStockStatus(stock) !== "available");

    return {
      totalItems: items.length,
      totalUnits: stocks.reduce((total, stock) => total + stock.quantity, 0),
      lowStock: lowStock.length,
      totalMovements: movements.length,
    };
  }, [items, stocks, movements]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) =>
      [item.name, item.model, item.category, item.description ?? ""].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [items, search]);

  const filteredStocks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return stocks.filter((stock) => {
      const matchesSearch = [stock.itemName, stock.model, stock.category, stock.warehouseName].some(
        (value) => value.toLowerCase().includes(term)
      );

      const matchesWarehouse = warehouseFilter === "all" || stock.warehouseId === warehouseFilter;

      return matchesSearch && matchesWarehouse;
    });
  }, [stocks, search, warehouseFilter]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();

    return movements
      .filter((movement) => {
        const matchesSearch = [
          movement.itemName,
          movement.warehouseName,
          movement.performedBy,
          movement.notes ?? "",
        ].some((value) => value.toLowerCase().includes(term));

        const matchesWarehouse =
          warehouseFilter === "all" || movement.warehouseId === warehouseFilter;

        const matchesType = movementTypeFilter === "all" || movement.type === movementTypeFilter;

        return matchesSearch && matchesWarehouse && matchesType;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, search, warehouseFilter, movementTypeFilter]);

  function switchTab(tab: InventoryTab) {
    setActiveTab(tab);
    setPageMode("overview");
    setSearch("");
    setWarehouseFilter("all");
    setMovementTypeFilter("all");
    setNotification(null);
    setSelectedItemId(null);
  }

  function openCreateItem() {
    setSelectedItemId(null);
    setNotification(null);
    setPageMode("create-item");
  }

  function openEditItem(item: InventoryItemRow) {
    setSelectedItemId(item.id);
    setNotification(null);
    setPageMode("edit-item");
  }

  function openMovementForm() {
    setNotification(null);
    setPageMode("movement");
  }

  function backToOverview() {
    setSelectedItemId(null);
    setPageMode("overview");
  }

  async function handleItemSubmit(values: InventoryItemFormValues) {
    const name = values.name.trim();
    const model = values.model.trim();
    const category = values.category.trim();
    const description = values.description.trim();

    if (!name || !model || !category) {
      throw new Error("اسم الصنف والموديل والتصنيف مطلوبون.");
    }

    const duplicate = items.some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        item.model.toLowerCase() === model.toLowerCase() &&
        item.id !== selectedItemId
    );

    if (duplicate) {
      throw new Error("يوجد صنف بنفس الاسم والموديل.");
    }

    if (pageMode === "edit-item") {
      if (!selectedItem) {
        throw new Error("لم يتم العثور على الصنف.");
      }

      const updatedItem: InventoryItemRow = {
        ...selectedItem,
        name,
        model,
        category,
        description: description || null,
      };

      setItems((previous) =>
        previous.map((item) => (item.id === selectedItem.id ? updatedItem : item))
      );

      // Keep existing stock and movement display names synced.
      setStocks((previous) =>
        previous.map((stock) =>
          stock.itemId === selectedItem.id
            ? {
                ...stock,
                itemName: name,
                model,
                category,
              }
            : stock
        )
      );

      setMovements((previous) =>
        previous.map((movement) =>
          movement.itemId === selectedItem.id
            ? {
                ...movement,
                itemName: name,
              }
            : movement
        )
      );

      setNotification("تم تعديل بيانات الصنف في المعاينة فقط.");
    } else if (pageMode === "create-item") {
      const newItem: InventoryItemRow = {
        id: crypto.randomUUID(),
        name,
        model,
        category,
        description: description || null,
      };

      setItems((previous) => [newItem, ...previous]);

      setNotification("تمت إضافة الصنف إلى الكتالوج التجريبي.");
    } else {
      throw new Error("عملية غير صالحة.");
    }

    setActiveTab("items");
    backToOverview();
  }

  async function handleMovementSubmit(values: InventoryMovementFormValues) {
    const item = items.find((entry) => entry.id === values.itemId);

    const warehouse = DEMO_WAREHOUSES.find((entry) => entry.id === values.warehouseId);

    const quantity = Number(values.quantity);

    if (!item || !warehouse) {
      throw new Error("يرجى اختيار صنف ومخزن صحيحين.");
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.");
    }

    const validTypes: InventoryMovementType[] = ["INBOUND", "OUTBOUND", "RETURN"];

    if (!validTypes.includes(values.type)) {
      throw new Error("نوع الحركة غير صحيح.");
    }

    const isInbound = values.type === "INBOUND";

    const technician = DEMO_TECHNICIANS.find((entry) => entry.id === values.technicianId);

    if (isInbound) {
      if (!values.supplierName.trim()) {
        throw new Error("اسم المورد مطلوب للوارد.");
      }
    } else if (!technician) {
      throw new Error("يرجى اختيار الفني.");
    }

    const existingStock = stocks.find(
      (stock) => stock.itemId === item.id && stock.warehouseId === warehouse.id
    );

    if (values.type === "OUTBOUND") {
      if (!existingStock || existingStock.quantity < quantity) {
        const available = existingStock?.quantity ?? 0;

        throw new Error(`الكمية غير كافية. المتاح حاليًا ${available} فقط.`);
      }
    }

    // Preview rule:
    // INBOUND and RETURN add stock; OUTBOUND subtracts stock.
    // Backend must validate permissions, assignments and balances.
    const change = values.type === "OUTBOUND" ? -quantity : quantity;

    if (existingStock) {
      setStocks((previous) =>
        previous.map((stock) =>
          stock.id === existingStock.id
            ? {
                ...stock,
                quantity: stock.quantity + change,
              }
            : stock
        )
      );
    } else {
      // New stock entries are possible for incoming/returned items.
      const newStock: InventoryStockRow = {
        id: crypto.randomUUID(),
        itemId: item.id,
        itemName: item.name,
        model: item.model,
        category: item.category,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quantity: change,
        lowStockThreshold: 10,
      };

      setStocks((previous) => [newStock, ...previous]);
    }

    const movementNotes = [
      isInbound ? `المورد: ${values.supplierName.trim()}` : `الفني: ${technician?.name ?? ""}`,
      values.notes.trim(),
    ]
      .filter(Boolean)
      .join(" — ");

    const newMovement: InventoryMovementRow = {
      id: crypto.randomUUID(),
      itemId: item.id,
      itemName: item.name,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      type: values.type,
      quantity,
      performedBy: "مستخدم تجريبي",
      createdAt: new Date().toISOString(),
      notes: movementNotes || null,
    };

    setMovements((previous) => [newMovement, ...previous]);

    setNotification("تم تسجيل الحركة وتحديث الكمية محليًا بنجاح.");

    setActiveTab("movements");
    backToOverview();
  }

  const statCards = [
    {
      title: "أصناف الكتالوج",
      value: statistics.totalItems,
      icon: Package,
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    },
    {
      title: "إجمالي الوحدات",
      value: statistics.totalUnits,
      icon: Boxes,
      color: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    },
    {
      title: "سجلات تحتاج انتباه",
      value: statistics.lowStock,
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    },
    {
      title: "حركات المخزون",
      value: statistics.totalMovements,
      icon: ArrowLeftRight,
      color: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Demo Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />

        <div>
          <p className="font-semibold">وضع المعاينة — بيانات تجريبية</p>

          <p className="mt-1 text-sm">
            جميع البيانات والعمليات داخل الصفحة تجريبية. التعديلات مؤقتة داخل المتصفح وتختفي عند
            إعادة تحميل الصفحة. لا توجد أي طلبات API أو عمليات حفظ حقيقية.
          </p>
        </div>
      </div>

      {/* Page Header */}
      <div className="rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <Boxes className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">إدارة المخزون</h1>

              <p className="mt-1 text-sm text-white/80">Inventory Management — Phase 2</p>
            </div>
          </div>

          <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            Preview Mode
          </span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.color}`}
              >
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

      {/* Notification */}
      {notification && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300"
        >
          {notification}
        </div>
      )}

      {/* Overview */}
      {pageMode === "overview" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 border-b pb-4">
            {TAB_OPTIONS.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => switchTab(tab.value)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-teal-600 text-white"
                      : "bg-muted/60 text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Title and Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {activeTab === "items"
                  ? "كتالوج الأصناف"
                  : activeTab === "stocks"
                    ? "المخزون الحالي"
                    : "سجل حركات المخزون"}
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {activeTab === "items"
                  ? "عرض الأصناف وإضافة وتعديل بياناتها."
                  : activeTab === "stocks"
                    ? "متابعة الكميات في المخازن ومستويات التنبيه."
                    : "متابعة الوارد والصادر والمرتجعات."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeTab === "items" && (
                <button
                  type="button"
                  onClick={openCreateItem}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  إضافة صنف
                </button>
              )}

              <button
                type="button"
                onClick={openMovementForm}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-teal-600 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
              >
                <ArrowLeftRight className="h-4 w-4" />
                تسجيل حركة
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث في البيانات..."
                aria-label="البحث في المخزون"
                className={`${inputClass} pr-10`}
              />
            </div>

            {activeTab !== "items" && (
              <select
                value={warehouseFilter}
                onChange={(event) => setWarehouseFilter(event.target.value)}
                aria-label="تصفية حسب المخزن"
                className={`${inputClass} w-full sm:w-52`}
              >
                <option value="all">جميع المخازن</option>

                {DEMO_WAREHOUSES.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "movements" && (
              <select
                value={movementTypeFilter}
                onChange={(event) => setMovementTypeFilter(event.target.value)}
                aria-label="تصفية حسب نوع الحركة"
                className={`${inputClass} w-full sm:w-44`}
              >
                <option value="all">جميع الحركات</option>

                <option value="INBOUND">وارد</option>

                <option value="OUTBOUND">صادر</option>

                <option value="RETURN">مرتجع</option>
              </select>
            )}
          </div>

          {/* Data Tables */}
          {activeTab === "items" && (
            <InventoryItemsTable items={filteredItems} onItemClick={openEditItem} />
          )}

          {activeTab === "stocks" && <InventoryStockTable stocks={filteredStocks} />}

          {activeTab === "movements" && <InventoryMovementsTable movements={filteredMovements} />}
        </section>
      )}

      {/* Create / Edit Item */}
      {(pageMode === "create-item" || pageMode === "edit-item") && (
        <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            type="button"
            onClick={backToOverview}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة إلى الكتالوج
          </button>

          <InventoryItemForm
            key={pageMode === "edit-item" ? (selectedItemId ?? "edit") : "create"}
            item={pageMode === "edit-item" ? selectedItem : null}
            onSubmit={handleItemSubmit}
            onCancel={backToOverview}
          />
        </section>
      )}

      {/* Movement Form */}
      {pageMode === "movement" && (
        <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            type="button"
            onClick={backToOverview}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة إلى إدارة المخزون
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <PackagePlus className="h-6 w-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold">عملية مخزون جديدة</h2>

              <p className="mt-1 text-sm text-muted-foreground">
                سيتم تحديث الكمية المعروضة محليًا بعد التسجيل.
              </p>
            </div>
          </div>

          <InventoryMovementForm
            items={itemOptions}
            warehouses={DEMO_WAREHOUSES}
            technicians={DEMO_TECHNICIANS}
            onSubmit={handleMovementSubmit}
            onCancel={backToOverview}
          />
        </section>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Inventory Management Preview — بيانات تجريبية مستقلة عن الـ Backend وعن Warehouse Preview.
      </p>
    </div>
  );
}

export default function InventoryPreviewPage() {
  return (
    <RoleGuard permission="inventory.manage">
      <InventoryPreviewContent />
    </RoleGuard>
  );
}
