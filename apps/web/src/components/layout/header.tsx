"use client";

import { useAuthStore } from "@/core/auth/auth.store";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { roleLabel } from "@/core/auth/role-labels";
import { logout } from "@/core/api/axios-instance";

export function Header() {
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    // Must call the server: the refresh cookie is httpOnly and cannot be deleted
    // from JavaScript. `POST /auth/logout` revokes the Redis session and clears
    // the cookie via Set-Cookie — otherwise the session silently survives.
    //
    // No `router.push` here: `logout()` broadcasts a session-invalidated event,
    // and `SessionExpiryRedirect` already navigates on it. Pushing as well would
    // race a `replace` on the same route.
    try {
      await logout();
    } catch {
      // logout() already cleared local state and broadcast in its `finally`;
      // a failed network call must not surface as an unhandled rejection.
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background pe-14 ps-6 lg:pe-6">
      <div>{/* مكان الـ page title أو breadcrumbs لاحقاً */}</div>

      <div className="flex items-center gap-4">
        {/* `UserDto` has no `name` field — the email is the only identity the
            backend sends. Reading `user?.name` here rendered a blank line. */}
        <div className="text-left">
          <p className="text-sm font-medium leading-tight" dir="ltr">
            {user?.email ?? "—"}
          </p>

          <p className="text-xs text-muted-foreground">{user ? roleLabel(user.role) : ""}</p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {user?.email?.charAt(0)?.toUpperCase() ?? "؟"}
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} title="تسجيل الخروج">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
