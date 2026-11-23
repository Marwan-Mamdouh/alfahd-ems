import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  ForbiddenState,
  SuccessState,
} from "../index";
import { RoleGuard } from "@/core/auth/guards";
import { Role } from "@alfahd/types";

let currentGuardRole: Role | undefined = Role.ADMIN;

vi.mock("@/core/auth/auth.store", () => ({
  useAuthStore: (selector: (state: { user?: { role: Role } }) => unknown) =>
    selector({ user: currentGuardRole ? { role: currentGuardRole } : undefined }),
}));

describe("Shared UI States & RoleGuard Components (Issue #88 / F7)", () => {
  describe("LoadingState Component", () => {
    it("renders with accessible role='status' and default label", () => {
      const html = renderToStaticMarkup(<LoadingState />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain("جارٍ التحميل...");
    });

    it("renders custom loading label when provided", () => {
      const html = renderToStaticMarkup(<LoadingState label="جاري جلب بيانات المخازن..." />);
      expect(html).toContain("جاري جلب بيانات المخازن...");
    });
  });

  describe("ErrorState Component", () => {
    it("renders with role='alert' and default error message", () => {
      const html = renderToStaticMarkup(<ErrorState />);
      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-live="assertive"');
      expect(html).toContain("حدث خطأ غير متوقع");
    });

    it("renders custom message and retry button when onRetry is provided", () => {
      const html = renderToStaticMarkup(
        <ErrorState message="تعذر الاتصال بالخادم" onRetry={vi.fn()} />
      );
      expect(html).toContain("تعذر الاتصال بالخادم");
      expect(html).toContain("إعادة المحاولة");
    });
  });

  describe("EmptyState Component", () => {
    it("renders title, description, and optional action", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="لا توجد راوترات"
          description="لم يتم العثور على أي راوترات مطابقة للبحث."
          action={<button type="button">إضافة راوتر</button>}
        />
      );
      expect(html).toContain('role="status"');
      expect(html).toContain("لا توجد راوترات");
      expect(html).toContain("لم يتم العثور على أي راوترات مطابقة للبحث.");
      expect(html).toContain("إضافة راوتر");
    });
  });

  describe("ForbiddenState Component", () => {
    it("renders standard accessible forbidden alert with title and message", () => {
      const html = renderToStaticMarkup(<ForbiddenState />);
      expect(html).toContain('role="alert"');
      expect(html).toContain("غير مصرح بالوصول");
      expect(html).toContain("ليس لديك صلاحية لعرض هذه الصفحة. تواصل مع مدير النظام.");
    });

    it("renders custom title, message, and action", () => {
      const html = renderToStaticMarkup(
        <ForbiddenState
          title="صلاحية خاصة مطلوبة"
          message="هذا الإجراء مقتصر على مدراء النظام فقط."
          action={<a href="/dashboard">العودة للرئيسية</a>}
        />
      );
      expect(html).toContain("صلاحية خاصة مطلوبة");
      expect(html).toContain("هذا الإجراء مقتصر على مدراء النظام فقط.");
      expect(html).toContain("العودة للرئيسية");
    });
  });

  describe("SuccessState Component", () => {
    it("renders title and message with accessible status role", () => {
      const html = renderToStaticMarkup(
        <SuccessState title="تم الحفظ بنجاح" message="تم تحديث بيانات الجهاز." />
      );
      expect(html).toContain('role="status"');
      expect(html).toContain("تم الحفظ بنجاح");
      expect(html).toContain("تم تحديث بيانات الجهاز.");
    });
  });

  describe("RoleGuard with Unified ForbiddenState", () => {
    it("renders protected children when role possesses required permission", () => {
      currentGuardRole = Role.ADMIN;
      const html = renderToStaticMarkup(
        <RoleGuard permission="dashboard.view">
          <div data-testid="protected-content">محتوى محمي للوحة التحكم</div>
        </RoleGuard>
      );
      expect(html).toContain("محتوى محمي للوحة التحكم");
      expect(html).not.toContain("غير مصرح بالوصول");
    });

    it("renders ForbiddenState when role lacks required permission", () => {
      currentGuardRole = Role.TECHNICIAN;
      const html = renderToStaticMarkup(
        <RoleGuard permission="dashboard.view">
          <div data-testid="protected-content">محتوى محمي للوحة التحكم</div>
        </RoleGuard>
      );
      expect(html).not.toContain("محتوى محمي للوحة التحكم");
      expect(html).toContain("غير مصرح بالوصول");
      expect(html).toContain("ليس لديك صلاحية لعرض هذه الصفحة. تواصل مع مدير النظام.");
    });

    it("renders ForbiddenState when user role is undefined", () => {
      currentGuardRole = undefined;
      const html = renderToStaticMarkup(
        <RoleGuard permission="employees.manage">
          <div>بيانات الموظفين</div>
        </RoleGuard>
      );
      expect(html).not.toContain("بيانات الموظفين");
      expect(html).toContain("غير مصرح بالوصول");
    });
  });
});
