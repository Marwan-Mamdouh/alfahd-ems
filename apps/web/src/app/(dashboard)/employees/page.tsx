// src/app/(dashboard)/employees/page.tsx
//
// The route stays `/employees` so existing bookmarks survive (R9), but the page
// reads "Users" because `GET /users` returns `UserDto`, which carries no employee
// fields (no name, no department). Employee data arrives with the HR schema in
// M2 #14/#15.
//
// Note: `(dashboard)` is a route GROUP, so it contributes no URL segment. This
// file serves `/employees`, which is what `nav-config.ts` already links to.

"use client";

import { useMemo, useState } from "react";
import type { UserDto } from "@alfahd/types";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import { RoleGuard } from "@/core/auth/guards";
import { roleLabel } from "@/core/auth/role-labels";

import { fetchUsers, USERS_QUERY_KEY } from "@/core/api/users";

export default function EmployeesPage() {
  return (
    <RoleGuard permission="employees.manage">
      <UsersList />
    </RoleGuard>
  );
}

function UsersList() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: fetchUsers,
  });

  const users = useMemo(() => data ?? [], [data]);

  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  /**
   * Client-side filter and sort (R10). `GET /users` returns the full array with
   * no pagination parameters, so neither triggers a request.
   */
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = term
      ? users.filter(
          (u) => u.email.toLowerCase().includes(term) || roleLabel(u.role).includes(search.trim())
        )
      : users;

    return [...filtered].sort((a, b) => {
      const comparison = a.email.localeCompare(b.email);
      return sortAsc ? comparison : -comparison;
    });
  }, [users, search, sortAsc]);

  const columns: ColumnDef<UserDto>[] = [
    {
      key: "email",
      header: "البريد الإلكتروني",
      className: "font-semibold text-slate-800 dark:text-slate-100",
    },
    {
      // Never the raw wire value — `CS` must render as an Arabic label.
      key: "role",
      header: "الدور",
      render: (row) => roleLabel(row.role),
    },
    {
      key: "isActive",
      header: "الحالة",
      render: (row) =>
        row.isActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            نشط
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            غير نشط
          </span>
        ),
    },
    {
      key: "createdAt",
      header: "تاريخ الإنشاء",
      // `createdAt` is not in the JWT, so it comes from `GET /users` — never
      // from the session store.
      render: (row) => formatDate(row.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 px-6 py-7 text-white shadow-sm">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Users className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">المستخدمون</h1>

              <p className="mt-1 text-sm text-teal-50/80">إدارة حسابات المستخدمين والأدوار</p>
            </div>
          </div>

          {/* Count badge reads the fetched array, never a constant. */}
          <div className="w-fit rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
            {users.length} مستخدم
          </div>
        </div>

        {/* Decorative shapes */}
        <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-24 h-48 w-48 rounded-full bg-white/5" />
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-teal-100/80 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-teal-100/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground">قائمة المستخدمين</h2>

            <p className="mt-1 text-xs text-muted-foreground">
              عرض جميع المستخدمين المسجلين في النظام
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالبريد الإلكتروني..."
            aria-label="بحث عن مستخدم"
            className="h-9 w-full rounded-lg border border-teal-100 bg-background px-3 text-sm outline-none focus-visible:border-teal-500 sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2 border-b border-teal-100/70 px-5 py-2">
          <button
            type="button"
            onClick={() => setSortAsc((prev) => !prev)}
            className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            ترتيب حسب البريد الإلكتروني {sortAsc ? "↑" : "↓"}
          </button>
        </div>

        <div className="p-2 sm:p-4">
          <DataTable
            columns={columns}
            data={visible}
            isLoading={isPending}
            error={isError ? new Error("Failed to load users") : null}
            onRetry={() => void refetch()}
            emptyTitle="لا يوجد مستخدمون"
            emptyDescription="لم يتم تسجيل أي مستخدم بعد."
          />

          {isFetching && !isPending && (
            <p className="mt-2 text-center text-xs text-muted-foreground">جارٍ التحديث...</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
