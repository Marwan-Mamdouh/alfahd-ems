// src/app/(auth)/login/page.tsx

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";

import { useAuthStore } from "@/core/auth/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);

  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // وهمي مؤقت — الباك لسه مش جاهز
    setTimeout(() => {
      setSession("fake-access-token", "fake-refresh-token");

      setUser({
        id: "1",
        name: "مدير النظام",
        email: "admin@fahdgroup.com",
        role: "ADMIN",
        status: "ACTIVE",
      });

      router.push(searchParams.get("redirect") ?? "/dashboard");
    }, 500);
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
                    className="h-11 rounded-xl border-slate-200 pr-10 text-left transition-colors focus-visible:border-teal-500 focus-visible:ring-teal-500/20 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  كلمة المرور
                </Label>

                <div className="relative">
                  <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />

                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    required
                    className="h-11 rounded-xl border-slate-200 pr-10 text-left transition-colors focus-visible:border-teal-500 focus-visible:ring-teal-500/20 dark:border-slate-800"
                  />
                </div>
              </div>

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
