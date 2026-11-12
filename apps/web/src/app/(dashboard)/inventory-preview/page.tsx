"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  Package,
  PackagePlus,
  Plus,
  Search,
  Warehouse,
  ShieldAlert,
} from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";
import { useAuthStore } from "@/core/auth/auth.store";
import { useTechniciansLookup } from "@/core/query/use-employee-lookup";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/core/query/use-products";
import { useWarehouses } from "@/core/query/use-warehouses";
import {
  useInventoryStock,
  useInventoryMovements,
  useRecordInbound,
  useRecordOutbound,
  useRecordReturn,
  useTransferStock,
  useAdjustStock,
  extractErrorMessage,
} from "@/core/query/use-inventory";

import { InventoryItemsTable } from "@/components/inventory/inventory-items-table";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { InventoryStockTable } from "@/components/inventory/inventory-stock-table";
import { InventoryMovementForm } from "@/components/inventory/inventory-movement-form";
import { InventoryMovementsTable } from "@/components/inventory/inventory-movements-table";
import { ProductDeactivateDialog } from "@/components/inventory/product-deactivate-dialog";

import type {
  InventoryItemRow,
  InventoryItemFormValues,
  InventoryStockRow,
  InventoryMovementRow,
  InventoryMovementFormValues,
  InventoryMovementType,
} from "@/components/inventory/types";

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
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? null;

  // Live queries
  const {
    products: liveProducts,
    isLoading: isProductsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useProducts();
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  const [deactivatingItem, setDeactivatingItem] = useState<InventoryItemRow | null>(null);

  const { warehouses: liveWarehouses } = useWarehouses();
  const activeWarehouses = useMemo(() => {
    return liveWarehouses
      .filter((w) => w.isActive)
      .map((w) => ({ id: w.id, name: w.name }));
  }, [liveWarehouses]);

  const { technicians: lookupTechnicians } = useTechniciansLookup();
  const activeTechnicians = lookupTechnicians;

  const {
    stockItems: liveStocks,
    isLoading: isStocksLoading,
    error: stocksError,
    refetch: refetchStocks,
  } = useInventoryStock();

  const {
    movements: liveMovements,
    isLoading: isMovementsLoading,
    error: movementsError,
    isForbidden: isMovementsForbidden,
    refetch: refetchMovements,
  } = useInventoryMovements(undefined, userRole);

  // Live mutations
  const inboundMutation = useRecordInbound();
  const outboundMutation = useRecordOutbound();
  const returnMutation = useRecordReturn();
  const transferMutation = useTransferStock();
  const adjustMutation = useAdjustStock();

  const isMutating =
    inboundMutation.isPending ||
    outboundMutation.isPending ||
    returnMutation.isPending ||
    transferMutation.isPending ||
    adjustMutation.isPending;

  // Normalized items catalog
  const items = useMemo(() => {
    return liveProducts.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      model: p.model,
      category: p.category,
      description: p.description,
      lowStockThreshold: p.lowStockThreshold,
      isSerialized: p.isSerialized,
      isActive: p.isActive,
    }));
  }, [liveProducts]);

  // Normalized stock balances
  const stocks = useMemo<InventoryStockRow[]>(() => {
    return liveStocks.map((s) => ({
      id: s.id,
      itemId: s.productId,
      itemName: s.product?.name ?? "صنف غير معروف",
      model: s.product?.model ?? "—",
      category: s.product?.category ?? "—",
      sku: s.product?.sku,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse?.name ?? "مخزن غير معروف",
      quantity: s.quantity,
      lowStockThreshold: s.product?.lowStockThreshold ?? 10,
      isSerialized: s.product?.isSerialized,
    }));
  }, [liveStocks]);

  // Normalized movements log
  const movements = useMemo<InventoryMovementRow[]>(() => {
    return liveMovements.map((m) => {
      const prod = items.find((p) => p.id === m.productId);
      const wh = liveWarehouses.find((w) => w.id === m.warehouseId);
      return {
        id: m.id,
        itemId: m.productId,
        itemName: prod?.name ?? "صنف غير معروف",
        warehouseId: m.warehouseId,
        warehouseName: wh?.name ?? "مخزن",
        type: m.movementType as InventoryMovementType,
        quantity: m.quantity,
        performedBy: m.responsibleUserId ? `مستخدم (${m.responsibleUserId.slice(0, 8)})` : "النظام",
        createdAt: m.createdAt,
        notes: m.notes ?? null,
      };
    });
  }, [liveMovements, items, liveWarehouses]);

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
      items
        .filter((item) => item.isActive !== false)
        .map((item) => ({
          id: item.id,
          name: `${item.name} — ${item.model}`,
          isSerialized: item.isSerialized,
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
    const sku = values.sku.trim().toUpperCase();
    const model = values.model.trim();
    const category = values.category.trim();
    const description = values.description.trim();
    const lowStockThreshold = Number(values.lowStockThreshold);

    if (!name || !sku || !model || !category) {
      throw new Error("اسم الصنف ورمز الصنف (SKU) والموديل والتصنيف مطلوبون.");
    }

    try {
      if (pageMode === "edit-item") {
        if (!selectedItem) {
          throw new Error("لم يتم العثور على الصنف.");
        }

        await updateProductMutation.mutateAsync({
          id: selectedItem.id,
          dto: {
            name,
            sku,
            model,
            category,
            description: description || null,
            lowStockThreshold,
          },
        });

        setNotification("تم تعديل بيانات الصنف في الكتالوج بنجاح.");
      } else if (pageMode === "create-item") {
        await createProductMutation.mutateAsync({
          name,
          sku,
          model,
          category,
          description: description || null,
          lowStockThreshold,
        });

        setNotification("تمت إضافة الصنف إلى كتالوج المنتجات بنجاح.");
      } else {
        throw new Error("عملية غير صالحة.");
      }

      setActiveTab("items");
      backToOverview();
    } catch (err) {
      throw new Error(extractErrorMessage(err, "فشلت عملية حفظ الصنف."));
    }
  }

  async function handleDeactivateConfirm(item: InventoryItemRow) {
    try {
      await deleteProductMutation.mutateAsync(item.id);
      setNotification(`تم تعطيل وأرشفة الصنف "${item.name}" بنجاح.`);
      setDeactivatingItem(null);
    } catch (err) {
      throw new Error(extractErrorMessage(err, "فشلت عملية تعطيل الصنف."));
    }
  }

  async function handleMovementSubmit(values: InventoryMovementFormValues) {
    const item = items.find((entry) => entry.id === values.itemId);
    const warehouse = activeWarehouses.find((entry) => entry.id === values.warehouseId);

    if (!item || !warehouse) {
      throw new Error("يرجى اختيار صنف ومخزن صحيحين.");
    }

    if (item.isSerialized) {
      throw new Error(
        "هذا الصنف متبع بالسيريال (راوتر / جهاز معرّف). لا يمكن إجراء حركة كمية مجمعة عليه من هنا، يرجى التوجه لشاشة إدارة الراوترات."
      );
    }

    try {
      if (values.type === "INBOUND_SUPPLIER" || values.type === "INBOUND") {
        await inboundMutation.mutateAsync({
          warehouseId: values.warehouseId,
          productId: values.itemId,
          quantity: Number(values.quantity),
          supplierName: values.supplierName,
          notes: values.notes || undefined,
        });
        setNotification("تم تسجيل حركة الوارد من المورد بنجاح وتحديث الرصيد.");
      } else if (values.type === "OUTBOUND_TECHNICIAN" || values.type === "OUTBOUND") {
        await outboundMutation.mutateAsync({
          warehouseId: values.warehouseId,
          productId: values.itemId,
          quantity: Number(values.quantity),
          technicianId: values.technicianId,
          notes: values.notes || undefined,
        });
        setNotification("تم صرف الكمية للفني بنجاح وتحديث الرصيد.");
      } else if (values.type === "RETURN_TECHNICIAN" || values.type === "RETURN") {
        await returnMutation.mutateAsync({
          warehouseId: values.warehouseId,
          productId: values.itemId,
          quantity: Number(values.quantity),
          technicianId: values.technicianId,
          notes: values.notes || undefined,
        });
        setNotification("تم تسجيل المرتجع من الفني بنجاح وتحديث الرصيد.");
      } else if (values.type === "TRANSFER_WAREHOUSE") {
        if (!values.toWarehouseId) {
          throw new Error("يرجى اختيار المخزن الوجهة للتحويل.");
        }
        await transferMutation.mutateAsync({
          fromWarehouseId: values.warehouseId,
          toWarehouseId: values.toWarehouseId,
          productId: values.itemId,
          quantity: Number(values.quantity),
          notes: values.notes || undefined,
        });
        setNotification("تم تحويل المخزون بين المخزنين بنجاح وتحديث الأرصدة.");
      } else if (values.type === "ADJUSTMENT") {
        await adjustMutation.mutateAsync({
          warehouseId: values.warehouseId,
          productId: values.itemId,
          newQuantity: Number(values.newQuantity),
          notes: values.notes,
        });
        setNotification("تم تسجيل التسوية الجردية بنجاح وتحديث الرصيد الفعلي.");
      }

      setActiveTab("stocks");
      backToOverview();
    } catch (err) {
      throw new Error(extractErrorMessage(err, "فشلت عملية تسجيل حركة المخزون."));
    }
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
      {/* Live Integration Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
        <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
        <div>
          <p className="font-semibold">نظام إدارة المخزون المباشر (B3)</p>
          <p className="mt-1 text-sm">
            متصل مباشرة بالخادم (Backend API) لإدارة الأرصدة، الحركات الخمس (وارد، صادر، مرتجع، تحويل، وتسوية جردية)، وضمان عزل الأجهزة المتتبعة بالسيريال.
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
              <p className="mt-1 text-sm text-white/80">Real Inventory & Stock Operations</p>
            </div>
          </div>

          <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            Real Backend Connected
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
                    : "متابعة الوارد والصادر والمرتجعات والتحويلات."}
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
                {activeWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "movements" && !isMovementsForbidden && (
              <select
                value={movementTypeFilter}
                onChange={(event) => setMovementTypeFilter(event.target.value)}
                aria-label="تصفية حسب نوع الحركة"
                className={`${inputClass} w-full sm:w-52`}
              >
                <option value="all">جميع الحركات</option>
                <option value="INBOUND_SUPPLIER">وارد مورد</option>
                <option value="OUTBOUND_TECHNICIAN">صرف لفني</option>
                <option value="RETURN_TECHNICIAN">مرتجع فني</option>
                <option value="TRANSFER_WAREHOUSE">تحويل مخزني</option>
                <option value="ADJUSTMENT">تسوية جردية</option>
              </select>
            )}
          </div>

          {/* Data Tables */}
          {activeTab === "items" && (
            <InventoryItemsTable
              items={filteredItems}
              isLoading={isProductsLoading}
              error={productsError ? new Error(productsError) : null}
              onRetry={refetchProducts}
              onItemClick={openEditItem}
              onDeactivate={(item) => setDeactivatingItem(item)}
              canDeactivate={userRole === "ADMIN"}
            />
          )}

          {activeTab === "stocks" && (
            <InventoryStockTable
              stocks={filteredStocks}
              isLoading={isStocksLoading}
              error={stocksError ? new Error(stocksError) : null}
              onRetry={refetchStocks}
            />
          )}

          {activeTab === "movements" && (
            <>
              {isMovementsForbidden ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-muted bg-muted/20 p-8 text-center">
                  <ShieldAlert className="h-10 w-10 text-muted-foreground" />
                  <p className="font-semibold text-foreground">صلاحية محدودة</p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    عرض سجل حركات المخزون والتدقيق مقصور على مدراء النظام وأمناء المستودعات فقط.
                  </p>
                </div>
              ) : (
                <InventoryMovementsTable
                  movements={filteredMovements}
                  isLoading={isMovementsLoading}
                  error={movementsError ? new Error(movementsError) : null}
                  onRetry={refetchMovements}
                />
              )}
            </>
          )}
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
              <h2 className="text-xl font-bold">تسجيل حركة مخزون جديدة</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                تسجيل حركة رسمية على أرصدة المخازن مع التحقق الفوري من الصلاحيات وتوفر الكميات.
              </p>
            </div>
          </div>

          <InventoryMovementForm
            items={itemOptions}
            warehouses={activeWarehouses}
            technicians={activeTechnicians}
            userRole={userRole}
            isSubmitting={isMutating}
            onSubmit={handleMovementSubmit}
            onCancel={backToOverview}
          />
        </section>
      )}

      {/* Deactivate Product Confirmation Modal */}
      {deactivatingItem && (
        <ProductDeactivateDialog
          item={deactivatingItem}
          isOpen={Boolean(deactivatingItem)}
          onClose={() => setDeactivatingItem(null)}
          onConfirm={handleDeactivateConfirm}
          isSubmitting={deleteProductMutation.isPending}
        />
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        نظام الفهد لإدارة المخزون والتوريدات — متصل بالخادم المركزي
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
