// src/components/shared/states/index.tsx
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Loader2,
  RotateCcw,
  TriangleAlert,
  ShieldX,
  CheckCircle2,
} from "lucide-react";

export function LoadingState({
  label = "جارٍ التحميل...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground ${className}`}
      dir="rtl"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className = "",
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}
      dir="rtl"
    >
      <TriangleAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium text-destructive">{message ?? "حدث خطأ غير متوقع"}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RotateCcw className="ml-2 h-4 w-4" aria-hidden="true" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-2 py-16 text-center ${className}`}
      dir="rtl"
    >
      <Inbox className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ForbiddenState({
  title = "غير مصرح بالوصول",
  message = "ليس لديك صلاحية لعرض هذه الصفحة. تواصل مع مدير النظام.",
  action,
  className = "",
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-2 py-24 text-center ${className}`}
      dir="rtl"
    >
      <ShieldX className="h-10 w-10 text-destructive/70" aria-hidden="true" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SuccessState({
  title = "تم بنجاح",
  message,
  action,
  className = "",
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-2 py-12 text-center ${className}`}
      dir="rtl"
    >
      <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
      <p className="font-semibold text-foreground">{title}</p>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
