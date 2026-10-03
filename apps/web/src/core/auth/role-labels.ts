import type { Role } from "@alfahd/types";

/**
 * Display labels for the wire role values.
 *
 * The raw wire value must never be rendered: the backend emits `CS`, and showing
 * `CS` in the UI leaks an enum name into an Arabic interface. Keys are typed as
 * `Role`, so a new role added to `@alfahd/types` fails typecheck here rather
 * than silently rendering `undefined`.
 */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدير النظام",
  WAREHOUSE_STAFF: "موظف مخزن",
  CS: "خدمة العملاء",
  TECHNICIAN: "فني",
};

/** Arabic display label for a role. Falls back to `—` for an unknown value. */
export function roleLabel(role: Role | undefined | null): string {
  if (!role) return "—";

  return ROLE_LABELS[role] ?? "—";
}
