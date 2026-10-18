"use client";

import { useMemo, useState } from "react";
import { Users, Plus, ArrowRight, FlaskConical } from "lucide-react";

import { RoleGuard } from "@/core/auth/guards";

import { EmployeeTable, type EmployeeRow } from "@/components/employees/employee-table";

import {
  EmployeeFilters,
  type EmployeeFiltersValue,
} from "@/components/employees/employee-filters";

import { EmployeeForm, type EmployeeFormValues } from "@/components/employees/employee-form";

// Demo data only. No backend requests or persistence.
const INITIAL_EMPLOYEES: EmployeeRow[] = [
  {
    id: "demo-1",
    name: "أحمد محمد",
    email: "ahmed@example.com",
    phone: "01000000001",
    department: "TECHNICAL",
    role: "TECHNICIAN",
    warehouseName: "المخزن الرئيسي",
    status: "ACTIVE",
  },
  {
    id: "demo-2",
    name: "محمد علي",
    email: "mohamed@example.com",
    phone: "01000000002",
    department: "WAREHOUSE",
    role: "WAREHOUSE_STAFF",
    warehouseName: "مخزن القاهرة",
    status: "ACTIVE",
  },
  {
    id: "demo-3",
    name: "سارة أحمد",
    email: "sara@example.com",
    phone: "01000000003",
    department: "CUSTOMER_SERVICE",
    role: "CS",
    warehouseName: null,
    status: "INACTIVE",
  },
  {
    id: "demo-4",
    name: "محمود خالد",
    email: "mahmoud@example.com",
    phone: "01000000004",
    department: "MANAGEMENT",
    role: "ADMIN",
    warehouseName: null,
    status: "ACTIVE",
  },
];

const EMPTY_FILTERS: EmployeeFiltersValue = {
  search: "",
  department: "",
  role: "",
  status: "",
};

type ViewMode = "list" | "create" | "edit";

function EmployeeManagementPreview() {
  const [employees, setEmployees] = useState<EmployeeRow[]>(INITIAL_EMPLOYEES);

  const [filters, setFilters] = useState<EmployeeFiltersValue>({ ...EMPTY_FILTERS });

  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);

  const [notification, setNotification] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !search ||
        employee.name.toLowerCase().includes(search) ||
        employee.email.toLowerCase().includes(search);

      const matchesDepartment = !filters.department || employee.department === filters.department;

      const matchesRole = !filters.role || employee.role === filters.role;

      const matchesStatus = !filters.status || employee.status === filters.status;

      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    });
  }, [employees, filters]);

  function openCreate() {
    setSelectedEmployee(null);
    setNotification(null);
    setViewMode("create");
  }

  function openEdit(employee: EmployeeRow) {
    setSelectedEmployee(employee);
    setNotification(null);
    setViewMode("edit");
  }

  function backToList() {
    setSelectedEmployee(null);
    setViewMode("list");
  }

  async function handleEmployeeSubmit(values: EmployeeFormValues) {
    const duplicateEmail = employees.some(
      (employee) =>
        employee.email.toLowerCase() === values.email.toLowerCase() &&
        employee.id !== selectedEmployee?.id
    );

    if (duplicateEmail) {
      throw new Error("البريد الإلكتروني مستخدم بالفعل في بيانات المعاينة.");
    }

    const employeeData = {
      name: values.name,
      email: values.email,
      phone: values.phone || null,
      department: values.department,
      role: values.role,
      warehouseName: values.warehouseName || null,
      status: values.status,
    };

    if (viewMode === "edit" && selectedEmployee) {
      setEmployees((previous) =>
        previous.map((employee) =>
          employee.id === selectedEmployee.id ? { ...employee, ...employeeData } : employee
        )
      );

      setNotification("تم تعديل بيانات الموظف داخل المعاينة فقط.");
    } else if (viewMode === "create") {
      const newEmployee: EmployeeRow = {
        id: crypto.randomUUID(),
        ...employeeData,
      };

      setEmployees((previous) => [newEmployee, ...previous]);

      setNotification("تمت إضافة الموظف إلى بيانات المعاينة فقط.");
    } else {
      throw new Error("عملية غير صالحة.");
    }

    backToList();
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Preview warning */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />

        <div>
          <p className="font-semibold">وضع المعاينة — بيانات تجريبية</p>

          <p className="mt-1 text-sm">
            يمكنك تجربة إضافة وتعديل الموظفين. التغييرات محلية ومؤقتة، ولن تُحفظ في قاعدة البيانات،
            وستختفي عند تحديث الصفحة.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <Users className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">إدارة الموظفين</h1>

              <p className="mt-1 text-sm text-white/80">Employee Management — Phase 2</p>
            </div>
          </div>

          <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            {employees.length} موظفين تجريبيين
          </div>
        </div>
      </div>

      {notification && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
        >
          {notification}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">قائمة الموظفين</h2>

              <p className="mt-1 text-sm text-muted-foreground">
                ابحث أو اختر موظفًا من الجدول لتعديل بياناته.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              إضافة موظف
            </button>
          </div>

          <EmployeeFilters value={filters} onChange={setFilters} />

          <p className="text-sm text-muted-foreground">عدد النتائج: {filteredEmployees.length}</p>

          <EmployeeTable employees={filteredEmployees} onEmployeeClick={openEdit} />
        </section>
      )}

      {/* Create and Edit View */}
      {(viewMode === "create" || viewMode === "edit") && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة لقائمة الموظفين
          </button>

          <EmployeeForm
            key={viewMode === "edit" ? selectedEmployee?.id : "new-employee"}
            employee={viewMode === "edit" ? selectedEmployee : null}
            onSubmit={handleEmployeeSubmit}
            onCancel={backToList}
          />
        </section>
      )}
    </div>
  );
}

export default function EmployeesPreviewPage() {
  return (
    <RoleGuard permission="employees.manage">
      <EmployeeManagementPreview />
    </RoleGuard>
  );
}
