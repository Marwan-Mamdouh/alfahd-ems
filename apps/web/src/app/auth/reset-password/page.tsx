// src/app/auth/reset-password/page.tsx

"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LOGIN_PATH, FORGOT_PASSWORD_PATH } from "@/core/auth/routes";
import { api } from "@/core/api/axios-instance";
import { httpStatus, serverMessage } from "@/core/api/errors";
import { ENDPOINTS } from "@/core/api/endpoints";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The single-use token travels in the reset link: `${FRONTEND_URL}/auth/reset-password?token=…`
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Only the 8-character minimum, which is exactly what the backend enforces.
    // A stronger client rule would reject a password the server would accept,
    // which is more confusing than permissive (FR-025).
    if (password.length < 8) {
      setError("كلمة المرور 8 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);

    try {
      await api.post(ENDPOINTS.auth.resetPassword, { token, newPassword: password });

      setDone(true);

      // Cleared on unmount so the pending navigation cannot fire against a
      // component that is already gone.
      redirectTimer.current = setTimeout(() => router.push(LOGIN_PATH), 2000);
    } catch (err) {
      // A 400 covers both an invalid/expired token and a validation failure. Only
      // the former warrants the expired-link panel, so match the server's own
      // reason rather than assuming every 400 is an expired link.
      if (httpStatus(err) === 400 && isExpiredTokenError(err)) {
        // The token is invalid, expired, or already used. Say so explicitly and
        // offer a way back — a generic failure strands anyone following an old
        // email with no idea what to do next.
        setExpired(true);
      } else {
        setError(serverMessage(err) ?? "تعذّر تغيير كلمة المرور. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">كلمة مرور جديدة</CardTitle>
        </CardHeader>

        <CardContent>
          {done ? (
            <p className="text-center text-sm text-emerald-600">
              تم تغيير كلمة المرور بنجاح — جارٍ تحويلك لتسجيل الدخول...
            </p>
          ) : expired ? (
            <div className="space-y-4">
              <p role="alert" className="rounded-md bg-red-50 p-3 text-center text-sm text-red-700">
                هذا الرابط غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد لإعادة تعيين كلمة المرور.
              </p>

              <Link
                href={FORGOT_PASSWORD_PATH}
                className="inline-flex h-10 w-full items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                طلب رابط جديد
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور الجديدة</Label>
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm"
                  type="password"
                  dir="ltr"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {!token && (
                <p className="text-sm text-destructive">
                  رابط إعادة التعيين غير مكتمل. يرجى فتح الرابط الوارد في البريد الإلكتروني.
                </p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * True when a 400 is about the token rather than the password.
 *
 * The backend returns 400 for both an invalid/expired token and a DTO validation
 * failure, so status alone cannot tell them apart. Showing the expired-link panel
 * for a password problem would send the user to request a new email they do not
 * need (FR-025).
 */
// Matches the backend's 'Invalid or expired reset token' (apps/api/src/auth/auth.service.ts). Update both together.
function isExpiredTokenError(err: unknown): boolean {
  const message = serverMessage(err)?.toLowerCase() ?? "";

  return (
    message.includes("token") ||
    message.includes("رابط") ||
    message.includes("منتهي") ||
    message.includes("invalid or expired")
  );
}
