"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-config";
import { NavIcon } from "./nav-icon";
import { useAuthStore } from "@/core/auth/auth.store";
import { hasPermission } from "@/core/permissions/permissions";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);

  return (
    <>
      {/* الشعار */}
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          ف
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">الفهد جروب</p>
          <p className="text-xs text-muted-foreground">نظام الإدارة</p>
        </div>
      </div>

      {/* التنقل */}
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => hasPermission(role, item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">{section.title}</p>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const linkClassName = cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                    item.comingSoon && "pointer-events-none opacity-60"
                  );
                  return (
                    <li key={item.href}>
                      {item.comingSoon ? (
                        <span className={linkClassName} aria-disabled="true" title="قريباً">
                          <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            قريباً
                          </span>
                        </span>
                      ) : (
                        <Link href={item.href} onClick={onNavigate} className={linkClassName}>
                          <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </>
  );
}
