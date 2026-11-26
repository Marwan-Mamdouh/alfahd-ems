// src/core/auth/guards.tsx
"use client";

import { useAuthStore } from "@/core/auth/auth.store";
import { hasPermission, type Permission } from "@/core/permissions/permissions";
import { ForbiddenState } from "@/components/shared/states";

interface RoleGuardProps {
  permission: Permission;
  children: React.ReactNode;
}

export function RoleGuard({ permission, children }: RoleGuardProps) {
  const role = useAuthStore((s) => s.user?.role);
  const isAllowed = hasPermission(role, permission);

  if (!isAllowed) {
    return (
      <ForbiddenState
        title="غير مصرح بالوصول"
        message="ليس لديك صلاحية لعرض هذه الصفحة. تواصل مع مدير النظام."
      />
    );
  }

  return <>{children}</>;
}
