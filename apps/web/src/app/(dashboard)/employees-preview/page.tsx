"use client";

import { useMemo, useState } from "react";
import { Users, Plus, ArrowRight, FlaskConical } from "lucide-react";
import type { UserStatus } from "@alfahd/types";

import { RoleGuard } from "@/core/auth/guards";
import {
  EmployeeTable,
  EmployeeFilters,
  EmployeeCreateForm,
  EmployeeEditForm,
  EmployeeStatusDialog,
  EmployeePhotoDialog,
  EmployeeDetail,
  type EmployeeRow,
  type EmployeeFiltersValue,
  type CreateEmployeeValues,
  type UpdateEmployeeValues,
} from "@/components/employees";

// Demo data for preview mode only. No backend persistence or sensitive PII.
const DEMO_WAREHOUSES = [
  { id: "wh-main-01", name: "المخزن الرئيسي (القاهرة)" },
  { id: "wh-alex-02", name: "مخزن الإسكندرية الإقليمي" },
  { id: "wh-giza-03", name: "مخزن الجيزة" },
];

const INITIAL_EMPLOYEES: EmployeeRow[] = [
  {
    id: "demo-emp-1",
    name: "أحمد مصطفى التجريبي",
    email: "ahmed.demo@company.local",
    phone: "01012345678",
    nationalId: "29501011234567",
    hireDate: "2024-01-15",
    department: "TECHNICAL",
    role: "TECHNICIAN",
    warehouseId: "wh-main-01",
    warehouseName: "المخزن الرئيسي (القاهرة)",
    status: "ACTIVE",
    profilePhotoUrl: null,
    statusChanges: [],
    createdAt: "2024-01-15T08:00:00Z",
  },
  {
    id: "demo-emp-2",
    name: "محمود حسن التجريبي",
    email: "mahmoud.demo@company.local",
    phone: "01123456789",
    nationalId: "29305021234568",
    hireDate: "2024-03-01",
    department: "WAREHOUSE",
    role: "WAREHOUSE_STAFF",
    warehouseId: "wh-alex-02",
    warehouseName: "مخزن الإسكندرية الإقليمي",
    status: "ACTIVE",
    profilePhotoUrl: null,
    statusChanges: [],
    createdAt: "2024-03-01T09:00:00Z",
  },
  {
    id: "demo-emp-3",
    name: "سارة خليل التجريبية",
    email: "sara.demo@company.local",
    phone: "01234567890",
    nationalId: "29807151234569",
    hireDate: "2024-06-10",
    department: "CUSTOMER_SERVICE",
    role: "CS",
    warehouseId: null,
    warehouseName: null,
    status: "ON_LEAVE",
    profilePhotoUrl: null,
    statusChanges: [
      {
        from: "ACTIVE",
        to: "ON_LEAVE",
        reason: "إجازة وضع رسمية لمدة شهرين",
        changedAt: "2024-10-01T10:00:00Z",
      },
    ],
    createdAt: "2024-06-10T10:00:00Z",
  },
  {
    id: "demo-emp-4",
    name: "كريم عبد الله التجريبي",
    email: "karim.demo@company.local",
    phone: "01545678901",
    nationalId: "29109201234570",
    hireDate: "2023-11-01",
    department: "MANAGEMENT",
    role: "ADMIN",
    warehouseId: null,
    warehouseName: null,
    status: "INACTIVE",
    profilePhotoUrl: null,
    statusChanges: [
      {
        from: "ACTIVE",
        to: "INACTIVE",
        reason: "استقالة رسمية وإنهاء التعاقد وإلغاء الجلسات",
        changedAt: "2024-09-15T14:30:00Z",
      },
    ],
    createdAt: "2023-11-01T08:30:00Z",
  },
];

const EMPTY_FILTERS: EmployeeFiltersValue = {
  search: "",
  department: "",
  role: "",
  status: "",
  warehouseId: "",
};

type ViewMode = "list" | "detail" | "create" | "edit";

