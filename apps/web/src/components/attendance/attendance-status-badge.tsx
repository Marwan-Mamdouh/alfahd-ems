import { AttendanceStatus } from "@alfahd/types";
import { cn } from "@/lib/utils";

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
}

const STATUS_CONFIG = {
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
  ABSENT: {
    label: "غائب",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
    dotClassName: "bg-red-500",
  },
} as const;

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap",
        config.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />

      {config.label}
    </span>
  );
}
