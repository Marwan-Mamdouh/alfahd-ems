"use client";

import { useState } from "react";
import { FileSpreadsheet, Network, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { IpActionDialog } from "./ip-action-dialog";
import { IpCreateModal } from "./ip-create-modal";
import { IpCsvImportModal } from "./ip-csv-import-modal";
import { IpEditNotesModal } from "./ip-edit-notes-modal";
import { IpHistoryDrawer } from "./ip-history-drawer";
import { IpTable } from "./ip-table";
import type {
  CreateIpDto,
  IpActionType,
  IpCreateFormValues,
  IpEditNotesFormValues,
  IpManagementProps,
  IpRow,
  MutationState,
} from "./types";

/**
 * Composite presentational view for IPv4 Pool Management (Issue #87 / F6).
 * Manages modal visibility states and connects user interactions with container callbacks.
 */
export function IpManagementView({
  data,
  filter,
  capabilities,
  job,
  history,
  onFilterChange,
  onPageChange,
  onCreate,
  onEditNotes,
  onAction,
  onImportCsv,
  onResetJob,
  onViewHistory,
}: IpManagementProps) {
  // Modal visibility and selected target states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingIp, setEditingIp] = useState<IpRow | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    ip: IpRow;
    action: IpActionType;
  } | null>(null);

  // Local mutation states for presentational feedback
  const [createMutation, setCreateMutation] = useState<
    MutationState<IpCreateFormValues>
  >({
    pending: false,
    error: null,
  });

  const [editMutation, setEditMutation] = useState<
    MutationState<IpEditNotesFormValues>
  >({
    pending: false,
    error: null,
  });

  const [actionMutation, setActionMutation] = useState<
    MutationState<{ reason?: string }>
  >({
    pending: false,
    error: null,
  });

  // ── Action Handlers ──────────────────────────────────────────

  const handleCreateSubmit = async (values: CreateIpDto) => {
    setCreateMutation({ pending: true, error: null });
    try {
      await onCreate(values);
      setCreateMutation({ pending: false, error: null });
      setIsCreateModalOpen(false);
    } catch (err) {
      setCreateMutation({
        pending: false,
        error:
          err instanceof Error
            ? err.message
            : "فشل في إضافة عنوان IP. يرجى المحاولة مرة أخرى.",
      });
    }
  };

  const handleEditSubmit = async (id: string, notes: string) => {
    setEditMutation({ pending: true, error: null });
    try {
      await onEditNotes(id, notes);
      setEditMutation({ pending: false, error: null });
      setEditingIp(null);
    } catch (err) {
      setEditMutation({
        pending: false,
        error:
          err instanceof Error
            ? err.message
            : "فشل في تحديث الملاحظات. يرجى المحاولة مرة أخرى.",
      });
    }
  };

  const handleActionConfirm = async (
    id: string,
    action: IpActionType,
    reason?: string
  ) => {
    setActionMutation({ pending: true, error: null });
    try {
      await onAction(id, action, reason);
      setActionMutation({ pending: false, error: null });
      setActionTarget(null);
    } catch (err) {
      setActionMutation({
        pending: false,
        error:
          err instanceof Error
            ? err.message
            : "فشل في تنفيذ العملية. يرجى التحقق من حالة العنوان.",
      });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              إدارة عناوين IPv4
            </h1>
            <p className="text-xs text-muted-foreground">
              إدارة حمام السباحة لعناوين الشبكة، وحالات الحجز والأرشفة، والاستيراد الجماعي
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {capabilities.import && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onResetJob();
                setIsCsvModalOpen(true);
              }}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>استيراد CSV</span>
            </Button>
          )}

          {capabilities.create && (
            <Button
              size="sm"
              onClick={() => {
                setCreateMutation({ pending: false, error: null });
                setIsCreateModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة عنوان IP</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Data Table ─────────────────────────────────────────────── */}
      <IpTable
        data={data}
        filter={filter}
        capabilities={capabilities}
        onFilterChange={onFilterChange}
        onPageChange={onPageChange}
        onSelectAction={(ip, action) => {
          setActionMutation({ pending: false, error: null });
          setActionTarget({ ip, action });
        }}
        onSelectEdit={(ip) => {
          setEditMutation({ pending: false, error: null });
          setEditingIp(ip);
        }}
        onViewHistory={(ip) => onViewHistory(ip)}
      />

      {/* ── Modals & Drawers ───────────────────────────────────────── */}
      <IpCreateModal
        isOpen={isCreateModalOpen}
        mutation={createMutation}
        onSubmit={handleCreateSubmit}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <IpEditNotesModal
        isOpen={Boolean(editingIp)}
        ip={editingIp}
        mutation={editMutation}
        onSubmit={handleEditSubmit}
        onClose={() => setEditingIp(null)}
      />

      <IpActionDialog
        isOpen={Boolean(actionTarget)}
        ip={actionTarget?.ip ?? null}
        action={actionTarget?.action ?? null}
        mutation={actionMutation}
        onConfirm={handleActionConfirm}
        onClose={() => setActionTarget(null)}
      />

      <IpHistoryDrawer
        isOpen={Boolean(history.selectedIp)}
        ip={history.selectedIp}
        canView={capabilities.history}
        data={history.data}
        onClose={() => onViewHistory(null)}
      />

      <IpCsvImportModal
        isOpen={isCsvModalOpen}
        job={job}
        onImport={onImportCsv}
        onReset={onResetJob}
        onClose={() => setIsCsvModalOpen(false)}
      />
    </div>
  );
}
