import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IpForm, validateIpv4Host } from "../ip-form";

describe("IpForm & IPv4 Validator (Task B6 / F6)", () => {
  describe("validateIpv4Host", () => {
    it("accepts valid individual IPv4 hosts", () => {
      expect(validateIpv4Host("192.168.1.1")).toBeNull();
      expect(validateIpv4Host("10.0.0.1")).toBeNull();
      expect(validateIpv4Host("172.16.254.1")).toBeNull();
      expect(validateIpv4Host("255.255.255.255")).toBeNull();
      expect(validateIpv4Host("0.0.0.0")).toBeNull();
    });

    it("rejects empty or whitespace-only inputs", () => {
      expect(validateIpv4Host("")).toBe("عنوان IP مطلوب");
      expect(validateIpv4Host("   ")).toBe("عنوان IP مطلوب");
    });

    it("rejects CIDR prefix notation", () => {
      expect(validateIpv4Host("192.168.1.0/24")).toContain("لا يُسمح بنطاقات CIDR");
      expect(validateIpv4Host("10.0.0.1/32")).toContain("لا يُسمح بنطاقات CIDR");
    });

    it("rejects IPv6 addresses", () => {
      expect(validateIpv4Host("2001:db8::1")).toContain("لا يُسمح بعناوين IPv6");
      expect(validateIpv4Host("::1")).toContain("لا يُسمح بعناوين IPv6");
    });

    it("rejects out-of-range octets and malformed strings", () => {
      expect(validateIpv4Host("192.168.1.256")).toContain("يجب إدخال عنوان IPv4 صالح");
      expect(validateIpv4Host("999.999.999.999")).toContain("يجب إدخال عنوان IPv4 صالح");
      expect(validateIpv4Host("192.168.1")).toContain("يجب إدخال عنوان IPv4 صالح");
      expect(validateIpv4Host("192.168.1.1.1")).toContain("يجب إدخال عنوان IPv4 صالح");
      expect(validateIpv4Host("abc.def.ghi.jkl")).toContain("يجب إدخال عنوان IPv4 صالح");
    });
  });

  describe("IpForm Component Rendering", () => {
    it("returns null when isOpen is false", () => {
      const html = renderToStaticMarkup(
        <IpForm
          isOpen={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          mode="create"
        />
      );
      expect(html).toBe("");
    });

    it("renders create dialog with input fields, UI primitives, and IPv4-only validation hint", () => {
      const html = renderToStaticMarkup(
        <IpForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          mode="create"
        />
      );

      expect(html).toContain("تسجيل عنوان IP جديد");
      expect(html).toContain("عنوان IPv4");
      expect(html).toContain("يقبل عناوين IPv4 الفردية فقط");
      expect(html).toContain("الملاحظات (اختياري)");
      expect(html).toContain("تسجيل العنوان");
      expect(html).toContain('data-slot="input"');
      expect(html).toContain('data-slot="label"');
      expect(html).toContain('data-slot="button"');
    });

    it("renders editNotes dialog with disabled address field", () => {
      const html = renderToStaticMarkup(
        <IpForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          mode="editNotes"
          initialValues={{ address: "10.0.0.1", notes: "Existing note" }}
        />
      );

      expect(html).toContain("تعديل ملاحظات عنوان IP");
      expect(html).toContain("10.0.0.1");
      expect(html).toContain("Existing note");
      expect(html).toContain("disabled");
      expect(html).toContain("حفظ الملاحظات");
    });

    it("renders duplicate/server error banner while retaining input values", () => {
      const html = renderToStaticMarkup(
        <IpForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          mode="create"
          initialValues={{ address: "192.168.1.50", notes: "Core switch" }}
          errorMessage="عنوان IP '192.168.1.50' موجود بالفعل (409 Conflict)"
        />
      );

      expect(html).toContain("ip-form-error");
      expect(html).toContain("عنوان IP &#x27;192.168.1.50&#x27; موجود بالفعل (409 Conflict)");
      expect(html).toContain('value="192.168.1.50"');
      expect(html).toContain("Core switch");
    });

    it("disables submit and form controls while submitting to prevent double submission", () => {
      const html = renderToStaticMarkup(
        <IpForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          mode="create"
          isSubmitting={true}
        />
      );

      expect(html).toContain("جاري الحفظ...");
      expect(html).toContain("disabled");
    });
  });
});
