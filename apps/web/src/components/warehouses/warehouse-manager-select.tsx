"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, RefreshCw, UserCheck, X } from "lucide-react";
import type { ManagerOption, ManagerSelector, Remote } from "./types";

export interface WarehouseManagerSelectProps {
  value: string;
  onChange: (value: string) => void;
  selector?: ManagerSelector;
  options?: readonly ManagerOption[] | Remote<readonly ManagerOption[]>;
  search?: string;
  onSearchChange?: (search: string) => void;
  currentOnly?: { id: string; name: string | null; reason: "inactive" | "unresolved" } | null;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string;
  id?: string;
}

function isRemote(
  opt: unknown
): opt is Remote<readonly ManagerOption[]> {
  return typeof opt === "object" && opt !== null && "kind" in opt;
}

export function WarehouseManagerSelect({
  value,
  onChange,
  selector,
  options: directOptions,
  search: externalSearch,
  onSearchChange: externalOnSearchChange,
  currentOnly: directCurrentOnly,
  isLoading = false,
  disabled = false,
  error,
  id = "warehouse-manager",
}: WarehouseManagerSelectProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Reconcile props from selector object or direct props
  const rawOptions = selector?.options ?? directOptions;
  const search = selector?.search ?? externalSearch ?? internalSearch;
  const handleSearchChange =
    selector?.onSearchChange ?? externalOnSearchChange ?? setInternalSearch;
  const currentOnly = selector?.currentOnly ?? directCurrentOnly;

  // Resolve remote state
  const resolvedState = useMemo(() => {
    let options: readonly ManagerOption[] = [];
    let isRemoteLoading = false;
    let remoteErrorMessage: string | null = null;
    let remoteRetry: (() => void) | undefined;

    if (isRemote(rawOptions)) {
      if (rawOptions.kind === "loading") {
        isRemoteLoading = true;
      } else if (rawOptions.kind === "error") {
        remoteErrorMessage = rawOptions.message;
        remoteRetry = rawOptions.retry;
      } else if (rawOptions.kind === "ready") {
        options = rawOptions.value;
      }
    } else if (Array.isArray(rawOptions)) {
      options = rawOptions;
    }

    return {
      options,
      isRemoteLoading,
      remoteErrorMessage,
      remoteRetry,
    };
  }, [rawOptions]);

  const {
    options: resolvedOptions,
    isRemoteLoading,
    remoteErrorMessage,
    remoteRetry,
  } = resolvedState;

  const loading = isLoading || isRemoteLoading;

  // Filter options by search term and role eligibility (ADMIN or WAREHOUSE_STAFF)
  const filteredOptions = useMemo(() => {
    const term = (search || "").trim().toLowerCase();
    return resolvedOptions.filter((opt) => {
      // Must be ACTIVE ADMIN or WAREHOUSE_STAFF (Criterion D)
      const roleMatches = opt.role === "ADMIN" || opt.role === "WAREHOUSE_STAFF";
      const statusMatches = opt.status === "ACTIVE";
      if (!roleMatches || !statusMatches) return false;

      if (!term) return true;
      return opt.name.toLowerCase().includes(term);
    });
  }, [resolvedOptions, search]);

  // Determine current display label
  const selectedOption = resolvedOptions.find((opt) => opt.id === value);
  const isSelectedCurrentOnly = currentOnly && currentOnly.id === value;

  let displayLabel = "بدون مدير مخزن حاليًا";
  if (selectedOption) {
    const roleBadge = selectedOption.role === "ADMIN" ? "مدير نظام" : "أمين مخزن";
    displayLabel = `${selectedOption.name} (${roleBadge})`;
  } else if (isSelectedCurrentOnly) {
    const reasonText =
      currentOnly.reason === "inactive" ? "مدير حالي معطل" : "مدير حالي غير متاح";
    displayLabel = `${currentOnly.name || "مدير غير محدد"} (${reasonText})`;
  }

  const roleBadgeText = (role: string) => {
    if (role === "ADMIN") return "مدير نظام";
    if (role === "WAREHOUSE_STAFF") return "أمين مخزن";
    return role;
  };

  return (
    <div className="relative w-full text-right" dir="rtl">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          مدير المخزن المسؤول
        </label>
        {isSelectedCurrentOnly && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
            <AlertCircle className="h-3 w-3" />
            {currentOnly.reason === "inactive" ? "المدير الحالي معطل" : "المدير الحالي غير متاح"}
          </span>
        )}
      </div>

      {/* Main trigger button */}
      <div className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled || loading}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="اختيار مدير المخزن"
          className={`flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm outline-none transition-colors ${
            error
              ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
              : "border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-slate-800"
          } ${disabled || loading ? "cursor-not-allowed opacity-60" : "hover:border-slate-300"}`}
        >
          <span
            className={`truncate ${
              value ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {loading ? "جاري تحميل قائمة المديرين..." : displayLabel}
          </span>

          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-teal-600" />}
            {value && !disabled && !loading && (
              <span
                role="button"
                tabIndex={0}
                aria-label="إلغاء اختيار المدير"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onChange("");
                  }
                }}
                className="p-1 hover:text-foreground hover:bg-slate-100 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-popover p-2 text-popover-foreground shadow-lg dark:border-slate-800"
              role="listbox"
              aria-label="قائمة المديرين المؤهلين"
            >
              {/* Search bar inside dropdown */}
              <div className="p-1 mb-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="ابحث بالاسم..."
                  aria-label="البحث عن مدير"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-background px-3 text-xs outline-none focus:border-teal-500 dark:border-slate-800"
                  autoFocus
                />
              </div>

              {/* Error state */}
              {remoteErrorMessage && (
                <div
                  role="alert"
                  className="flex items-center justify-between p-2 text-xs text-red-600 bg-red-50 rounded-lg dark:bg-red-950/40"
                >
                  <span>{remoteErrorMessage}</span>
                  {remoteRetry && (
                    <button
                      type="button"
                      onClick={() => remoteRetry?.()}
                      className="inline-flex items-center gap-1 text-teal-600 hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" />
                      إعادة المحاولة
                    </button>
                  )}
                </div>
              )}

              <div className="max-h-56 overflow-y-auto space-y-1">
                {/* Default: No manager */}
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                    !value
                      ? "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200 font-semibold"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span>بدون مدير مخزن حاليًا</span>
                  {!value && <Check className="h-4 w-4 text-teal-600 shrink-0" />}
                </button>

                {/* If current manager is inactive or unresolvable, present them as retained option */}
                {currentOnly && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === currentOnly.id}
                    onClick={() => {
                      onChange(currentOnly.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                      value === currentOnly.id
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 font-semibold"
                        : "hover:bg-muted text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {currentOnly.name || "مدير غير محدد"}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        {currentOnly.reason === "inactive" ? "معطل حاليًا" : "غير مدرج"}
                      </span>
                    </div>
                    {value === currentOnly.id && (
                      <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                  </button>
                )}

                {/* List of active eligible managers (ADMIN or WAREHOUSE_STAFF only, zero PII) */}
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => {
                    const isSelected = value === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(opt.id);
                          setIsOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                          isSelected
                            ? "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200 font-semibold"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                          <span className="font-medium">{opt.name}</span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {roleBadgeText(opt.role)}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-teal-600 shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="p-3 text-center text-xs text-muted-foreground">
                    لا يوجد مديرون نشطون يطابقون البحث
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">
        يقتصر الاختيار على الموظفين النشطين بصلاحية مدير نظام أو أمين مخزن فقط.
      </p>
    </div>
  );
}
