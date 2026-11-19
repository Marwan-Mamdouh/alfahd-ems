"use client";

import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { Camera, Loader2, Upload, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EmployeeRow } from "./types";

interface EmployeePhotoDialogProps {
  employee: EmployeeRow | null;
  isOpen: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onUpload: (file: File) => Promise<void> | void;
}

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function EmployeePhotoDialog({
  employee,
  isOpen,
  isSubmitting = false,
  errorMessage,
  onClose,
  onUpload,
}: EmployeePhotoDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [prevEmployeeId, setPrevEmployeeId] = useState<string | null>(employee?.id ?? null);

  // Sync state during render when employee identity changes (React recommended pattern)
  if (employee && employee.id !== prevEmployeeId) {
    setPrevEmployeeId(employee.id);
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError(null);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !employee) return null;

  const isBusy = isSubmitting || localSubmitting;

  const handleClose = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setValidationError(null);
    onClose();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setValidationError("صيغة الملف غير مدعومة. يرجى اختيار صورة بصيغة JPEG أو PNG أو WebP.");
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setValidationError("حجم الصورة يتجاوز الحد المسموح به (5 ميجابايت).");
      return;
    }

    setSelectedFile(file);
    setValidationError(null);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setValidationError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isBusy) return;

    if (!selectedFile) {
      setValidationError("يرجى اختيار ملف صورة أولاً.");
      return;
    }

    try {
      setLocalSubmitting(true);
      setValidationError(null);
      await onUpload(selectedFile);
      handleClose();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "حدث خطأ أثناء رفع الصورة.");
    } finally {
      setLocalSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
        <button
          type="button"
          onClick={handleClose}
          disabled={isBusy}
          aria-label="إغلاق"
          className="absolute left-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <h3 id="photo-dialog-title" className="text-lg font-bold text-foreground">
              تحديث الصورة الشخصية
            </h3>
            <p className="text-xs text-muted-foreground">
              للموظف: <span className="font-semibold text-foreground">{employee.name}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Preview Container */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input p-6 bg-muted/20">
            <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-slate-300 bg-muted shadow-inner dark:border-slate-700">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="معاينة الصورة الجديدة" className="h-full w-full object-cover" />
              ) : employee.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employee.profilePhotoUrl}
                  alt={employee.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-14 w-14 text-muted-foreground" />
              )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground text-center">
              {previewUrl ? "معاينة الصورة المختارة قبل الحفظ" : "الصورة الحالية للموظف"}
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={isBusy}
              className="hidden"
              id="photo-dialog-file-input"
            />

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                {previewUrl ? "اختيار صورة أخرى" : "تحديد ملف صورة"}
              </Button>

              {previewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleClearSelection}
                  className="text-destructive hover:bg-destructive/10"
                >
                  إلغاء التحديد
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground text-center">
              الصيغ المدعومة: JPEG, PNG, WebP (الحد الأقصى: 5 ميجابايت).
            </p>
          </div>

          {(validationError || errorMessage) && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              {validationError || errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" disabled={isBusy} onClick={handleClose}>
              إلغاء
            </Button>

            <Button
              type="submit"
              disabled={isBusy || !selectedFile}
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  حفظ ورفع الصورة
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
