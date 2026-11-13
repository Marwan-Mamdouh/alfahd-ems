# Shared Jobs & Background Progress Dialog

This directory provides the unified UI dialog container for managing asynchronous background jobs (BullMQ), including **Report Exports** (Excel generation and download) and **CSV Imports** (file upload, validation, processing, and outcome reporting).

---

## Component: `<JobProgressDialog />`

A modal dialog that tracks the lifecycle of a BullMQ background job (`QUEUED` ➔ `RUNNING` ➔ `COMPLETED` / `FAILED`), handles polling, renders status indicators, and provides clean user feedback.

### Props Interface

```typescript
import type { JobStatusResponseDto } from "@/core/api/types";

export interface JobProgressDialogProps {
  /** Controls visibility of the dialog modal */
  open: boolean;
  /** Callback when dialog is closed or dismissed */
  onOpenChange: (open: boolean) => void;
  /** "export" for reports, "import" for CSV uploads (default: "import") */
  mode?: "import" | "export";
  /** Dialog title */
  title: string;
  /** Optional dialog description */
  description?: string;
  /** Target upload URL for import mode (e.g. endpoints.ip.import) */
  uploadEndpoint?: string;
  /** Required CSV headers for client pre-validation (default: ['address']) */
  requiredCsvHeaders?: string[];
  /** Existing BullMQ Job ID to track (for export mode or pre-enqueued jobs) */
  initialJobId?: string | null;
  /** Default filename when saving report in export mode (default: "report.xlsx") */
  downloadFilename?: string;
  /** Callback fired once job reaches COMPLETED state */
  onJobComplete?: (job: JobStatusResponseDto) => void;
}
```

---

## Integration Recipes for Frontend Feature Developers

### 1. Attendance Report Export (Feature F2)

When an admin clicks "Export Attendance" on the Attendance or Employee list page:

```tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { JobProgressDialog } from "@/components/shared/jobs/job-progress-dialog";
import { useAttendanceReport } from "@/core/query/use-report-jobs";

export function AttendanceExportButton({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { jobId, generateReport, isGenerating } = useAttendanceReport();

  const handleStartExport = async () => {
    // 1. Enqueue report job on backend
    await generateReport({ startDate, endDate });
    // 2. Open progress dialog (handles polling & automatic file download)
    setDialogOpen(true);
  };

  return (
    <>
      <Button onClick={handleStartExport} disabled={isGenerating}>
        <Download className="mr-2 size-4" />
        {isGenerating ? "Exporting..." : "Export Excel"}
      </Button>

      <JobProgressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="export"
        title="Exporting Attendance Report"
        description="Generating your Excel spreadsheet. The download will start automatically once ready."
        initialJobId={jobId}
        downloadFilename={`attendance-${startDate}-to-${endDate}.xlsx`}
      />
    </>
  );
}
```

---

### 2. Router Inventory Export (Feature F5)

When an admin triggers an export of all or filtered router inventory:

```tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { JobProgressDialog } from "@/components/shared/jobs/job-progress-dialog";
import { useRouterExport } from "@/core/query/use-report-jobs";
import { RouterStatus } from "@alfahd/types";

export function RouterExportButton({ statusFilter }: { statusFilter?: RouterStatus }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { jobId, exportRouters, isExporting } = useRouterExport();

  const handleStartExport = async () => {
    await exportRouters({ status: statusFilter });
    setDialogOpen(true);
  };

  return (
    <>
      <Button variant="outline" onClick={handleStartExport} disabled={isExporting}>
        <Download className="mr-2 size-4" />
        Export Inventory
      </Button>

      <JobProgressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="export"
        title="Export Router Inventory"
        description="Generating router inventory Excel report..."
        initialJobId={jobId}
        downloadFilename="router-inventory-export.xlsx"
      />
    </>
  );
}
```

---

### 3. Bulk IPv4 CSV Import (Feature F6)

When an admin opens the "Import IP Addresses" modal:

```tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { JobProgressDialog } from "@/components/shared/jobs/job-progress-dialog";
import { endpoints } from "@/core/api/endpoints";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/core/query/query-keys";

export function ImportIpButton() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        <Upload className="mr-2 size-4" />
        Import IPs (CSV)
      </Button>

      <JobProgressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="import"
        title="Import IP Addresses"
        description="Upload a CSV file containing IP addresses (max 5MB, up to 5,000 rows)."
        uploadEndpoint={endpoints.ip.import}
        requiredCsvHeaders={["address"]}
        onJobComplete={() => {
          // Invalidate IP list so new IPs appear immediately in the table
          queryClient.invalidateQueries({ queryKey: queryKeys.ipAddresses.all });
        }}
      />
    </>
  );
}
```

