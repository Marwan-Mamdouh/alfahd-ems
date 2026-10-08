// src/app/auth/login/page.tsx

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

import { useAuthStore } from "@/core/auth/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import type { ApiResponse } from "@/core/api/types";
import type { LoginResponseDto } from "@alfahd/types";
import { FORGOT_PASSWORD_PATH } from "@/core/auth/routes";
import { httpStatus, retryAfterSeconds } from "@/core/api/errors";

/**
 * Resolve the post-login redirect target.
 *
 * Allowlist, not a denylist: the value must be a single-slash-prefixed relative
 * path. A prefix check alone is defeated by `/%09/evil.example`, which
 * `URLSearchParams` decodes to a leading tab that the URL parser then strips,
 * leaving a protocol-relative `//evil.example`.
 */
function safeRedirect(raw: string | null): string {
  // One leading `/`, no `//`, no `/\`, and no ASCII control characters anywhere.
  if (!raw || !/^\/(?![/\\])[^\u0000-\u001f\u007f]*$/.test(raw)) {
    return "/dashboard";
  }

  return raw;
}

/**
 * One generic failure message for both an unknown email and a wrong password.
 *
 * This text MUST stay byte-identical across every failure branch: a more
 * specific message ("account not found") turns the login form into an oracle for
 * enumerating staff accounts.
 */
const INVALID_CREDENTIALS_MESSAGE = "بيانات الدخول غير صحيحة";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setRetryAfter(null);

    try {
      // The refresh token arrives as an httpOnly cookie on this response; the
      // body copy is ignored by the web client and never stored in JS.
      const response = await api.post<ApiResponse<LoginResponseDto>>(ENDPOINTS.auth.login, {
        email,
        password,
      });

      const { accessToken, user } = unwrap(response);

      setSession(accessToken, user);
      router.push(safeRedirect(searchParams.get("redirect")));
    } catch (err) {
      const status = httpStatus(err);

      if (status === 429) {
        setError("تم تجاوز عدد محاولات الدخول المسموح بها. يرجى المحاولة مرة أخرى بعد قليل.");
        setRetryAfter(retryAfterSeconds(err));
      } else if (status === 401) {
        // Intentionally the same text as every other 401 — never branch further.
        setError(INVALID_CREDENTIALS_MESSAGE);
      } else if (status === undefined) {
        // No HTTP response at all: the API is unreachable, OR the dashboard is
        // serving itself (Next.js defaults to 3000 too; without `--port 3001`,
        // `API_URL` can point back at the dashboard, and the rewrite returns the
        // app's own HTML which fails to parse). Both look identical from the
        // browser, so name the likely cause.
        //
        // Safe for FR-022: this branch is only reached when there is no HTTP
        // response, so it can never reveal whether the account exists.
        setError("انقطع الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.");
      } else {
        // 5xx or any other settled failure. Deliberately does not distinguish
        // causes that could reveal whether the account exists.
        setError("تعذّر الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-teal-50 via-white to-teal-100/60 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40">
      {/* Background Decorations */}
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="overflow-hidden rounded-3xl border border-teal-100/80 bg-white/90 shadow-xl shadow-teal-950/5 backdrop-blur-xl dark:border-teal-900/50 dark:bg-slate-950/90">
          {/* Top Accent */}
          <div className="h-1.5 w-full bg-gradient-to-l from-teal-700 via-teal-500 to-teal-400" />

          <CardHeader className="space-y-4 px-6 pb-4 pt-8 text-center">
            {/* Logo */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-2xl font-bold text-white shadow-lg shadow-teal-700/20">
              ف
            </div>

            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                الفهد جروب
              </CardTitle>

              <p className="text-sm text-muted-foreground">تسجيل الدخول إلى نظام الإدارة</p>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  البريد الإلكتروني
                </Label>

                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />

                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    placeholder="name@fahdgroup.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 pr-10 text-left transition-colors focus-visible:border-teal-500 focus-visible:ring-teal-500/20 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    كلمة المرور
                  </Label>

                  <Link
                    href={FORGOT_PASSWORD_PATH}
                    className="text-xs font-medium text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
                  >
                    نسيت كلمة المرور؟
                  </Link>
                </div>

                <div className="relative">
                  <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />

                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 pr-10 text-left transition-colors focus-visible:border-teal-500 focus-visible:ring-teal-500/20 dark:border-slate-800"
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  {error}
                  {retryAfter !== null && (
                    <span className="mt-1 block text-xs font-normal opacity-80">
                      يمكنك المحاولة بعد {retryAfter} ثانية
                    </span>
                  )}
                </div>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-gradient-to-l from-teal-700 to-teal-600 font-semibold text-white shadow-md shadow-teal-700/15 transition-all hover:from-teal-800 hover:to-teal-700 hover:shadow-lg disabled:opacity-70"
              >
                {loading ? (
                  "جارٍ الدخول..."
                ) : (
                  <>
                    <LogIn className="ml-2 h-4 w-4" />
                    دخول
                  </>
                )}
              </Button>
            </form>

            {/* Security Note */}
            <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-muted-foreground dark:border-slate-800">
              <ShieldCheck className="h-4 w-4 text-teal-600" />
              <span>دخول آمن إلى نظام الإدارة</span>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-muted-foreground">نظام إدارة الفهد جروب</p>
      </div>
    </div>
  );
}

