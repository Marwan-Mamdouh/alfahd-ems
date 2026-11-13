"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  History,
  MapPin,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  useRouterAssignments,
  useRouterConditionHistory,
  useRouterStatusHistory,
} from "@/core/query/use-routers";

interface RouterTripleAuditProps {
  routerId: string;
}

type TabType = "assignments" | "condition" | "status";

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "متاح بالمخزن",
  ASSIGNED_TO_TECHNICIAN: "بعهدة الفني",
  INSTALLED_AT_CUSTOMER: "مركب لدى عميل",
  RETURNED: "مرتجع للمخزن",
  DAMAGED: "تالف",
  UNDER_REPAIR: "قيد الصيانة",
  LOST: "مفقود",
  DECOMMISSIONED: "مكهن / خارج الخدمة",
};

const CONDITION_LABELS: Record<string, string> = {
  SERVICEABLE: "سليم (صالح)",
  DAMAGED: "تالف",
  UNDER_REPAIR: "قيد الصيانة",
};

function formatDate(isoString?: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  }).format(date);
}

export function RouterTripleAudit({ routerId }: RouterTripleAuditProps) {
  const [activeTab, setActiveTab] = useState<TabType>("assignments");

  // Live queries for all three audit ledgers
  const {
    assignments,
    isLoading: isAssignmentsLoading,
  } = useRouterAssignments(routerId);

  const {
    conditionHistory,
    isLoading: isConditionLoading,
  } = useRouterConditionHistory(routerId);

  const {
    statusHistory,
    isLoading: isStatusLoading,
  } = useRouterStatusHistory(routerId);

  return (
    <div className="rounded-2xl border bg-card shadow-sm" dir="rtl">
      {/* Tab Navigation */}
      <div className="flex border-b bg-muted/30 px-6 pt-4">
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "assignments"}
            onClick={() => setActiveTab("assignments")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-semibold transition-colors ${
              activeTab === "assignments"
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            سجل العهدة والتخصيصات
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono">
              {assignments.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "condition"}
            onClick={() => setActiveTab("condition")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-semibold transition-colors ${
              activeTab === "condition"
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench className="h-4 w-4" />
            سجل الحالة الفيزيائية والموقع
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono">
              {conditionHistory.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "status"}
            onClick={() => setActiveTab("status")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-semibold transition-colors ${
              activeTab === "status"
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            سجل دورة الحياة
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono">
              {statusHistory.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="p-6">
        {/* Tab 1: Assignments History */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
            {isAssignmentsLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                جاري تحميل سجل العهدة والتخصيصات...
              </div>
            ) : assignments.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                لا توجد سجلات عهدة سابقة لهذا الجهاز.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">نوع العهدة</th>
                      <th className="py-3 px-4">المستلم / المعين إليه</th>
                      <th className="py-3 px-4">تاريخ الاستلام</th>
                      <th className="py-3 px-4">حالة العهدة</th>
                      <th className="py-3 px-4">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assignments.map((asgn) => {
                      const isActive = !asgn.releasedAt;
                      return (
                        <tr key={asgn.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              {asgn.holderType === "WAREHOUSE" ? (
                                <>
                                  <Building2 className="h-4 w-4 text-teal-600" />
                                  عهدة مخزن
                                </>
                              ) : asgn.holderType === "TECHNICIAN" ? (
                                <>
                                  <UserRound className="h-4 w-4 text-blue-600" />
                                  عهدة فني
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                                  مركب لعميل
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {asgn.technicianId
                              ? `فني (${asgn.technicianId.slice(0, 8)})`
                              : asgn.warehouseId
                              ? `مخزن (${asgn.warehouseId.slice(0, 8)})`
                              : "—"}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {formatDate(asgn.assignedAt)}
                          </td>
                          <td className="py-3 px-4">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse" />
                                عهدة نشطة حالياً
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                تم إخلاء العهدة: {formatDate(asgn.releasedAt)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {asgn.notes || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Condition & Location History */}
        {activeTab === "condition" && (
          <div className="space-y-4">
            {isConditionLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                جاري تحميل سجل الحالة والموقع...
              </div>
            ) : conditionHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                لا توجد تعديلات سابقة للحالة الفيزيائية أو الموقع.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">الحالة الفيزيائية</th>
                      <th className="py-3 px-4">الموقع الفيزيائي</th>
                      <th className="py-3 px-4">سبب التعديل / تقرير الفحص</th>
                      <th className="py-3 px-4">التاريخ والوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {conditionHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="line-through text-muted-foreground">
                              {CONDITION_LABELS[item.fromCondition] ?? item.fromCondition}
                            </span>
                            <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold text-foreground">
                              {CONDITION_LABELS[item.toCondition] ?? item.toCondition}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.externalLocation
                              ? `موقع خارجي: ${item.externalLocation}`
                              : item.toWarehouseId
                              ? `مخزن (${item.toWarehouseId.slice(0, 8)})`
                              : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-foreground">
                          {item.reason}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Lifecycle Status History */}
        {activeTab === "status" && (
          <div className="space-y-4">
            {isStatusLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                جاري تحميل سجل دورة الحياة...
              </div>
            ) : statusHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                لا توجد انتقالات سابقة مسجلة لدورة الحياة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">الانتقال</th>
                      <th className="py-3 px-4">سبب الانتقال</th>
                      <th className="py-3 px-4">التاريخ والوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {statusHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="line-through text-muted-foreground">
                              {STATUS_LABELS[item.fromStatus] ?? item.fromStatus}
                            </span>
                            <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold text-teal-700 dark:text-teal-300">
                              {STATUS_LABELS[item.toStatus] ?? item.toStatus}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-foreground">
                          {item.reason}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
