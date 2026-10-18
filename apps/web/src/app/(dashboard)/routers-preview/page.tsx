"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Router as RouterIcon,
  Search,
  UserRound,
  UserRoundPlus,
  Wifi,
} from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";
import { RouterTable } from "@/components/routers/router-table";
import { RouterForm } from "@/components/routers/router-form";
import { RouterAssignmentForm } from "@/components/routers/router-assignment-form";
import { RouterHistoryTable } from "@/components/routers/router-history-table";

import type {
  RouterRow,
  RouterStatus,
  RouterFormValues,
  RouterAssignmentFormValues,
  RouterHistoryRow,
} from "@/components/routers/types";

// =======================================================
// Router Management Preview
// DEMO ONLY: No API calls or permanent storage.
// =======================================================

const DEMO_WAREHOUSES = [
  {
    id: "warehouse-1",
    name: "المخزن الرئيسي",
  },
  {
    id: "warehouse-2",
    name: "مخزن الجيزة",
  },
  {
    id: "warehouse-3",
    name: "مخزن الإسكندرية",
  },
];

const DEMO_TECHNICIANS = [
  {
    id: "technician-1",
    name: "محمود أحمد",
  },
  {
    id: "technician-2",
    name: "علي حسن",
  },
  {
    id: "technician-3",
    name: "يوسف محمد",
  },
];

const DEMO_ROUTERS: RouterRow[] = [
  {
    id: "router-1",
    serialNumber: "TPL-2026-00001",
    brand: "TP-Link",
    model: "Archer C6",
    status: "IN_STOCK",
    warehouseId: "warehouse-1",
    warehouseName: "المخزن الرئيسي",
    assignedToId: null,
    assignedToName: null,
    createdAt: "2026-10-12T09:00:00+03:00",
  },
  {
    id: "router-2",
    serialNumber: "HW-2026-00002",
    brand: "Huawei",
    model: "HG8245H",
    status: "ASSIGNED",
    warehouseId: "warehouse-2",
    warehouseName: "مخزن الجيزة",
    assignedToId: "technician-1",
    assignedToName: "محمود أحمد",
    createdAt: "2026-10-13T10:00:00+03:00",
  },
  {
    id: "router-3",
    serialNumber: "TPL-2026-00003",
    brand: "TP-Link",
    model: "Archer C80",
    status: "INSTALLED",
    warehouseId: "warehouse-1",
    warehouseName: "المخزن الرئيسي",
    assignedToId: "technician-2",
    assignedToName: "علي حسن",
    createdAt: "2026-10-14T11:00:00+03:00",
  },
  {
    id: "router-4",
    serialNumber: "ZX-2026-00004",
    brand: "ZTE",
    model: "F680",
    status: "RETURNED",
    warehouseId: "warehouse-3",
    warehouseName: "مخزن الإسكندرية",
    assignedToId: null,
    assignedToName: null,
    createdAt: "2026-10-15T12:00:00+03:00",
  },
  {
    id: "router-5",
    serialNumber: "HW-2026-00005",
    brand: "Huawei",
    model: "EG8145V5",
    status: "DAMAGED",
    warehouseId: "warehouse-2",
    warehouseName: "مخزن الجيزة",
    assignedToId: null,
    assignedToName: null,
    createdAt: "2026-10-16T13:00:00+03:00",
  },
];

const DEMO_HISTORY: RouterHistoryRow[] = [
  {
    id: "history-1",
    routerId: "router-1",
    action: "تسجيل راوتر جديد",
    previousStatus: null,
    newStatus: "IN_STOCK",
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-12T09:00:00+03:00",
    notes: "إضافة الجهاز إلى المخزن الرئيسي",
  },
  {
    id: "history-2",
    routerId: "router-2",
    action: "تخصيص الراوتر لفني",
    previousStatus: "IN_STOCK",
    newStatus: "ASSIGNED",
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-14T10:00:00+03:00",
    notes: "تم التخصيص إلى محمود أحمد",
  },
  {
    id: "history-3",
    routerId: "router-3",
    action: "تسجيل تركيب الراوتر",
    previousStatus: "ASSIGNED",
    newStatus: "INSTALLED",
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-15T12:00:00+03:00",
    notes: "تم تسجيل التركيب بصورة تجريبية",
  },
  {
    id: "history-4",
    routerId: "router-4",
    action: "تسجيل مرتجع",
    previousStatus: "ASSIGNED",
    newStatus: "RETURNED",
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-16T10:30:00+03:00",
    notes: "مرتجع بانتظار الفحص",
  },
  {
    id: "history-5",
    routerId: "router-5",
    action: "تسجيل جهاز تالف",
    previousStatus: "IN_STOCK",
    newStatus: "DAMAGED",
    performedBy: "مستخدم تجريبي",
    createdAt: "2026-10-17T11:00:00+03:00",
    notes: "جهاز تالف للتجربة",
  },
];

