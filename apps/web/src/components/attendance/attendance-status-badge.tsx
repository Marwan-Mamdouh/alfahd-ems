import { AttendanceStatus } from "@alfahd/types";
import { cn } from "@/lib/utils";

export interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
  className?: string;
}

export const ATTENDANCE_STATUS_CONFIG = {
  ON_TIME: {
    label: "في الموعد",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300",
    dotClassName: "bg-teal-600",
  },
  LATE: {
    label: "متأخر",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
    dotClassName: "bg-amber-500",
  },
} as const;

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  return ATTENDANCE_STATUS_CONFIG[status]?.label ?? status;
}

export function AttendanceStatusBadge({ status, className }: AttendanceStatusBadgeProps) {
  const config = ATTENDANCE_STATUS_CONFIG[status] ?? {
    label: status,
    className: "border-slate-200 bg-slate-50 text-slate-700",
    dotClassName: "bg-slate-500",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap",
        config.className,
        className
      )}
      data-testid={`attendance-status-${status}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />
      {config.label}
    </span>
  );
}
