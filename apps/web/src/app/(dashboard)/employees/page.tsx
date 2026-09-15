// // src/app/(dashboard)/employees/page.tsx
// "use client";

// import { PageHeader } from "@/components/shared/page-header/page-header";
// import { DataTable } from "@/components/shared/data-table/data-table";
// import type { ColumnDef } from "@/components/shared/data-table/types";
// import { Button } from "@/components/ui/button";
// import { Plus } from "lucide-react";
// import { RoleGuard } from "@/core/auth/guards";

// interface Employee {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
//   status: "ACTIVE" | "INACTIVE";
// }

// const MOCK_EMPLOYEES: Employee[] = [
//   {
//     id: "1",
//     name: "أحمد محمد",
//     email: "ahmed@fahdgroup.com",
//     role: "مدير النظام",
//     status: "ACTIVE",
//   },
//   {
//     id: "2",
//     name: "سارة علي",
//     email: "sara@fahdgroup.com",
//     role: "خدمة العملاء",
//     status: "ACTIVE",
//   },
//   { id: "3", name: "محمد حسن", email: "mhassan@fahdgroup.com", role: "فني", status: "ACTIVE" },
//   {
//     id: "4",
//     name: "خالد إبراهيم",
//     email: "khaled@fahdgroup.com",
//     role: "موظف مخزن",
//     status: "INACTIVE",
//   },
// ];

// const columns: ColumnDef<Employee>[] = [
//   { key: "name", header: "الاسم", className: "font-medium" },
//   { key: "email", header: "البريد الإلكتروني", hideOnMobile: true },
//   { key: "role", header: "الدور" },
//   {
//     key: "status",
//     header: "الحالة",
//     render: (row) =>
//       row.status === "ACTIVE" ? (
//         <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
//           نشط
//         </span>
//       ) : (
//         <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
//           غير نشط
//         </span>
//       ),
//   },
// ];

// export default function EmployeesPage() {
//   return (
//     <RoleGuard permission="employees.manage">
//       <div className="space-y-6">
//         <PageHeader
//           title="الموظفون"
//           description="إدارة حسابات الموظفين والأدوار"
//           action={
//             <Button>
//               <Plus className="ml-2 h-4 w-4" />
//               إضافة موظف
//             </Button>
//           }
//         />
//         <DataTable columns={columns} data={MOCK_EMPLOYEES} />
//       </div>
//     </RoleGuard>
//   );
// }
// src/app/(dashboard)/employees/page.tsx

"use client";

import { PageHeader } from "@/components/shared/page-header/page-header";
import { DataTable } from "@/components/shared/data-table/data-table";
import type { ColumnDef } from "@/components/shared/data-table/types";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
}

const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "أحمد محمد",
    email: "ahmed@fahdgroup.com",
    role: "مدير النظام",
    status: "ACTIVE",
  },
  {
    id: "2",
    name: "سارة علي",
    email: "sara@fahdgroup.com",
    role: "خدمة العملاء",
    status: "ACTIVE",
  },
  {
    id: "3",
    name: "محمد حسن",
    email: "mhassan@fahdgroup.com",
    role: "فني",
    status: "ACTIVE",
  },
  {
    id: "4",
    name: "خالد إبراهيم",
    email: "khaled@fahdgroup.com",
    role: "موظف مخزن",
    status: "INACTIVE",
  },
];

const columns: ColumnDef<Employee>[] = [
  {
    key: "name",
    header: "الاسم",
    className: "font-semibold text-slate-800 dark:text-slate-100",
  },
  {
    key: "email",
    header: "البريد الإلكتروني",
    hideOnMobile: true,
  },
  {
    key: "role",
    header: "الدور",
  },
  {
    key: "status",
    header: "الحالة",
    render: (row) =>
      row.status === "ACTIVE" ? (
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
];

export default function EmployeesPage() {
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
              <h1 className="text-2xl font-bold">
                الموظفون
              </h1>

              <p className="mt-1 text-sm text-teal-50/80">
                إدارة حسابات الموظفين والأدوار
              </p>
            </div>
          </div>

          <Button
            className="bg-white text-teal-700 shadow-sm hover:bg-teal-50"
          >
            <Plus className="ml-2 h-4 w-4" />
            إضافة موظف
          </Button>
        </div>

        {/* Decorative shapes */}
        <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 left-24 h-48 w-48 rounded-full bg-white/5" />
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-teal-100/80 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-teal-100/70 px-5 py-4">
          <div>
            <h2 className="font-semibold text-foreground">
              قائمة الموظفين
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              عرض وإدارة جميع الموظفين المسجلين في النظام
            </p>
          </div>

          <div className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
            {MOCK_EMPLOYEES.length} موظفين
          </div>
        </div>

        <div className="p-2 sm:p-4">
          <DataTable
            columns={columns}
            data={MOCK_EMPLOYEES}
          />
        </div>
      </div>
    </div>
  );
}