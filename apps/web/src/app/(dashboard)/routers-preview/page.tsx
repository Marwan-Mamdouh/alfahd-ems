"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Plus,
  Router as RouterIcon,
  Search,
  UserRoundPlus,
  Wifi,
} from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";
import { useAuthStore } from "@/core/auth/auth.store";
import { Role, type RouterQueryDto } from "@alfahd/types";
import { useTechniciansLookup } from "@/core/query/use-employee-lookup";
import { useProducts } from "@/core/query/use-products";
import { useWarehouses } from "@/core/query/use-warehouses";
import {
  useRouters,
  useCreateRouter,
  useAssignRouter,
  useTransitionRouter,
  useUpdateRouterCondition,
  extractErrorMessage,
} from "@/core/query/use-routers";

import {
  RouterTable,
  RouterForm,
  RouterAssignmentForm,
  RouterTransitionDialog,
  RouterConditionDialog,
  RouterDetail,
  RouterReportControl,
} from "@/components/routers";

import type {
  RouterRow,
  RouterStatus,
  RouterRegistrationFormValues,
  RouterAssignmentFormValues,
  RouterTransitionFormValues,
  RouterConditionFormValues,
  RouterReportJobState,
} from "@/components/routers/types";

const STATUS_OPTIONS: {
  value: RouterStatus;
  label: string;
}[] = [
  { value: "AVAILABLE", label: "متاح بالمخزن" },
  { value: "ASSIGNED_TO_TECHNICIAN", label: "بعهدة الفني" },
  { value: "INSTALLED_AT_CUSTOMER", label: "مركب لدى عميل" },
  { value: "RETURNED", label: "مرتجع للمخزن" },
  { value: "DAMAGED", label: "تالف" },
  { value: "UNDER_REPAIR", label: "قيد الصيانة" },
  { value: "LOST", label: "مفقود" },
  { value: "DECOMMISSIONED", label: "مكهن / خارج الخدمة" },
];

type PageMode = "list" | "create" | "details" | "assign";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-teal-500";