function EmployeeManagementPreview() {
  const [employees, setEmployees] = useState<EmployeeRow[]>(INITIAL_EMPLOYEES);
  const [filters, setFilters] = useState<EmployeeFiltersValue>({ ...EMPTY_FILTERS });
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);
  const [notification, setNotification] = useState<{ message: string; type?: "success" | "error" } | null>(null);

  // Dialog states
  const [statusDialogEmployee, setStatusDialogEmployee] = useState<EmployeeRow | null>(null);
  const [photoDialogEmployee, setPhotoDialogEmployee] = useState<EmployeeRow | null>(null);

  // Pagination state (demonstrating server-controlled pagination props)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredEmployees = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !search ||
        employee.name.toLowerCase().includes(search) ||
        employee.email.toLowerCase().includes(search) ||
        (employee.nationalId && employee.nationalId.includes(search));

      const matchesDept = !filters.department || employee.department === filters.department;
      const matchesRole = !filters.role || employee.role === filters.role;
      const matchesStatus = !filters.status || employee.status === filters.status;
      const matchesWarehouse = !filters.warehouseId || employee.warehouseId === filters.warehouseId;

      return matchesSearch && matchesDept && matchesRole && matchesStatus && matchesWarehouse;
    });
  }, [employees, filters]);

  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, page, pageSize]);

  function openCreate() {
    setSelectedEmployee(null);
    setNotification(null);
    setViewMode("create");
  }

  function openDetail(employee: EmployeeRow) {
    setSelectedEmployee(employee);
    setNotification(null);
    setViewMode("detail");
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

  // Handle Create Employee
  async function handleCreateSubmit(values: CreateEmployeeValues) {
    const duplicateEmail = employees.some(
      (emp) => emp.email.toLowerCase() === values.email.toLowerCase()
    );
    if (duplicateEmail) {
      throw new Error("البريد الإلكتروني مستخدم بالفعل لموظف آخر.");
    }

    const warehouse = DEMO_WAREHOUSES.find((w) => w.id === values.warehouseId);
    const newId = `demo-emp-${Date.now()}`;

    let photoUrl: string | null = null;
    if (values.photoFile) {
      photoUrl = URL.createObjectURL(values.photoFile);
    }

    const newEmployee: EmployeeRow = {
      id: newId,
      name: values.name,
      email: values.email,
      role: values.role,
      department: values.department || null,
      phone: values.phone || null,
      nationalId: values.nationalId || null,
      hireDate: values.hireDate || null,
      warehouseId: warehouse?.id ?? null,
      warehouseName: warehouse?.name ?? null,
      status: "ACTIVE",
      profilePhotoUrl: photoUrl,
      createdAt: new Date().toISOString(),
      statusChanges: [],
    };

    setEmployees((prev) => [newEmployee, ...prev]);
    setNotification({
      message: `تم إضافة الموظف الجديد «${values.name}» بنجاح (معاينة محلية).`,
      type: "success",
    });

    backToList();
    return { id: newId };
  }

  // Handle Edit Employee
  async function handleEditSubmit(values: UpdateEmployeeValues) {
    if (!selectedEmployee) return;

    const warehouse = DEMO_WAREHOUSES.find((w) => w.id === values.warehouseId);

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === selectedEmployee.id
          ? {
              ...emp,
              name: values.name,
              department: values.department || null,
              phone: values.phone || null,
              warehouseId: warehouse?.id ?? null,
              warehouseName: warehouse?.name ?? null,
              updatedAt: new Date().toISOString(),
            }
          : emp
      )
    );

    setNotification({
      message: `تم تحديث بيانات الموظف «${values.name}» بنجاح (معاينة محلية).`,
      type: "success",
    });

    backToList();
  }

  // Handle Status Change
  async function handleStatusSubmit(newStatus: UserStatus, reason: string) {
    if (!statusDialogEmployee) return;

    const changeEntry = {
      from: statusDialogEmployee.status,
      to: newStatus,
      reason,
      changedAt: new Date().toISOString(),
    };

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === statusDialogEmployee.id
          ? {
              ...emp,
              status: newStatus,
              statusChanges: [changeEntry, ...(emp.statusChanges || [])],
            }
          : emp
      )
    );

    if (selectedEmployee && selectedEmployee.id === statusDialogEmployee.id) {
      setSelectedEmployee((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              statusChanges: [changeEntry, ...(prev.statusChanges || [])],
            }
          : null
      );
    }

    setNotification({
      message: `تم تغيير حالة «${statusDialogEmployee.name}» إلى «${newStatus}» مع توثيق سبب التدقيق.`,
      type: "success",
    });

    setStatusDialogEmployee(null);
  }

  // Handle Photo Upload
  async function handlePhotoUpload(file: File) {
    if (!photoDialogEmployee) return;

    const photoUrl = URL.createObjectURL(file);

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === photoDialogEmployee.id
          ? { ...emp, profilePhotoUrl: photoUrl }
          : emp
      )
    );

    if (selectedEmployee && selectedEmployee.id === photoDialogEmployee.id) {
      setSelectedEmployee((prev) => (prev ? { ...prev, profilePhotoUrl: photoUrl } : null));
    }

    setNotification({
      message: `تم تحديث الصورة الشخصية للموظف «${photoDialogEmployee.name}».`,
      type: "success",
    });

    setPhotoDialogEmployee(null);
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Preview Warning Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">وضع المعاينة والتدقيق — Issue #82 UI Components</p>
          <p className="mt-1 text-sm">
            شاشة تجريبية تفاعلية لعرض مكونات إدارة الموظفين (F1 — Employee Management UI): القائمة،
            التفاصيل، الإضافة مع التحقق من الهوية والصورة، التعديل المقيد، وتغيير الحالة مع سبب التدقيق الأمني.
          </p>
        </div>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-700 via-teal-600 to-teal-500 p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إدارة الموظفين (Employee Management)</h1>
              <p className="mt-1 text-sm text-white/80">المرحلة الثانية — Phase 2 F1</p>
            </div>
          </div>

          <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
            {employees.length} موظفاً
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300"
        >
          {notification.message}
        </div>
      )}

      {/* View: List */}
      {viewMode === "list" && (
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">قائمة الموظفين</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ابحث في الموظفين، أو استخدم الفلاتر للفرز، أو اضغط على أي موظف لعرض بياناته.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              إضافة موظف جديد
            </button>
          </div>

          <EmployeeFilters
            value={filters}
            onChange={(newFilters) => {
              setFilters(newFilters);
              setPage(1);
            }}
            warehouses={DEMO_WAREHOUSES}
          />

          <EmployeeTable
            employees={paginatedEmployees}
            onEmployeeClick={openDetail}
            onViewDetails={openDetail}
            onEdit={openEdit}
            onChangeStatus={(emp) => setStatusDialogEmployee(emp)}
            onUploadPhoto={(emp) => setPhotoDialogEmployee(emp)}
            pagination={{
              page,
              pageSize,
              total: filteredEmployees.length,
              onPageChange: (newPage) => setPage(newPage),
            }}
          />
        </section>
      )}

      {/* View: Detail */}
      {viewMode === "detail" && selectedEmployee && (
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <EmployeeDetail
            employee={selectedEmployee}
            onBack={backToList}
            onEdit={openEdit}
            onChangeStatus={(emp) => setStatusDialogEmployee(emp)}
            onUploadPhoto={(emp) => setPhotoDialogEmployee(emp)}
          />
        </section>
      )}

      {/* View: Create */}
      {viewMode === "create" && (
        <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة لقائمة الموظفين
          </button>

          <EmployeeCreateForm
            warehouses={DEMO_WAREHOUSES}
            onSubmit={handleCreateSubmit}
            onCancel={backToList}
          />
        </section>
      )}

      {/* View: Edit */}
      {viewMode === "edit" && selectedEmployee && (
        <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            <ArrowRight className="h-4 w-4" />
            العودة لقائمة الموظفين
          </button>

          <EmployeeEditForm
            employee={selectedEmployee}
            warehouses={DEMO_WAREHOUSES}
            onSubmit={handleEditSubmit}
            onCancel={backToList}
          />
        </section>
      )}

      {/* Status Change Dialog Modal */}
      <EmployeeStatusDialog
        employee={statusDialogEmployee}
        isOpen={Boolean(statusDialogEmployee)}
        onClose={() => setStatusDialogEmployee(null)}
        onSubmit={handleStatusSubmit}
      />

      {/* Photo Upload Dialog Modal */}
      <EmployeePhotoDialog
        employee={photoDialogEmployee}
        isOpen={Boolean(photoDialogEmployee)}
        onClose={() => setPhotoDialogEmployee(null)}
        onUpload={handlePhotoUpload}
      />
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
