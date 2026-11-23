"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Pencil,
  Archive,
  AlertTriangle,
  Warehouse,
  History,
  Hash,
  ShieldAlert,
} from "lucide-react";

import { InventoryStockTable } from "./inventory-stock-table";
import { InventoryMovementsTable } from "./inventory-movements-table";
import type {
  ProductRow,
  InventoryStockRow,
  InventoryMovementRow,
  ProductCapabilities,
} from "./types";

export interface ProductDetailProps {
  product: ProductRow;
  stocks?: InventoryStockRow[];
  movements?: InventoryMovementRow[];
  isLoadingStocks?: boolean;
  isLoadingMovements?: boolean;
  stocksError?: Error | string | null;
  movementsError?: Error | string | null;
  onRetryStocks?: () => void;
  onRetryMovements?: () => void;
  onBack: () => void;
  onEdit?: (product: ProductRow) => void;
  onDeactivate?: (product: ProductRow) => void;
  capabilities?: ProductCapabilities;
  canManage?: boolean;
}

export function ProductDetail({
  product,
  stocks = [],
  movements = [],
  isLoadingStocks = false,
  isLoadingMovements = false,
  stocksError = null,
  movementsError = null,
  onRetryStocks,
  onRetryMovements,
  onBack,
  onEdit,
  onDeactivate,
  capabilities,
  canManage = false,
}: ProductDetailProps) {
  const [activeTab, setActiveTab] = useState<"stocks" | "movements">("stocks");

  const canEdit = capabilities?.edit ?? canManage;
  const canDeactivate = capabilities?.deactivate ?? canManage;

  const totalStock = stocks.reduce((acc, s) => acc + s.quantity, 0);
  const isLowStock = totalStock <= product.lowStockThreshold;

  const resolvedStocksError =
    typeof stocksError === "string" ? new Error(stocksError) : stocksError;
  const resolvedMovementsError =
    typeof movementsError === "string" ? new Error(movementsError) : movementsError;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header and Back navigation */}
      <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
        >
          <ArrowRight className="h-4 w-4" />
          العودة إلى كتالوج الأصناف
        </button>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <Package className="h-7 w-7" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    product.isActive
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {product.isActive ? "نشط" : "معطّل / مؤرشف"}
                </span>

                {product.isSerialized && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    صنف متتبع بالسيريال
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-mono font-medium">
                  <Hash className="h-3.5 w-3.5" />
                  {product.sku}
                </span>
                <span>•</span>
                <span>الموديل: {product.model}</span>
                <span>•</span>
                <span>التصنيف: {product.category}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
                aria-label={`تعديل بيانات ${product.name}`}
              >
                <Pencil className="h-4 w-4" />
                تعديل الصنف
              </button>
            )}

            {canDeactivate && product.isActive && onDeactivate && (
              <button
                type="button"
                onClick={() => onDeactivate(product)}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                aria-label={`تعطيل ${product.name}`}
              >
                <Archive className="h-4 w-4" />
                تعطيل الصنف
              </button>
            )}
          </div>
        </div>

        {/* Product Attributes Overview */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">رمز الصنف (SKU)</p>
            <p className="mt-1.5 font-mono text-base font-semibold" dir="ltr">
              {product.sku}
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">إجمالي الرصيد بالمستودعات</p>
            <p className="mt-1.5 text-base font-bold text-foreground">
              {totalStock.toLocaleString("ar-EG")} وحدة
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">حد التنبيه (Low Stock Threshold)</p>
            <p className="mt-1.5 text-base font-bold text-teal-700 dark:text-teal-300">
              {(product.lowStockThreshold ?? 10).toLocaleString("ar-EG")} وحدة
            </p>
          </div>

          <div className="rounded-xl border p-4 bg-background">
            <p className="text-xs text-muted-foreground">حالة توفر المخزون</p>
            <p
              className={`mt-1.5 text-sm font-semibold ${
                totalStock === 0
                  ? "text-red-600"
                  : isLowStock
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            >
              {totalStock === 0 ? "نفد المخزون بالكامل" : isLowStock ? "مخزون منخفض" : "متوفر بكمية كافية"}
            </p>
          </div>
        </div>

        {product.description && (
          <div className="rounded-xl border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">الوصف والملاحظات: </span>
            {product.description}
          </div>
        )}
      </section>

      {/* Phase 4: Serialized Product Guardrail Banner */}
      {product.isSerialized && (
        <div
          role="region"
          aria-label="تنبيه الأجهزة المتبعة بالسيريال"
          className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 shadow-xs"
        >
          <div className="flex items-start gap-3.5">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-2">
              <h3 className="font-bold text-base">صنف خاضع للتتبع الفردي برقم السيريال (Serial Number)</h3>
              <p className="text-xs leading-relaxed opacity-90 max-w-3xl">
                هذا الصنف خاضع لإدارة الأصول والتتبع الفردي برقم السيريال (راوترات وأجهزة معرّفة). يمنع
                النظام الحركات الكمية المجردة عليه لحماية دورة حياة العهدة والتتبع. يتم تسجيل استلام،
                صرف، فحص، وانتقال هذه الأجهزة حصرياً من خلال شاشة إدارة الراوترات.
              </p>
              <div className="pt-1">
                <Link
                  href="/routers-preview"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  الانتقال إلى شاشة إدارة الراوترات
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Low stock alert */}
      {isLowStock && totalStock > 0 && !product.isSerialized && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-xs">
            <p className="font-semibold text-sm">تنبيه انخفاض المخزون:</p>
            <p className="mt-1">
              الرصيد الإجمالي الحالي ({totalStock.toLocaleString("ar-EG")}) وصل أو قل عن حد التنبيه المحدد (
              {product.lowStockThreshold.toLocaleString("ar-EG")}). يرجى المبادرة بطلب توريد كميات جديدة.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-reverse space-x-6 text-sm font-medium" aria-label="أقسام تفاصيل الصنف">
          <button
            type="button"
            onClick={() => setActiveTab("stocks")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-1 transition-colors ${
              activeTab === "stocks"
                ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Warehouse className="h-4 w-4" />
            توزيع الرصيد عبر المخازن ({stocks.length})
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
            سجل الحركات الخاصة بالصنف ({movements.length})
          </button>
        </nav>
      </div>

      {/* Tab Contents */}
      {activeTab === "stocks" && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">الأرصدة المتوفرة في المخازن</h3>
          </div>
          <InventoryStockTable
            stocks={stocks}
            isLoading={isLoadingStocks}
            error={resolvedStocksError}
            onRetry={onRetryStocks}
          />
        </section>
      )}

      {activeTab === "movements" && (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">سجل الوارد والصرف والتحويل لهذا الصنف</h3>
          </div>
          <InventoryMovementsTable
            movements={movements}
            isLoading={isLoadingMovements}
            error={resolvedMovementsError}
            onRetry={onRetryMovements}
          />
        </section>
      )}
    </div>
  );
}
