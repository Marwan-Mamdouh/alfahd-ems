// src/components/layout/nav-config.ts
import type { Permission } from "@/core/permissions/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // اسم أيقونة lucide — هنعمل mapping ليها في الـ Sidebar
  permission: Permission;
  comingSoon?: boolean;
}

export interface NavSection {
  title: string; // عنوان القسم (اختياري للعرض)
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "الرئيسية",
    items: [
      {
        label: "لوحة التحكم",
        href: "/dashboard",
        icon: "LayoutDashboard",
        permission: "dashboard.view",
      },
      {
        label: "التتبع المباشر",
        href: "/tracking",
        icon: "MapPin",
        permission: "tracking.view",
        comingSoon: true,
      },
    ],
  },
  {
    title: "العمليات",
    items: [
      {
        label: "التذاكر",
        href: "/tickets",
        icon: "Ticket",
        permission: "tickets.view",
        comingSoon: true,
      },
      {
        label: "العملاء",
        href: "/customers",
        icon: "UserSquare",
        permission: "customers.view",
        comingSoon: true,
      },
      {
        label: "الفنيون",
        href: "/technicians",
        icon: "Wrench",
        permission: "technicians.view",
        comingSoon: true,
      },
      {
        label: "الحضور",
        href: "/attendance",
        icon: "CalendarCheck",
        permission: "attendance.view",
        comingSoon: true,
      },
    ],
  },
  {
    title: "المخازن والأصول",
    items: [
      {
        label: "المخازن",
        href: "/warehouses",
        icon: "Warehouse",
        permission: "warehouses.manage",
        comingSoon: true,
      },
      {
        label: "المخزون",
        href: "/inventory",
        icon: "Package",
        permission: "inventory.manage",
        comingSoon: true,
      },
      {
        label: "الراوترات",
        href: "/routers",
        icon: "Router",
        permission: "routers.manage",
        comingSoon: true,
      },
      {
        label: "عناوين IP",
        href: "/ip-management",
        icon: "Network",
        permission: "ips.view",
        comingSoon: true,
      },
    ],
  },
  {
    title: "الإدارة",
    items: [
      { label: "الموظفون", href: "/employees", icon: "Users", permission: "employees.manage" },
      {
        label: "التقارير",
        href: "/reports",
        icon: "BarChart3",
        permission: "reports.view",
        comingSoon: true,
      },
      {
        label: "الإعدادات",
        href: "/settings",
        icon: "Settings",
        permission: "settings.manage",
        comingSoon: true,
      },
    ],
  },
];
