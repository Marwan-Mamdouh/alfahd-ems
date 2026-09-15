// src/components/layout/nav-icon.tsx
import {
  LayoutDashboard,
  MapPin,
  Ticket,
  UserSquare,
  Wrench,
  CalendarCheck,
  Warehouse,
  Package,
  Router,
  Network,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MapPin,
  Ticket,
  UserSquare,
  Wrench,
  CalendarCheck,
  Warehouse,
  Package,
  Router,
  Network,
  Users,
  BarChart3,
  Settings,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} />;
}