function RouterPreviewContent() {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? null;
  const isAuthorizedToManage = userRole === Role.ADMIN || userRole === Role.WAREHOUSE_STAFF;

  // Filter & Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleWarehouseChange = (value: string) => {
    setWarehouseFilter(value);
    setCurrentPage(1);
  };

  const routerQueryParams = useMemo<RouterQueryDto>(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter !== "all" ? (statusFilter as RouterStatus) : undefined,
      warehouseId: warehouseFilter !== "all" ? warehouseFilter : undefined,
      page: currentPage,
      limit: 20,
    }),
    [search, statusFilter, warehouseFilter, currentPage]
  );

  // Live queries
  const {
    routers: liveRouters,
    total: totalRoutersCount,
    totalPages,
    isLoading: isRoutersLoading,
    error: routersError,
    refetch: refetchRouters,
  } = useRouters(routerQueryParams);

  const { products: liveProducts } = useProducts();
  const serializedProducts = useMemo(
    () => liveProducts.filter((p) => p.isSerialized !== false),
    [liveProducts]
  );

  const { warehouses: liveWarehouses } = useWarehouses();
  const activeWarehouses = useMemo(() => {
    return liveWarehouses
      .filter((w) => w.isActive)
      .map((w) => ({ id: w.id, name: w.name }));
  }, [liveWarehouses]);

  const { technicians: lookupTechnicians } = useTechniciansLookup();
  const activeTechnicians = lookupTechnicians;

  // Live mutations
  const createRouterMutation = useCreateRouter();
  const assignRouterMutation = useAssignRouter();
  const transitionRouterMutation = useTransitionRouter();
  const updateConditionMutation = useUpdateRouterCondition();

  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [isConditionOpen, setIsConditionOpen] = useState(false);

  // Normalized router list (server-filtered and paginated)
  const routers = useMemo<RouterRow[]>(() => {
    return liveRouters.map((r) => {
      const prod = serializedProducts.find((p) => p.id === r.productId);
      const wh = activeWarehouses.find((w) => w.id === r.warehouseId);
      return {
        id: r.id,
        serialNumber: r.serialNumber,
        productId: r.productId,
        productName: r.product?.name ?? prod?.name ?? "راوتر",
        productSku: r.product?.sku ?? prod?.sku,
        productModel: r.product?.model ?? prod?.model,
        status: r.status,
        physicalCondition: r.physicalCondition,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse?.name ?? wh?.name ?? (r.warehouseId ? "المخزن" : null),
        externalLocation: r.externalLocation,
        currentHolderType: r.currentHolderType,
        currentHolderId: r.currentHolderId,
        notes: r.notes,
        createdAt: r.createdAt,
      };
    });
  }, [liveRouters, serializedProducts, activeWarehouses]);

  const [pageMode, setPageMode] = useState<PageMode>("list");
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [reportJob, setReportJob] = useState<RouterReportJobState | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportReport = async () => {
    setIsExporting(true);
    setReportJob({ status: "QUEUED" });
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setReportJob({ status: "RUNNING", progress: 60 });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setReportJob({
        status: "COMPLETED",
        progress: 100,
        downloadUrl: "/api/routers/export/download",
      });
    } catch {
      setReportJob({
        status: "FAILED",
        error: "فشل طلب تصدير تقرير أجهزة الراوتر.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedRouter = useMemo(
    () => routers.find((router) => router.id === selectedRouterId) ?? null,
    [routers, selectedRouterId]
  );

  const statistics = useMemo(
    () => ({
      total: totalRoutersCount,
      available: routers.filter(
        (router) => router.status === "AVAILABLE" && router.physicalCondition === "SERVICEABLE"
      ).length,
      assigned: routers.filter((router) => router.status === "ASSIGNED_TO_TECHNICIAN").length,
      installed: routers.filter((router) => router.status === "INSTALLED_AT_CUSTOMER").length,
      attention: routers.filter(
        (router) =>
          router.status === "DAMAGED" ||
          router.status === "UNDER_REPAIR" ||
          router.physicalCondition !== "SERVICEABLE"
      ).length,
    }),
    [totalRoutersCount, routers]
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

  function openAssign(routerId?: string) {
    setSelectedRouterId(routerId ?? null);
    setNotification(null);
    setPageMode("assign");
  }

  async function handleRouterSubmit(values: RouterRegistrationFormValues) {
    try {
      await createRouterMutation.mutateAsync({
        serialNumber: values.serialNumber,
        productId: values.productId,
        warehouseId: values.warehouseId,
        physicalCondition: values.physicalCondition,
        isNewReceipt: values.isNewReceipt,
        notes: values.notes || undefined,
      });

      setNotification(
        values.isNewReceipt
          ? "تم استلام وتسجيل الراوتر الجديد بنجاح وإضافته لرصيد المخزن (+1 وارد مورد)."
          : "تم تسجيل الراوتر من رصيد المخزن الحالي بنجاح (فحص السعة مكتمل)."
      );

      backToList();
    } catch (err) {
      throw new Error(extractErrorMessage(err, "فشلت عملية تسجيل الراوتر."));
    }
  }

  async function handleAssignmentSubmit(values: RouterAssignmentFormValues) {
    try {
      await assignRouterMutation.mutateAsync({
        id: values.routerId,
        dto: {
          technicianId: values.technicianId,
          notes: values.notes || undefined,
        },
      });

      setNotification("تم صرف وتخصيص الراوتر للفني بنجاح وتحديث عهدة المخزن.");
      backToList();
    } catch (err) {
      throw new Error(extractErrorMessage(err, "فشلت عملية تخصيص الراوتر للفني."));
    }
  }

  async function handleTransitionSubmit(values: RouterTransitionFormValues) {
    if (!selectedRouter) return;
    try {
      await transitionRouterMutation.mutateAsync({
        id: selectedRouter.id,
        dto: {
          status: values.status,
          reason: values.reason,
          targetWarehouseId: values.targetWarehouseId,
          notes: values.notes,
        },
      });

      setNotification("تم تحديث دورة حياة الراوتر بنجاح وتوثيق السجل الرقابي.");
      setIsTransitionOpen(false);
    } catch (err) {
      throw new Error(extractErrorMessage(err, "فشلت عملية تغيير حالة الراوتر."));
    }
  }

  async function handleConditionSubmit(values: RouterConditionFormValues) {
    if (!selectedRouter) return;
    try {
      await updateConditionMutation.mutateAsync({
        id: selectedRouter.id,
        dto: {
          physicalCondition: values.physicalCondition,
          warehouseId: values.locationType === "warehouse" ? values.warehouseId : undefined,
          externalLocation: values.locationType === "external" ? values.externalLocation : undefined,
          reason: values.reason,
        },
      });

      setNotification("تم تحديث الحالة الفيزيائية والموقع للراوتر بنجاح وتحديث الرصيد.");
      setIsConditionOpen(false);
    } catch (err) {
      throw new Error(extractErrorMessage(err, "فشلت عملية تحديث الحالة والموقع."));
    }
  }

  const statCards = [
    {
      label: "إجمالي الأجهزة المطابقة",
      sublabel: "في قاعدة البيانات",
      value: statistics.total,
      icon: RouterIcon,
    },
    {
      label: "متاح بالمخزن",
      sublabel: `في الصفحة المعروضة (${routers.length})`,
      value: statistics.available,
      icon: PackageCheck,
    },
    {
      label: "بعهدة الفنيين",
      sublabel: `في الصفحة المعروضة (${routers.length})`,
      value: statistics.assigned,
      icon: UserRoundPlus,
    },
    {
      label: "تم تركيبها للعملاء",
      sublabel: `في الصفحة المعروضة (${routers.length})`,
      value: statistics.installed,
      icon: Wifi,
    },
    {
      label: "تالف أو قيد الإصلاح",
      sublabel: `في الصفحة المعروضة (${routers.length})`,
      value: statistics.attention,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Live System Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
        <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
        <div>
          <p className="font-semibold">نظام إدارة الأصول التسلسلية والراوترات (B4)</p>
          <p className="mt-1 text-sm">
            متصل مباشرة بالخادم (Backend API) لإدارة أجهزة الراوتر بدورة الحالات الثمانية الرسمية، نمطي الاستلام (شحنة جديدة أو من الرصيد الحالي مع فحص السعة المتاحة)، وفصل العهدة والمواقع الفيزيائية.
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
              <p className="mt-1 text-sm text-white/80">Real Router Lifecycle & Serialized Asset Management</p>
            </div>
          </div>

          <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            Real Backend Connected
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
                <p className="mt-0.5 text-[10px] text-muted-foreground/80">{stat.sublabel}</p>
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

      {/* Router List View */}
      {pageMode === "list" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">قائمة أجهزة الراوتر</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                البحث بالسيريال أو الموقع أو الملاحظات ومتابعة الحالات والعهد الفيزيائية.
              </p>
            </div>

            {isAuthorizedToManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openAssign()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-teal-600 px-4 text-sm font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
                >
                  <UserRoundPlus className="h-4 w-4" />
                  صرف وتخصيص لفني
                </button>

                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  تسجيل راوتر جديد
                </button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="ابحث بالسيريال أو الموقع أو الملاحظات..."
                aria-label="البحث عن راوتر بالسيريال أو الموقع أو الملاحظات"
                className={`${inputClass} pr-10`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => handleStatusChange(event.target.value)}
              aria-label="تصفية حسب حالة الراوتر"
              className={inputClass}
            >
              <option value="all">جميع الحالات (8 حالات)</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={warehouseFilter}
              onChange={(event) => handleWarehouseChange(event.target.value)}
              aria-label="تصفية حسب المخزن"
              className={inputClass}
            >
              <option value="all">جميع المخازن</option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          {/* Export Report Control */}
          <div className="rounded-xl border bg-muted/20 p-4">
            <RouterReportControl
              job={reportJob}
              canExport={isAuthorizedToManage}
              isExporting={isExporting}
              onExport={handleExportReport}
              onReset={() => setReportJob(null)}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            عدد الأجهزة المعروضة: {routers.length} من إجمالي {totalRoutersCount}
          </p>

          <RouterTable
            routers={routers}
            isLoading={isRoutersLoading}
            error={routersError ? new Error(routersError) : null}
            onRetry={refetchRouters}
            onRouterClick={openDetails}
          />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
              <span className="text-xs text-muted-foreground">
                صفحة {currentPage} من {Math.max(totalPages, 1)} (إجمالي {totalRoutersCount} جهاز)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1 || isRoutersLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  aria-label="الصفحة السابقة"
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage >= totalPages || isRoutersLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  aria-label="الصفحة التالية"
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Registration Mode (isNewReceipt toggle + product catalog) */}
      {pageMode === "create" && (
        <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة إلى القائمة
          </button>

          <RouterForm
            products={serializedProducts}
            warehouses={activeWarehouses}
            isSubmitting={createRouterMutation.isPending}
            onSubmit={handleRouterSubmit}
            onCancel={backToList}
          />
        </section>
      )}

      {/* Assignment Mode */}
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
            technicians={activeTechnicians}
            initialRouterId={selectedRouterId ?? ""}
            isSubmitting={assignRouterMutation.isPending}
            onSubmit={handleAssignmentSubmit}
            onCancel={selectedRouter ? () => openDetails(selectedRouter) : backToList}
          />
        </section>
      )}

      {/* Router Details */}
      {pageMode === "details" && selectedRouter && (
        <div className="space-y-6">
          <RouterDetail
            router={selectedRouter}
            canManage={isAuthorizedToManage}
            onBack={backToList}
            onAssign={() => openAssign(selectedRouter.id)}
            onTransition={() => setIsTransitionOpen(true)}
            onUpdateCondition={() => setIsConditionOpen(true)}
          />

          {/* Transition Dialog */}
          <RouterTransitionDialog
            router={selectedRouter}
            warehouses={activeWarehouses}
            isOpen={isTransitionOpen}
            onClose={() => setIsTransitionOpen(false)}
            onSubmit={handleTransitionSubmit}
            onOpenAssign={() => openAssign(selectedRouter.id)}
            isSubmitting={transitionRouterMutation.isPending}
          />

          {/* Condition Dialog */}
          <RouterConditionDialog
            router={selectedRouter}
            warehouses={activeWarehouses}
            isOpen={isConditionOpen}
            onClose={() => setIsConditionOpen(false)}
            onSubmit={handleConditionSubmit}
            isSubmitting={updateConditionMutation.isPending}
          />
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        نظام الفهد لإدارة وتتبع الأجهزة والراوترات — متصل بالخادم المركزي
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
