"use client";

import { useState } from "react";
import {
  ArrowRight,
  MapPin,
  Pencil,
  PowerOff,
  ShieldAlert,
  Users,
  Package,
  History,
  AlertTriangle,
  RefreshCw,
  UserCheck,
} from "lucide-react";

import { WarehouseStockTable } from "./warehouse-stock-table";
import { WarehouseStaffTable } from "./warehouse-staff-table";
import { WarehouseMovementsTable } from "./warehouse-movements-table";
import type {
  WarehouseRow,
  WarehouseStockRow,
  WarehouseStaffRow,
  WarehouseMovementRow,
  WarehouseCapabilities,
} from "./types";

export interface WarehouseDetailProps {
  warehouse: WarehouseRow;
  managerName?: string | null;
  staff?: WarehouseStaffRow[];
  stock?: WarehouseStockRow[];
  movements?: WarehouseMovementRow[];
  isLoadingStaff?: boolean;
  isLoadingStock?: boolean;
  isLoadingMovements?: boolean;
  staffError?: Error | string | null;
  stockError?: Error | string | null;
  movementsError?: Error | string | null;
  isStaffForbidden?: boolean;
  isMovementsForbidden?: boolean;
  onRetryStaff?: () => void;
  onRetryStock?: () => void;
  onRetryMovements?: () => void;
  onBack: () => void;
  onEdit?: (warehouse: WarehouseRow) => void;
  onDeactivate?: (warehouse: WarehouseRow) => void;
  canManage?: boolean;
  capabilities?: WarehouseCapabilities;
}

export function WarehouseDetail({
  warehouse,
  managerName,
  staff = [],
  stock = [],
  movements = [],
  isLoadingStaff = false,
  isLoadingStock = false,
  isLoadingMovements = false,
  staffError = null,
  stockError = null,
  movementsError = null,
  isStaffForbidden = false,
  isMovementsForbidden = false,
  onRetryStaff,
  onRetryStock,
  onRetryMovements,
  onBack,
  onEdit,
  onDeactivate,
  canManage = false,
  capabilities,
}: WarehouseDetailProps) {
  const [activeTab, setActiveTab] = useState<"stock" | "staff" | "movements">("stock");

  const canEdit = capabilities?.edit ?? canManage;
  const canDeactivate = capabilities?.deactivate ?? canManage;

  const resolvedStockError = typeof stockError === "string" ? new Error(stockError) : stockError;
  const resolvedStaffError = typeof staffError === "string" ? new Error(staffError) : staffError;
  const resolvedMovementsError =
    typeof movementsError === "string" ? new Error(movementsError) : movementsError;

  const lowStockItems = stock.filter((item) => item.quantity <= item.lowStockThreshold);

  // Truthful manager label
  const resolvedManagerLabel =
    managerName ??
    warehouse.managerName ??
    (warehouse.managerId ? "مدير مسجل (المعرف متاح)" : "بدون مدير مخزن حاليًا");

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header and Back Navigation */}
      <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
        >
          <ArrowRight className="h-4 w-4" />
          العودة إلى قائمة المخازن
        </button>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{warehouse.name}</h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  warehouse.isActive
                    ? "border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
                    : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                {warehouse.isActive ? "نشط" : "معطل"}
              </span>
            </div>

            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              {warehouse.address}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(warehouse)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
                aria-label={`تعديل بيانات ${warehouse.name}`}
              >
                <Pencil className="h-4 w-4" />
                تعديل المخزن
              </button>
            )}

            {canDeactivate && warehouse.isActive && onDeactivate && (
              <button
                type="button"
                onClick={() => onDeactivate(warehouse)}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                aria-label={`تعطيل ${warehouse.name}`}
              >
                <PowerOff className="h-4 w-4" />
                تعطيل المخزن
              </button>
            )}
          </div>
        </div>

        {/* Real Info Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">خط العرض (Latitude)</p>
            <p className="mt-1.5 font-mono text-base font-semibold" dir="ltr">
              {warehouse.latitude.toFixed(6)}
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">خط الطول (Longitude)</p>
            <p className="mt-1.5 font-mono text-base font-semibold" dir="ltr">
              {warehouse.longitude.toFixed(6)}
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">السياج الجغرافي للحضور</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-base font-bold text-teal-700 dark:text-teal-300">
              <ShieldAlert className="h-4 w-4" />
              {warehouse.geofenceRadiusMeters ?? 150} متر
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">المدير المسؤول</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold truncate text-foreground">
              <UserCheck className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate">{resolvedManagerLabel}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Low Stock Banner if low stock items exist */}
      {lowStockItems.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-sm">تنبيه انخفاض المخزون</p>
            <p className="mt-1 text-xs">
              يوجد {lowStockItems.length} صنف يحتاج إلى مراجعة مستوى المخزون، بما في ذلك الأصناف التي
              نفدت كميتها بالكامل.
            </p>
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="border-b">
        <nav className="flex space-x-reverse space-x-6 text-sm font-medium" aria-label="أقسام تفاصيل المخزن">
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-1 transition-colors ${
              activeTab === "stock"
                ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4" />
            الأصناف والمخزون ({stock.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-1 transition-colors ${
              activeTab === "staff"
                ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            الموظفون التابعون ({staff.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("movements")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-1 transition-colors ${
              activeTab === "movements"
                ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            حركات المخزون ({movements.length})
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === "stock" && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm" aria-label="جدول المخزون">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">الأصناف المتاحة في المخزن</h3>
            {onRetryStock && (
              <button
                type="button"
                onClick={onRetryStock}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                تحديث
              </button>
            )}
          </div>
          <WarehouseStockTable
            items={stock}
            isLoading={isLoadingStock}
            error={resolvedStockError}
            onRetry={onRetryStock}
          />
        </section>
      )}

      {activeTab === "staff" && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm" aria-label="جدول الموظفين">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">الموظفون والفنيون المعينون</h3>
            {!isStaffForbidden && onRetryStaff && (
              <button
                type="button"
                onClick={onRetryStaff}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                تحديث
              </button>
            )}
          </div>
          {isStaffForbidden ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              بيانات موظفي المستودع مخصصة للإدارة ومسؤولي المستودعات فقط.
            </div>
          ) : (
            <WarehouseStaffTable
              staff={staff}
              isLoading={isLoadingStaff}
              error={resolvedStaffError}
              onRetry={onRetryStaff}
            />
          )}
        </section>
      )}

      {activeTab === "movements" && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm" aria-label="جدول حركات المخزون">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">سجل حركات الوارد والصادر والمرتجعات</h3>
            {!isMovementsForbidden && onRetryMovements && (
              <button
                type="button"
                onClick={onRetryMovements}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                تحديث
              </button>
            )}
          </div>
          {isMovementsForbidden ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              سجل حركات المستودع مخصص للإدارة ومسؤولي المستودعات فقط.
            </div>
          ) : (
            <WarehouseMovementsTable
              movements={movements}
              isLoading={isLoadingMovements}
              error={resolvedMovementsError}
              onRetry={onRetryMovements}
            />
          )}
        </section>
      )}
    </div>
  );
}
