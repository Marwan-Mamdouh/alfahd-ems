// src/core/auth/guards.tsx
"use client";

import { ShieldX } from "lucide-react";
import { useAuthStore } from "@/core/auth/auth.store";
import { hasPermission, type Permission } from "@/core/permissions/permissions";

interface RoleGuardProps {
  permission: Permission;
  children: React.ReactNode;
}

export function RoleGuard({ permission, children }: RoleGuardProps) {
  const role = useAuthStore((s) => s.user?.role);
  const isAllowed = hasPermission(role, permission);

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <ShieldX className="h-10 w-10 text-destructive/70" />
        <h2 className="text-lg font-bold">غير مصرح بالوصول</h2>
        <p className="text-sm text-muted-foreground">
          ليس لديك صلاحية لعرض هذه الصفحة. تواصل مع مدير النظام.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
