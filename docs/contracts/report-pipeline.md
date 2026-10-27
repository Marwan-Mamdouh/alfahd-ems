# Report pipeline contract — draft

**Status:** Supporting card; current behavior plus M2b extension requirements. Read the [M2b implementation contract](m2b-supply-implementation.md) for the latest approved decisions and remaining technical freeze items.

## Existing attendance report behavior

- Queue name: `reports`.
- Enqueue job name: `attendance-summary`.
- Payload: `{ type: 'ATTENDANCE_SUMMARY', params: <attendance-summary DTO>, requestedBy: <requester user ID> }`.
- Enqueue assigns a UUID BullMQ `jobId` and responds with `{ jobId }`.
- `GET /jobs/:id` maps BullMQ states to `QUEUED`, `RUNNING`, `COMPLETED`, or `FAILED`. Non-admin users may see only their own jobs; unauthorized and missing jobs both return not found. Failed responses expose a generic error, not the raw worker failure.
- The attendance worker currently returns `{ downloadUrl: '', totalRows: 0, completedAt }` for any type other than `ATTENDANCE_SUMMARY`. This is unsafe for mixed report types and must be replaced with explicit dispatch/rejection before router jobs share this queue.
- Completed status currently exposes `downloadUrl` from the job return value. The public status DTO does not expose arbitrary worker result fields.

## Required M2b extension — not yet implemented

Router report jobs must use this same queue and requester ownership model. Only admins may generate M2b supply reports or import CSVs. The shared worker must explicitly dispatch supported types and fail unsupported types; an unsupported job must never complete with an empty URL. Preserve attendance behavior and `GET /jobs/:id` authorization while extending dispatch.

Cloudinary is the approved first choice, with explicitly configured local disk as a temporary fallback if Cloudinary cannot provide working Excel downloads. Actual downloadable bytes, not just saved metadata or a fake URL, are required. The M2b implementation contract describes storage/security requirements and the approved deviation from the earlier R2-only wording.

Before the technical API is frozen, approve the router report payload/result, job name, filters, columns, polling response shape and download access contract. Import polling also needs an additive result contract; the existing status DTO does not expose `{ inserted, skipped, errors }`. Do not add the M4b `report_jobs` table as part of M2b.
