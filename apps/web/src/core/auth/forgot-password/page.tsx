
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // TODO: Phase 2
    // سيتم استبداله لاحقًا بـ:
    // POST /auth/forgot-password

    setSent(true);
  };

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">استعادة كلمة المرور</CardTitle>

          <p className="text-sm text-muted-foreground">
            {sent
              ? "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني"
              : "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"}
          </p>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-3 text-center text-sm text-green-700">
                إذا كان البريد الإلكتروني مسجلًا، فسيتم إرسال رابط إعادة تعيين كلمة المرور إليه.
              </div>

              <Link
                href="/auth/login"
                className="inline-flex h-10 w-full items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>

                <Input
                  id="email"
                  name="email"
                  type="email"
                  dir="ltr"
                  placeholder="example@fahdgroup.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full">
                إرسال رابط إعادة التعيين
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
;
