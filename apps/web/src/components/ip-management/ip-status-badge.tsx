import { cn } from "@/lib/utils";
import type { IpStatus } from "./types";

interface IpStatusBadgeProps {
  status: IpStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  IpStatus,
  { label: string; className: string; dotClassName: string }
> = {
  FREE: {
    label: "متاح",
    className:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300",
    dotClassName: "bg-teal-600 dark:bg-teal-400",
  },
  RESERVED: {
    label: "محجوز",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
    dotClassName: "bg-blue-600 dark:bg-blue-400",
  },
} as const;

/**
 * Presentational badge for IPv4 lifecycle status (FREE or RESERVED).
 * Strictly mirrors the backend enum without invented statuses.
 */
export function IpStatusBadge({ status, className }: IpStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        config.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />
      {config.label}
    </span>
  );
}

interface IpArchivedBadgeProps {
  isArchived: boolean;
  className?: string;
}

/**
 * Presentational badge representing whether an IP address is archived.
 * Rendered separately from the operational status to reflect domain orthogonality.
 */
export function IpArchivedBadge({ isArchived, className }: IpArchivedBadgeProps) {
  if (!isArchived) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        نشط
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
      مؤرشف
    </span>
  );
}