const STATUS_OPTIONS: {
  value: RouterStatus;
  label: string;
}[] = [
  {
    value: "IN_STOCK",
    label: "بالمخزن",
  },
  {
    value: "ASSIGNED",
    label: "مخصص لفني",
  },
  {
    value: "INSTALLED",
    label: "تم التركيب",
  },
  {
    value: "RETURNED",
    label: "مرتجع",
  },
  {
    value: "DAMAGED",
    label: "تالف",
  },
];

type PageMode = "list" | "create" | "edit" | "details" | "assign";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-teal-500";

function getStatusLabel(status: RouterStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Cairo",
  }).format(date);
}

function RouterPreviewContent() {
  const [routers, setRouters] = useState<RouterRow[]>(DEMO_ROUTERS);

  const [history, setHistory] = useState<RouterHistoryRow[]>(DEMO_HISTORY);

  const [pageMode, setPageMode] = useState<PageMode>("list");

  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const [notification, setNotification] = useState<string | null>(null);

  const selectedRouter = useMemo(
    () => routers.find((router) => router.id === selectedRouterId) ?? null,
    [routers, selectedRouterId]
  );

  const selectedHistory = useMemo(
    () =>
      history
        .filter((entry) => entry.routerId === selectedRouterId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [history, selectedRouterId]
  );

  const filteredRouters = useMemo(() => {
    const term = search.trim().toLowerCase();

    return routers.filter((router) => {
      const matchesSearch = [
        router.serialNumber,
        router.brand,
        router.model,
        router.warehouseName ?? "",
        router.assignedToName ?? "",
      ].some((value) => value.toLowerCase().includes(term));

      const matchesStatus = statusFilter === "all" || router.status === statusFilter;

      const matchesWarehouse = warehouseFilter === "all" || router.warehouseId === warehouseFilter;

      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [routers, search, statusFilter, warehouseFilter]);

  const statistics = useMemo(
    () => ({
      total: routers.length,
      inStock: routers.filter((router) => router.status === "IN_STOCK").length,
      assigned: routers.filter((router) => router.status === "ASSIGNED").length,
      installed: routers.filter((router) => router.status === "INSTALLED").length,
      attention: routers.filter(
        (router) => router.status === "RETURNED" || router.status === "DAMAGED"
      ).length,
    }),
    [routers]
  );

  const existingSerialNumbers = useMemo(
    () => routers.map((router) => router.serialNumber),
    [routers]
  );

  function backToList() {
    setPageMode("list");
    setSelectedRouterId(null);
  }

  function openCreate() {
    setSelectedRouterId(null);
    setNotification(null);
    setPageMode("create");
  }

  function openDetails(router: RouterRow) {
    setSelectedRouterId(router.id);
    setNotification(null);
    setPageMode("details");
  }

  function openEdit(router: RouterRow) {
    setSelectedRouterId(router.id);
    setNotification(null);
    setPageMode("edit");
  }

  function openAssign(routerId?: string) {
    setSelectedRouterId(routerId ?? null);
    setNotification(null);
    setPageMode("assign");
  }

  function addHistoryEntry(
    routerId: string,
    action: string,
    previousStatus: RouterStatus | null,
    newStatus: RouterStatus,
    notes: string | null
  ) {
    const entry: RouterHistoryRow = {
      id: crypto.randomUUID(),
      routerId,
      action,
      previousStatus,
      newStatus,
      performedBy: "مستخدم تجريبي",
      createdAt: new Date().toISOString(),
      notes,
    };

    setHistory((previous) => [entry, ...previous]);
  }

  async function handleRouterSubmit(values: RouterFormValues) {
    const serialNumber = values.serialNumber.trim();
    const brand = values.brand.trim();
    const model = values.model.trim();

    const warehouse = DEMO_WAREHOUSES.find((entry) => entry.id === values.warehouseId);

    if (serialNumber.length < 5 || !brand || !model || !warehouse) {
      throw new Error("يرجى إدخال بيانات راوتر صحيحة.");
    }

    const duplicateSerial = routers.some(
      (router) =>
        router.serialNumber.toLowerCase() === serialNumber.toLowerCase() &&
        router.id !== selectedRouterId
    );

    if (duplicateSerial) {
      throw new Error("الرقم التسلسلي مستخدم بالفعل.");
    }

    if (pageMode === "edit") {
      if (!selectedRouter) {
        throw new Error("لم يتم العثور على الراوتر.");
      }

      // Keep preview status transitions separate
      // from editing device information.
      if (selectedRouter.status !== "IN_STOCK") {
        throw new Error("يمكن تعديل بيانات الأجهزة الموجودة بالمخزن فقط في المعاينة.");
      }

      const currentRouter = selectedRouter;

      setRouters((previous) =>
        previous.map((router) =>
          router.id === currentRouter.id
            ? {
                ...router,
                serialNumber,
                brand,
                model,
                warehouseId: warehouse.id,
                warehouseName: warehouse.name,
              }
            : router
        )
      );

      addHistoryEntry(
        currentRouter.id,
        "تعديل بيانات الراوتر",
        currentRouter.status,
        currentRouter.status,
        "تم تعديل بيانات الجهاز في المعاينة"
      );

      setNotification("تم تعديل بيانات الراوتر محليًا.");

      setPageMode("details");
    } else if (pageMode === "create") {
      const newRouter: RouterRow = {
        id: crypto.randomUUID(),
        serialNumber,
        brand,
        model,
        status: "IN_STOCK",
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        assignedToId: null,
        assignedToName: null,
        createdAt: new Date().toISOString(),
      };

      setRouters((previous) => [newRouter, ...previous]);

      addHistoryEntry(
        newRouter.id,
        "تسجيل راوتر جديد",
        null,
        "IN_STOCK",
        `تم تسجيل الجهاز في ${warehouse.name}`
      );

      setNotification("تمت إضافة الراوتر إلى المعاينة بنجاح.");

      setSelectedRouterId(newRouter.id);
      setPageMode("details");
    } else {
      throw new Error("عملية غير صالحة.");
    }
  }

  async function handleAssignmentSubmit(values: RouterAssignmentFormValues) {
    const router = routers.find((entry) => entry.id === values.routerId);

    const technician = DEMO_TECHNICIANS.find((entry) => entry.id === values.technicianId);

    if (!router) {
      throw new Error("لم يتم العثور على الراوتر.");
    }

    if (!technician) {
      throw new Error("لم يتم العثور على الفني.");
    }

    if (router.status !== "IN_STOCK") {
      throw new Error("الراوتر غير متاح للتخصيص حاليًا.");
    }

    setRouters((previous) =>
      previous.map((entry) =>
        entry.id === router.id
          ? {
              ...entry,
              status: "ASSIGNED",
              assignedToId: technician.id,
              assignedToName: technician.name,
            }
          : entry
      )
    );

    addHistoryEntry(
      router.id,
      "تخصيص الراوتر لفني",
      router.status,
      "ASSIGNED",
      [`الفني: ${technician.name}`, values.notes.trim()].filter(Boolean).join(" — ")
    );

    setNotification("تم تخصيص الراوتر للفني في المعاينة فقط.");

    setSelectedRouterId(router.id);
    setPageMode("details");
  }

  function handleMarkInstalled(router: RouterRow) {
    if (router.status !== "ASSIGNED") return;

    setRouters((previous) =>
      previous.map((entry) =>
        entry.id === router.id
          ? {
              ...entry,
              status: "INSTALLED",
            }
          : entry
      )
    );

    addHistoryEntry(
      router.id,
      "تسجيل تركيب الراوتر",
      "ASSIGNED",
      "INSTALLED",
      "تم تسجيل التركيب في المعاينة فقط"
    );

    setNotification("تم تحديث حالة الراوتر إلى تم التركيب.");
  }

  function handleMarkReturned(router: RouterRow) {
    if (router.status !== "ASSIGNED" && router.status !== "INSTALLED") {
      return;
    }

    setRouters((previous) =>
      previous.map((entry) =>
        entry.id === router.id
          ? {
              ...entry,
              status: "RETURNED",
              assignedToId: null,
              assignedToName: null,
            }
          : entry
      )
    );

    addHistoryEntry(
      router.id,
      "تسجيل مرتجع راوتر",
      router.status,
      "RETURNED",
      "مرتجع بانتظار الفحص — معاينة فقط"
    );

    setNotification("تم تسجيل الراوتر كمرتجع تجريبي.");
  }

  function handleReturnToStock(router: RouterRow) {
    if (router.status !== "RETURNED") return;

    setRouters((previous) =>
      previous.map((entry) =>
        entry.id === router.id
          ? {
              ...entry,
              status: "IN_STOCK",
              assignedToId: null,
              assignedToName: null,
            }
          : entry
      )
    );

    addHistoryEntry(
      router.id,
      "إعادة الراوتر إلى المخزون",
      "RETURNED",
      "IN_STOCK",
      "إعادة افتراضية بعد الفحص — معاينة فقط"
    );

    setNotification("تمت إعادة الراوتر إلى المخزون التجريبي.");
  }

  const statCards = [
    {
      label: "إجمالي الراوترات",
      value: statistics.total,
      icon: RouterIcon,
    },
    {
      label: "بالمخزن",
      value: statistics.inStock,
      icon: PackageCheck,
    },
    {
      label: "مخصصة لفنيين",
      value: statistics.assigned,
      icon: UserRoundPlus,
    },
    {
      label: "تم تركيبها",
      value: statistics.installed,
      icon: Wifi,
    },
    {
      label: "مرتجعة أو تالفة",
      value: statistics.attention,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Preview Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />

        <div>
          <p className="font-semibold">وضع المعاينة — بيانات تجريبية</p>
          <p className="mt-1 text-sm">
            جميع أجهزة الراوتر والفنيين والمخازن والعمليات المعروضة تجريبية. التغييرات مؤقتة وتختفي
            بعد تحديث الصفحة، ولا توجد اتصالات بالـ API أو قاعدة البيانات.
          </p>
        </div>
      </div>

      {/* Header */}
      <header className="rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <RouterIcon className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">إدارة الراوترات</h1>
              <p className="mt-1 text-sm text-white/80">Router Management — Phase 2</p>
            </div>
          </div>

          <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            Preview Mode
          </span>
        </div>
      </header>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Icon className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
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
          className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {notification}
        </div>
      )}

      {/* Router List */}
      {pageMode === "list" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">قائمة أجهزة الراوتر</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                البحث والتصفية وعرض تفاصيل الأجهزة.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openAssign()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-teal-600 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
              >
                <UserRoundPlus className="h-4 w-4" />
                تخصيص لفني
              </button>

              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                إضافة راوتر
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث بالسيريال أو الموديل..."
                aria-label="البحث عن راوتر"
                className={`${inputClass} pr-10`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="تصفية حسب حالة الراوتر"
              className={inputClass}
            >
              <option value="all">جميع الحالات</option>

              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
              aria-label="تصفية حسب المخزن"
              className={inputClass}
            >
              <option value="all">جميع المخازن</option>

              {DEMO_WAREHOUSES.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-muted-foreground">عدد النتائج: {filteredRouters.length}</p>

          <RouterTable routers={filteredRouters} onRouterClick={openDetails} />
        </section>
      )}

      {/* Create / Edit */}
      {(pageMode === "create" || pageMode === "edit") && (
        <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            type="button"
            onClick={
              pageMode === "edit" && selectedRouter ? () => openDetails(selectedRouter) : backToList
            }
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة
          </button>

          <RouterForm
            key={pageMode === "edit" ? (selectedRouterId ?? "edit") : "create"}
            router={pageMode === "edit" ? selectedRouter : null}
            warehouses={DEMO_WAREHOUSES}
            existingSerialNumbers={existingSerialNumbers}
            onSubmit={handleRouterSubmit}
            onCancel={
              pageMode === "edit" && selectedRouter ? () => openDetails(selectedRouter) : backToList
            }
          />
        </section>
      )}

      {/* Assignment */}
      {pageMode === "assign" && (
        <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            type="button"
            onClick={selectedRouter ? () => openDetails(selectedRouter) : backToList}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة
          </button>

          <RouterAssignmentForm
            key={selectedRouterId ?? "all-routers"}
            routers={routers}
            technicians={DEMO_TECHNICIANS}
            initialRouterId={selectedRouterId ?? ""}
            onSubmit={handleAssignmentSubmit}
            onCancel={selectedRouter ? () => openDetails(selectedRouter) : backToList}
          />
        </section>
      )}

      {/* Router Details */}
      {pageMode === "details" && selectedRouter && (
        <div className="space-y-6">
          <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              <ArrowRight className="h-4 w-4" />
              العودة إلى الراوترات
            </button>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">الرقم التسلسلي</p>

                <h2 className="mt-1 text-2xl font-bold" dir="ltr">
                  {selectedRouter.serialNumber}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedRouter.brand} — {selectedRouter.model}
                </p>
              </div>

              <span className="rounded-full bg-muted px-4 py-2 text-sm font-semibold">
                {getStatusLabel(selectedRouter.status)}
              </span>
            </div>

            {/* Details Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  المخزن المسجل
                </p>

                <p className="mt-2 font-semibold">{selectedRouter.warehouseName ?? "غير محدد"}</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  الفني المخصص
                </p>

                <p className="mt-2 font-semibold">{selectedRouter.assignedToName ?? "غير مخصص"}</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">الشركة المصنعة</p>

                <p className="mt-2 font-semibold">{selectedRouter.brand}</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">تاريخ تسجيل الجهاز</p>

                <p className="mt-2 font-semibold">{formatDate(selectedRouter.createdAt)}</p>
              </div>
            </div>

            {/* Available Actions */}
            <div className="flex flex-wrap gap-3 border-t pt-5">
              {selectedRouter.status === "IN_STOCK" && (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(selectedRouter)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                    تعديل البيانات
                  </button>

                  <button
                    type="button"
                    onClick={() => openAssign(selectedRouter.id)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <UserRoundPlus className="h-4 w-4" />
                    تخصيص لفني
                  </button>
                </>
              )}

              {selectedRouter.status === "ASSIGNED" && (
                <button
                  type="button"
                  onClick={() => handleMarkInstalled(selectedRouter)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <Wifi className="h-4 w-4" />
                  تسجيل التركيب
                </button>
              )}

              {(selectedRouter.status === "ASSIGNED" || selectedRouter.status === "INSTALLED") && (
                <button
                  type="button"
                  onClick={() => handleMarkReturned(selectedRouter)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-muted"
                >
                  <RotateCcw className="h-4 w-4" />
                  تسجيل مرتجع
                </button>
              )}

              {selectedRouter.status === "RETURNED" && (
                <button
                  type="button"
                  onClick={() => handleReturnToStock(selectedRouter)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <PackageCheck className="h-4 w-4" />
                  إعادة للمخزون (تجريبي)
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              الإجراءات دي بتغيّر بيانات المعاينة فقط. انتقالات الحالات مؤقتة ولابد من اعتمادها مع
              الباك إند.
            </p>
          </section>

          {/* Router History */}
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-teal-600" />

              <div>
                <h3 className="text-lg font-semibold">سجل تاريخ الراوتر</h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  جميع التغييرات المسجلة على الجهاز في وضع المعاينة.
                </p>
              </div>
            </div>

            <RouterHistoryTable history={selectedHistory} />
          </section>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Router Management Preview — بيانات تجريبية مستقلة عن صفحات المخازن والمخزون.
      </p>
    </div>
  );
}

export default function RoutersPreviewPage() {
  return (
    <RoleGuard permission="routers.manage">
      <RouterPreviewContent />
    </RoleGuard>
  );
}
