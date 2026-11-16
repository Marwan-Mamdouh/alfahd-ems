"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Pencil, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { IpEditNotesModalProps } from "./types";

/**
 * Modal dialog for updating the notes/metadata of an existing IPv4 address.
 * Corresponds to PATCH /ip-addresses/:id.
 */
export function IpEditNotesModal({
  isOpen,
  ip,
  mutation,
  onSubmit,
  onClose,
}: IpEditNotesModalProps) {
  const [notes, setNotes] = useState(ip?.notes ?? "");
  const [lastIpId, setLastIpId] = useState(ip?.id);

  // Sync notes when ip prop changes without useEffect cascading renders
  if (ip && ip.id !== lastIpId) {
    setLastIpId(ip.id);
    setNotes(ip.notes ?? "");
  }

  if (!isOpen || !ip) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mutation.pending) return;

    await onSubmit(ip.id, notes.trim());
  };

  const handleClose = () => {
    if (mutation.pending) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-ip-notes-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="edit-ip-notes-modal-title"
                className="text-lg font-bold text-foreground"
              >
                تعديل ملاحظات العنوان
              </h2>
              <p className="font-mono text-xs text-muted-foreground dir-ltr text-right">
                {ip.address}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={mutation.pending}
            className="h-8 w-8 p-0"
            aria-label="إغلاق النافذة"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mutation.error && (
            <div
              className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{mutation.error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="edit-ip-notes-input"
              className="block text-xs font-semibold text-foreground"
            >
              الملاحظات
            </label>
            <textarea
              id="edit-ip-notes-input"
              rows={4}
              placeholder="اكتب ملاحظات حول تخصيص العنوان أو استخدامه..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.pending}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              maxLength={500}
            />
            {mutation.fieldErrors?.notes && (
              <p className="text-xs text-destructive">
                {mutation.fieldErrors.notes}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={mutation.pending}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.pending}
              className="min-w-[100px]"
            >
              {mutation.pending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-1.5 h-4 w-4" />
                  حفظ التعديلات
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
