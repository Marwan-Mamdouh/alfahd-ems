// src/app/auth/forgot-password/page.tsx

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { LOGIN_PATH } from "@/core/auth/routes";
import { api } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      // The endpoint always returns 200, whether or not the address is
      // registered, so this confirmation cannot be used to enumerate accounts.
      await api.post(ENDPOINTS.auth.forgotPassword, { email });
      setSent(true);
    } catch {
      // Only a transport or server failure reaches here — never "no such user".
      setError("تعذّر إرسال الطلب. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">استعادة كلمة المرور</CardTitle>

          <p className="text-sm text-muted-foreground">
            {sent
              ? "تم استلام طلبك"
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
                href={LOGIN_PATH}
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

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ الإرسال..." : "إرسال رابط إعادة التعيين"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
