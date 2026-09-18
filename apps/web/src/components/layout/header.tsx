"use client";

import { useAuthStore } from "@/core/auth/auth.store";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { LOGIN_PATH } from "@/core/auth/routes";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير النظام",
  WAREHOUSE_STAFF: "موظف مخزن",
  CUSTOMER_SERVICE: "خدمة العملاء",
  TECHNICIAN: "فني",
};

export function Header() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.push(LOGIN_PATH);
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background pe-14 ps-6 lg:pe-6">
      <div>{/* مكان الـ page title أو breadcrumbs لاحقاً */}</div>

      <div className="flex items-center gap-4">
        <div className="text-left">
          <p className="text-sm font-medium leading-tight">{user?.name ?? "—"}</p>

          <p className="text-xs text-muted-foreground">{user ? ROLE_LABELS[user.role] : ""}</p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {user?.name?.charAt(0) ?? "؟"}
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} title="تسجيل الخروج">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
