import { cn } from "@/lib/utils";

type EmployeeStatus = "ACTIVE" | "INACTIVE";

interface EmployeeStatusBadgeProps {
  status: EmployeeStatus;
}

export function EmployeeStatusBadge({ status }: EmployeeStatusBadgeProps) {
  const isActive = status === "ACTIVE";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        isActive
          ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-teal-600" : "bg-red-500")} />
      {isActive ? "نشط" : "غير نشط"}
    </span>
  );
}
