import { cn } from "@/lib/utils";
import type { UserStatus } from "@alfahd/types";

export type { UserStatus };

interface EmployeeStatusBadgeProps {
  status: UserStatus;
  className?: string;
}

export function getEmployeeStatusLabel(status: UserStatus): string {
  switch (status) {
    case "ACTIVE":
      return "نشط";
    case "ON_LEAVE":
      return "في إجازة";
    case "INACTIVE":
      return "غير نشط";
    default:
      return status;
  }
}

export const EMPLOYEE_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "نشط" },
  { value: "ON_LEAVE", label: "في إجازة" },
  { value: "INACTIVE", label: "غير نشط" },
];

export function EmployeeStatusBadge({ status, className }: EmployeeStatusBadgeProps) {
  const label = getEmployeeStatusLabel(status);

  const styleConfig = {
    ACTIVE: {
      badge:
        "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300",
      dot: "bg-teal-600",
    },
    ON_LEAVE: {
      badge:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
      dot: "bg-amber-600",
    },
    INACTIVE: {
      badge:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
      dot: "bg-red-500",
    },
  }[status] ?? {
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    dot: "bg-slate-500",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        styleConfig.badge,
        className
      )}
      data-status={status}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styleConfig.dot)} aria-hidden="true" />
      {label}
    </span>
  );
}
