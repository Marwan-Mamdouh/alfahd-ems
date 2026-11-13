"use client";

import React, { useState, useMemo } from "react";
import {
  Globe,
  Plus,
  UploadCloud,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Archive,
  Layers,
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
} from "lucide-react";
import { RoleGuard } from "@/core/auth/guards";
import { useAuthStore } from "@/core/auth/auth.store";
import { Role, type IpQueryDto, type IpStatus } from "@alfahd/types";
import {
  useIpAddresses,
  useCreateIpAddress,
  useUpdateIpAddress,
  useReserveIpAddress,
  useReleaseIpAddress,
  useArchiveIpAddress,
  useUnarchiveIpAddress,
  extractErrorMessage,
} from "@/core/query/use-ip-addresses";
import { IpTable } from "@/components/ip-addresses/ip-table";
import { IpForm } from "@/components/ip-addresses/ip-form";
import { IpHistoryDialog } from "@/components/ip-addresses/ip-history-dialog";
import { IpImportDialog } from "@/components/ip-addresses/ip-import-dialog";
import type {
  IpAddressRow,
  IpStatusFilter,
  IpArchivedFilter,
} from "@/components/ip-addresses/types";

function IpPreviewContent() {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? null;
  const canManage = userRole === Role.ADMIN;
  const isTechnician = userRole === Role.TECHNICIAN;

  // Filter & Pagination State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IpStatusFilter>("all");
  const [archivedFilter, setArchivedFilter] = useState<IpArchivedFilter>("active");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Notification State
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "editNotes">("create");
  const [selectedIp, setSelectedIp] = useState<IpAddressRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyIp, setHistoryIp] = useState<IpAddressRow | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);

  // Query Params
  const queryParams = useMemo<IpQueryDto>(
    () => ({
      page,
      limit: pageSize,
      search: search.trim() || undefined,
      status: statusFilter === "all" ? undefined : (statusFilter as IpStatus),
      isArchived:
        archivedFilter === "all"
          ? undefined
          : archivedFilter === "archived",
    }),
    [page, pageSize, search, statusFilter, archivedFilter]
  );

  // Live Query
  const {
    ipAddresses: liveIpAddresses,
    total: liveTotal,
    totalPages: liveTotalPages,
    isLoading,
    refetch,
  } = useIpAddresses(queryParams);

  // Normalized Rows (truthful to live backend state)
  const rows = useMemo<IpAddressRow[]>(() => {
    return liveIpAddresses.map((ip) => ({
      id: ip.id,
      address: ip.address,
      status: ip.status,
      isArchived: ip.isArchived,
      customerId: ip.customerId,
      notes: ip.notes,
      createdAt: ip.createdAt,
      updatedAt: ip.updatedAt,
    }));
  }, [liveIpAddresses]);

  const totalCount = liveTotal;

  // Quick statistics (computed from live database totals and items)
  const stats = useMemo(() => {
    const total = liveTotal;
    const freeActive = liveIpAddresses.filter(
      (ip) => ip.status === "FREE" && !ip.isArchived
    ).length;
    const reserved = liveIpAddresses.filter((ip) => ip.status === "RESERVED").length;
    const archived = liveIpAddresses.filter((ip) => ip.isArchived).length;

    return { total, freeActive, reserved, archived };
  }, [liveIpAddresses, liveTotal]);

  // Mutations
  const createMutation = useCreateIpAddress();
  const updateMutation = useUpdateIpAddress();
  const reserveMutation = useReserveIpAddress();
  const releaseMutation = useReleaseIpAddress();
  const archiveMutation = useArchiveIpAddress();
  const unarchiveMutation = useUnarchiveIpAddress();

  // Handlers
  const handleOpenCreate = () => {
    setFormMode("create");
    setSelectedIp(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditNotes = (row: IpAddressRow) => {
    setFormMode("editNotes");
    setSelectedIp(row);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: { address: string; notes?: string }) => {
    setFormError(null);
    try {
      if (formMode === "create") {
        await createMutation.mutateAsync({
          address: values.address,
          notes: values.notes,
        });
        setNotification({
          type: "success",
          message: `تم تسجيل عنوان IPv4 بنجاح: ${values.address}`,
        });
      } else if (formMode === "editNotes" && selectedIp) {
        await updateMutation.mutateAsync({
          id: selectedIp.id,
          dto: { notes: values.notes },
        });
        setNotification({
          type: "success",
          message: `تم تحديث ملاحظات العنوان: ${selectedIp.address}`,
        });
      }
    } catch (err) {
      const msg = extractErrorMessage(err, "فشل حفظ بيانات عنوان IP");
      setFormError(msg);
      throw err;
    }
  };

  const handleReserve = async (row: IpAddressRow) => {
    try {
      await reserveMutation.mutateAsync({
        id: row.id,
        reason: "حجز يدوي من لوحة تحكم الإدارة",
      });
      setNotification({
        type: "success",
        message: `تم حجز العنوان بنجاح: ${row.address}`,
      });
    } catch (err) {
      const msg = extractErrorMessage(err, "فشل حجز عنوان IP");
      setNotification({ type: "error", message: msg });
    }
  };

  const handleRelease = async (row: IpAddressRow) => {
    try {
      await releaseMutation.mutateAsync({
        id: row.id,
        reason: "تحرير العنوان وإعادته للمخزون الحر",
      });
      setNotification({
        type: "success",
        message: `تم تحرير العنوان وإعادته للمتاح: ${row.address}`,
      });
    } catch (err) {
      const msg = extractErrorMessage(err, "فشل تحرير عنوان IP");
      setNotification({ type: "error", message: msg });
    }
  };

  const handleArchive = async (row: IpAddressRow) => {
    if (row.status === "RESERVED") {
      setNotification({
        type: "error",
        message: "لا يمكن أرشفة عنوان محجوز. يرجى تحريره أولاً.",
      });
      return;
    }

    try {
      await archiveMutation.mutateAsync({
        id: row.id,
        reason: "أرشفة يدوية من لوحة التحكم",
      });
      setNotification({
        type: "success",
        message: `تم أرشفة العنوان بنجاح: ${row.address}`,
      });
    } catch (err) {
      const msg = extractErrorMessage(err, "فشل أرشفة عنوان IP");
      setNotification({ type: "error", message: msg });
    }
  };

  const handleUnarchive = async (row: IpAddressRow) => {
    try {
      await unarchiveMutation.mutateAsync({
        id: row.id,
        reason: "إلغاء الأرشفة واستعادة العنوان للخدمة",
      });
      setNotification({
        type: "success",
        message: `تم إلغاء أرشفة العنوان واستعادته للمتاح: ${row.address}`,
      });
    } catch (err) {
      const msg = extractErrorMessage(err, "فشل إلغاء أرشفة عنوان IP");
      setNotification({ type: "error", message: msg });
    }
  };

  const handleViewHistory = (row: IpAddressRow) => {
    if (!canManage) return;
    setHistoryIp(row);
    setIsHistoryOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="ip-preview-page">
      {/* Top Banner / Role Notice */}
      {isTechnician && (
        <div className="flex items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-xs text-blue-800 dark:text-blue-300">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            أنت مسجل بصلاحية <strong>فني (TECHNICIAN)</strong>: يمكنك استعراض العناوين وحالاتها التشغيلية بصفة قراءة فقط، وتقتصر صلاحيات الحجز والتحرير والأرشفة وسجل التدقيق على الإدارة.
          </span>
        </div>
      )}

      {/* Notification Toast Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl border p-3.5 text-xs ${
            notification.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
          data-testid="ip-page-notification"
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <Globe className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                إدارة عناوين IP (IP Management)
              </h1>
              <p className="text-xs text-muted-foreground">
                السجل المركزي الموحد لإدارة عناوين IPv4، تتبع الحالات التشغيلية، وعمليات الأرشفة.
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
              data-testid="ip-import-open-btn"
            >
              <UploadCloud className="size-4 text-teal-600 dark:text-teal-400" />
              <span>استيراد ملف CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700 transition-colors shadow-xs"
              data-testid="ip-create-open-btn"
            >
              <Plus className="size-4" />
              <span>تسجيل عنوان IP جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>إجمالي العناوين</span>
            <Layers className="size-4" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground mt-1">المسجلة في النظام</p>
        </div>

        {/* Free Pool */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs">
            <span>المتاحة للتوزيع</span>
            <CheckCircle2 className="size-4" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.freeActive}</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">حرة ونشطة (FREE)</p>
        </div>

        {/* Reserved */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs">
            <span>المحجوزة حالياً</span>
            <Lock className="size-4" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.reserved}</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">محجوزة (RESERVED)</p>
        </div>

        {/* Archived */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>المؤرشفة</span>
            <Archive className="size-4" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.archived}</p>
          <p className="text-[11px] text-muted-foreground mt-1">خارج الخدمة (ARCHIVED)</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="البحث بالعنوان (مثال: 192.168.1.1) أو بالملاحظات..."
              className="h-10 w-full rounded-xl border border-input bg-background pr-10 pl-4 text-xs font-medium outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
              data-testid="ip-search-input"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium shrink-0 flex items-center gap-1">
              <Filter className="size-3.5" />
              <span>الحالة:</span>
            </span>

            <div className="inline-flex rounded-xl border border-border p-1 bg-muted/40 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="filter-status-all"
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("FREE");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === "FREE"
                    ? "bg-background text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="filter-status-free"
              >
                المتاح (FREE)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("RESERVED");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === "RESERVED"
                    ? "bg-background text-amber-700 dark:text-amber-300 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="filter-status-reserved"
              >
                المحجوز (RESERVED)
              </button>
            </div>

            {/* Archival Filter */}
            <div className="inline-flex rounded-xl border border-border p-1 bg-muted/40 text-xs mr-2">
              <button
                type="button"
                onClick={() => {
                  setArchivedFilter("active");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  archivedFilter === "active"
                    ? "bg-background text-teal-700 dark:text-teal-300 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="filter-archived-active"
              >
                النشطة فقط
              </button>
              <button
                type="button"
                onClick={() => {
                  setArchivedFilter("archived");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  archivedFilter === "archived"
                    ? "bg-background text-slate-700 dark:text-slate-300 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="filter-archived-only"
              >
                المؤرشفة فقط
              </button>
              <button
                type="button"
                onClick={() => {
                  setArchivedFilter("all");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  archivedFilter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="filter-archived-all"
              >
                الجميع
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <IpTable
        items={rows}
        isLoading={isLoading}
        canManage={canManage}
        onReserve={handleReserve}
        onRelease={handleRelease}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onEditNotes={handleOpenEditNotes}
        onViewHistory={handleViewHistory}
      />

      {/* Pagination Controls */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>
            عرض الصفحة <strong>{page}</strong> من <strong>{liveTotalPages || 1}</strong> (إجمالي {totalCount} عنوان)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="size-3.5" />
              <span>السابق</span>
            </button>
            <button
              type="button"
              disabled={page >= (liveTotalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <span>التالي</span>
              <ChevronLeft className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Notes Dialog */}
      <IpForm
        key={`${formMode}-${selectedIp?.id ?? "new"}-${isFormOpen ? "open" : "closed"}`}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        mode={formMode}
        initialValues={
          selectedIp
            ? { address: selectedIp.address, notes: selectedIp.notes ?? "" }
            : undefined
        }
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        errorMessage={formError}
      />

      {/* Audit History Dialog (Admin Only) */}
      {canManage && (
        <IpHistoryDialog
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryIp(null);
          }}
          ipId={historyIp?.id ?? null}
          ipAddress={historyIp?.address}
        />
      )}

      {/* CSV Import Dialog (Admin Only) */}
      {canManage && (
        <IpImportDialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => {
            refetch();
            setNotification({
              type: "success",
              message: "تم تحديث قائمة العناوين بعد استيراد ملف CSV بنجاح.",
            });
          }}
        />
      )}
    </div>
  );
}

export default function IpPreviewPage() {
  return (
    <RoleGuard permission="ips.view">
      <IpPreviewContent />
    </RoleGuard>
  );
}
