# Research: Milestone M2a — HR & Attendance

**Branch**: `feat/m2a-hr-attendance` | **Date**: 2026-10-11  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## 1. Geofencing & Haversine Distance Formula

### Problem
Technician check-in requires verifying that the submitted client GPS coordinates `(lat, lng)` are within `ATTENDANCE_RADIUS_M` (default 150 meters) of the technician's home warehouse coordinates.

### Technical Solution
Use the great-circle Haversine formula implemented as a pure function:
```ts
const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}
```

### Verification Vectors
- Distance between identical points: exactly `0` meters.
- Distance between Cairo Citadel (`30.0299, 31.2611`) and Tahrir Square (`30.0444, 31.2357`): ~2,950 meters.
- Micro-distance (e.g., 0.001 degrees lat ≈ 111.3 meters): validated against standard GIS geodesics.
- Unit tests must assert 0m, 149m (accepted), 150m (accepted), 151m (rejected with 400).

---

## 2. Timezone & Work Date Computation

### Problem
Egypt observes Daylight Saving Time (DST). A fixed UTC offset (e.g. `UTC+2` or `UTC+3`) is prone to clock skew and inaccurate day boundary calculations.

### Technical Solution
Store all database timestamps in UTC (`timestamptz`). Evaluate local day boundaries, `work_date` (`YYYY-MM-DD`), and `ATTENDANCE_CUTOFF_TIME` (default `09:00`) dynamically using the IANA timezone string `Africa/Cairo` configured via `APP_TIMEZONE`.

Inject a `ClockService` into attendance services:
```ts
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
```
In tests, `ClockService` can be easily mocked or replaced with a fixed instant to verify cutoff logic at `08:59:59` (`ON_TIME`) vs `09:00:01` (`LATE`).

Local time and date extraction uses `Intl.DateTimeFormat`:
```ts
export function getLocalWorkDate(date: Date, timeZone = 'Africa/Cairo'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // outputs YYYY-MM-DD
}

export function isAfterCutoff(
  date: Date,
  cutoffTime = '09:00',
  timeZone = 'Africa/Cairo',
): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hours = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
  const minutes = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  const [cutoffH, cutoffM] = cutoffTime.split(':').map(Number);

  return hours > cutoffH || (hours === cutoffH && minutes > cutoffM);
}
```

---

## 3. Storage Service & Cloudinary Integration

### Interface Design
Per `PLAN.md` §4e:
"External services sit behind interfaces with fake implementations for tests: `EmailProvider`, `StorageService`, `PushProvider`."

```ts
export interface StorageUploadResult {
  publicId: string;
  url: string;
}

export interface StorageService {
  uploadFile(buffer: Buffer, folder: string, mimeType: string): Promise<StorageUploadResult>;
  deleteFile(publicId: string): Promise<void>;
  getOptimizedUrl(publicId: string, options?: { width?: number; quality?: string }): string;
}
```

### Implementations
1. `CloudinaryStorageService`:
   Uses `cloudinary.v2.uploader.upload_stream`.
   Stores `public_id` in database (`profile_photo_key`).
   Generates optimized transform URLs using Cloudinary CDN utilities (`f_auto,q_auto,w_...`).
2. `FakeStorageService`:
   In-memory map for unit and E2E test suites (`StorageServiceMock`). Records upload and delete calls. Zero external network dependency.

### File Validation & Magic Bytes
Reject files solely relying on client-supplied `Content-Type`. Validate magic bytes from buffer:
- JPEG: First 3 bytes `FF D8 FF`
- PNG: First 8 bytes `89 50 4E 47 0D 0A 1A 0A`
- Max file size: 5 MB (5 * 1024 * 1024 bytes).

---

## 4. BullMQ Report-Job Pipeline

### Pipeline Architecture
1. Client requests `GET /attendance/report?from=...&to=...&department=...&employee_id=...`.
2. Controller verifies Admin role, validates query dates.
3. Service enqueues job into BullMQ queue `reports` with payload `{ type: 'ATTENDANCE_SUMMARY', params, requestedBy }`.
4. Returns `{ jobId: job.id }` immediately with HTTP 202 Accepted.
5. BullMQ Worker (`ReportsWorker`):
   - Fetches records matching filters from Drizzle.
   - Instantiates `exceljs.Workbook`.
   - Populates sheet with headers: `Employee Name`, `Department`, `Work Date`, `Check-in Time`, `Check-out Time`, `Hours Worked`, `Status`, `Override Notes`.
   - Applies styling, auto-column widths, and RTL/UTF-8 font settings.
   - Writes to buffer.
   - Calls `StorageService.uploadFile(buffer, 'reports', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`.
   - Saves result payload into job return data: `{ downloadUrl, totalRows, completedAt }`.
6. Client polls `GET /jobs/:id`:
   - Inspects BullMQ job via `queue.getJob(id)`.
   - Returns `{ id, status: job.getState(), downloadUrl: job.returnvalue?.downloadUrl, error: job.failedReason }`.

---

## 5. Drizzle Schema & Migration Strategy (Zero TypeScript Enums)

### Rule on Enums
- **TypeScript `enum` keyword is strictly prohibited.**
- All domain value sets are authored in `packages/types/src/index.ts` as `as const` arrays (`DEPARTMENTS`, `USER_STATUSES`, `ATTENDANCE_STATUSES`) and derived union types.
- Drizzle `pgEnum` declarations in `apps/api/src/database/schema/index.ts` pass these exact `as const` arrays directly to `pgEnum('...', ARRAY)`.

### Incremental Migration on top of M1
1. Existing M1 schema contains `users` with `is_active boolean` and basic columns.
2. In M2a:
   - Create `department` pgEnum from `DEPARTMENTS`: `TECHNICAL`, `CUSTOMER_SERVICE`, `WAREHOUSE`, `MANAGEMENT`.
   - Create `user_status` pgEnum from `USER_STATUSES`: `ACTIVE`, `ON_LEAVE`, `INACTIVE`.
   - Alter `users` table:
     - Add `phone` varchar(30) NULL
     - Add `national_id` varchar(30) NULL
     - Add `hire_date` date NULL
     - Add `profile_photo_key` varchar(255) NULL
     - Add `department` department_enum NULL
     - Add `status` user_status DEFAULT 'ACTIVE' NOT NULL
     - Add `assigned_warehouse_id` uuid NULL REFERENCES warehouses(id)
   - Create `attendance_status` pgEnum from `ATTENDANCE_STATUSES`: `ON_TIME`, `LATE`.
   - Create `attendance_records` table:
     - `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
     - `user_id` uuid NOT NULL REFERENCES users(id)
     - `work_date` date NOT NULL
     - `check_in_at` timestamptz NOT NULL
     - `check_in_lat` double precision NOT NULL
     - `check_in_lng` double precision NOT NULL
     - `check_in_distance_m` double precision NOT NULL
     - `check_out_at` timestamptz NULL
     - `status` attendance_status NOT NULL
     - `override_reason` text NULL
     - `overridden_by` uuid NULL REFERENCES users(id)
     - `overridden_at` timestamptz NULL
     - `created_at` timestamptz DEFAULT now() NOT NULL
     - `updated_at` timestamptz DEFAULT now() NOT NULL
     - UNIQUE (`user_id`, `work_date`)
