// src/components/layout/nav-config.ts
import type { Permission } from "@/core/permissions/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // اسم أيقونة lucide — هنعمل mapping ليها في الـ Sidebar
  permission: Permission;
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
      { label: "التتبع المباشر", href: "/tracking", icon: "MapPin", permission: "tracking.view" },
    ],
  },
  {
    title: "العمليات",
    items: [
      { label: "التذاكر", href: "/tickets", icon: "Ticket", permission: "tickets.view" },
      { label: "العملاء", href: "/customers", icon: "UserSquare", permission: "customers.view" },
      { label: "الفنيون", href: "/technicians", icon: "Wrench", permission: "technicians.view" },
      {
        label: "الحضور",
        href: "/attendance",
        icon: "CalendarCheck",
        permission: "attendance.view",
      },
    ],
  },
  {
    title: "المخازن والأصول",
    items: [
      { label: "المخازن", href: "/warehouses", icon: "Warehouse", permission: "warehouses.manage" },
      { label: "المخزون", href: "/inventory", icon: "Package", permission: "inventory.manage" },
      { label: "الراوترات", href: "/routers", icon: "Router", permission: "routers.manage" },
      { label: "عناوين IP", href: "/ip-management", icon: "Network", permission: "ips.view" },
    ],
  },
  {
    title: "الإدارة",
    items: [
      { label: "الموظفون", href: "/employees", icon: "Users", permission: "employees.manage" },
      { label: "التقارير", href: "/reports", icon: "BarChart3", permission: "reports.view" },
      { label: "الإعدادات", href: "/settings", icon: "Settings", permission: "settings.manage" },
    ],
  },
];
