"use client";

import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  MapPin,
  UserRound,
  UserRoundPlus,
  Wrench,
} from "lucide-react";

import { STATUS_CONFIG, CONDITION_CONFIG } from "./router-table";
import { RouterTripleAudit } from "./router-triple-audit";
import type { RouterRow } from "./types";

export interface RouterDetailProps {
  router: RouterRow;
  canManage?: boolean;
  onAssign?: () => void;
  onTransition?: () => void;
  onUpdateCondition?: () => void;
  onBack?: () => void;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Cairo",
  }).format(date);
}

export function RouterDetail({
  router,
  canManage = true,
  onAssign,
  onTransition,
  onUpdateCondition,
  onBack,
}: RouterDetailProps) {
  const statusConfig = STATUS_CONFIG[router.status] ?? {
    label: router.status,
    className: "border-gray-200 bg-gray-50 text-gray-700",
  };

  const conditionConfig = CONDITION_CONFIG[router.physicalCondition] ?? {
    label: router.physicalCondition,
    icon: CheckCircle2,
    className: "text-gray-700 bg-gray-50 border-gray-200",
  };
  const ConditionIcon = conditionConfig.icon;

  const isTerminal = router.status === "LOST" || router.status === "DECOMMISSIONED";
  const isEligibleForAssignment =
    router.status === "AVAILABLE" &&
    router.physicalCondition === "SERVICEABLE" &&
    Boolean(router.warehouseId);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="الرجوع لقائمة الأجهزة"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-muted"
            >
              <ArrowRight className="h-5 w-5 rtl:rotate-0" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground" dir="ltr">
                {router.serialNumber}
              </h1>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusConfig.className}`}
              >
                {statusConfig.label}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium ${conditionConfig.className}`}
              >
                <ConditionIcon className="h-3.5 w-3.5" />
                {conditionConfig.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {router.productName} {router.productModel ? `(${router.productModel})` : ""}{" "}
              {router.productSku ? `— ${router.productSku}` : ""}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Assign button only enabled if eligible */}
            {isEligibleForAssignment && onAssign && (
              <button
                type="button"
                onClick={onAssign}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors"
              >
                <UserRoundPlus className="h-4 w-4" />
                صرف وتخصيص للفني
              </button>
            )}

            {!isTerminal && (
              <>
                {onTransition && (
                  <button
                    type="button"
                    onClick={onTransition}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    تغيير حالة الدورة
                  </button>
                )}

                {onUpdateCondition && (
                  <button
                    type="button"
                    onClick={onUpdateCondition}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Wrench className="h-4 w-4" />
                    تعديل الحالة والموقع
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Terminal State Warning Banner */}
      {isTerminal && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold text-sm">حالة نهائية غير قابلة للتغيير</p>
              <p className="mt-1 text-xs leading-relaxed">
                هذا الجهاز مسجل في حالة نهائية ({statusConfig.label}). بموجب قواعد الحوكمة والرقابة المعتمدة، لا يمكن نقل عهدته أو تغيير حالته أو تعديل موقعه.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ineligibility Reason Notice (when AVAILABLE but cannot be assigned) */}
      {router.status === "AVAILABLE" && !isEligibleForAssignment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-sm">الجهاز غير مؤهل للصرف الميداني</p>
              <p className="mt-1 text-xs leading-relaxed">
                {router.physicalCondition !== "SERVICEABLE"
                  ? `الحالة الفيزيائية الحالية للجهاز (${conditionConfig.label}) تمنع صرفه للفني. يجب صيانة الجهاز والتأكد من سلامته أولاً.`
                  : "الجهاز غير مرتبط بمخزن معتمد حالياً. يلزم تحديد موقع مخزني صالح قبل الصرف."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Four Independent Dimensions Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Lifecycle Status */}
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">1. دورة الحياة (Lifecycle)</span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusConfig.className}`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* 2. Physical Condition */}
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">2. الحالة الفيزيائية (Condition)</span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${conditionConfig.className}`}
            >
              <ConditionIcon className="h-3.5 w-3.5" />
              {conditionConfig.label}
            </span>
          </div>
        </div>

        {/* 3. Physical Location */}
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">3. الموقع الفيزيائي (Location)</span>
          <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {router.warehouseName || router.externalLocation || "غير محدد"}
          </div>
        </div>

        {/* 4. Current Custody */}
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">4. العهدة الحالية (Custody)</span>
          <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {!router.currentHolderType ? (
              <span className="text-muted-foreground font-normal">بدون عهدة</span>
            ) : router.currentHolderType === "WAREHOUSE" ? (
              <>
                <Building2 className="h-4 w-4 text-teal-600" />
                عهدة المخزن ({router.warehouseName ?? "المخزن"})
              </>
            ) : router.currentHolderType === "TECHNICIAN" ? (
              <>
                <UserRound className="h-4 w-4 text-blue-600" />
                {router.currentHolderName ?? `فني (${router.currentHolderId?.slice(0, 8)})`}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
                مركب لدى عميل
              </>
            )}
          </div>
        </div>
      </div>

      {/* Additional Details & Notes */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-bold text-foreground">بيانات إضافية</h3>
        <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <dt className="text-muted-foreground">تاريخ التسجيل بالنظام:</dt>
            <dd className="mt-1 font-semibold text-foreground">{formatDate(router.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">كتالوج الصنف:</dt>
            <dd className="mt-1 font-semibold text-foreground">{router.productName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">ملاحظات تشغيلية:</dt>
            <dd className="mt-1 text-foreground leading-relaxed">
              {router.notes || "لا توجد ملاحظات مسجلة."}
            </dd>
          </div>
        </dl>
      </div>

      {/* Three Audit Views */}
      <div>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-foreground">سجلات التدقيق الرقابي (Triple Audit)</h2>
          <p className="text-xs text-muted-foreground">
            تتبع مستقل لكل من: حركات العهدة، وتغيرات الحالة الفيزيائية والموقع، وانتقالات دورة الحياة.
          </p>
        </div>

        <RouterTripleAudit routerId={router.id} />
      </div>
    </div>
  );
}
