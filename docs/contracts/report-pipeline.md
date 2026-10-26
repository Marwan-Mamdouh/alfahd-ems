# Report pipeline contract — draft

**Status:** Draft; documents observed behavior and proposed M2b extension. Freeze after Ahmed/Marwan review.

## Existing attendance report behavior

- Queue name: `reports`.
- Enqueue job name: `attendance-summary`.
- Payload: `{ type: 'ATTENDANCE_SUMMARY', params: <attendance-summary DTO>, requestedBy: <requester user ID> }`.
- Enqueue assigns a UUID BullMQ `jobId` and responds with `{ jobId }`.
- `GET /jobs/:id` maps BullMQ states to `QUEUED`, `RUNNING`, `COMPLETED`, or `FAILED`. Non-admin users may see only their own jobs; unauthorized and missing jobs both return not found. Failed responses expose a generic error, not the raw worker failure.
- The attendance worker currently returns `{ downloadUrl: '', totalRows: 0, completedAt }` for any type other than `ATTENDANCE_SUMMARY`. This is unsafe for mixed report types and must be replaced with explicit dispatch/rejection before router jobs share this queue.
- Completed status currently exposes `downloadUrl` from the job return value. The public status DTO does not expose arbitrary worker result fields.

## Required M2b extension — not yet implemented

Router report jobs must use this same queue and requester ownership model. Their payload, job name, filters, result fields and storage provider remain to be approved. The shared worker must explicitly dispatch supported types and fail unsupported types; an unsupported job must never complete with an empty URL. Preserve attendance behavior and `GET /jobs/:id` authorization while extending dispatch.

Before this contract is frozen, approve the router report payload/result, storage provider (including the `PLAN.md` R2 requirement), and polling response shape. Do not add the M4b `report_jobs` table as part of M2b.
