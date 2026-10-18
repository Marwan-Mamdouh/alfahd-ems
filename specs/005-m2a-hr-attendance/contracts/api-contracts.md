# API Contracts: Milestone M2a — HR & Attendance

**Branch**: `feat/m2a-hr-attendance` | **Date**: 2026-10-11  
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

All responses conform to the standard global envelope:
- Success: `{ "data": <payload> }` (or `{ "data": [...], "meta": { "page", "pageSize", "total" } }` for paginated queries)
- Error: `{ "error": { "code": "UPPER_SNAKE", "message": "human readable", "details": <optional> } }`

---

## 1. Employee Endpoints

### 1.1 `POST /employees`
Creates a new employee profile. Reuses `UsersService`. Generates temporary password sent via email.

- **Role**: `ADMIN`
- **Request Body**:
```json
{
  "name": "Ahmed Mostafa",
  "email": "ahmed.mostafa@fahdgroup.com",
  "role": "TECHNICIAN",
  "department": "TECHNICAL",
  "phone": "+201012345678",
  "nationalId": "29501011234567",
  "hireDate": "2026-01-15",
  "assignedWarehouseId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
}
```
*Note: `assignedWarehouseId` is mandatory when `role === 'TECHNICIAN'`, optional for other roles.*

- **Response (201 Created)**:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Ahmed Mostafa",
    "email": "ahmed.mostafa@fahdgroup.com",
    "role": "TECHNICIAN",
    "department": "TECHNICAL",
    "phone": "+201012345678",
    "nationalId": "29501011234567",
    "hireDate": "2026-01-15",
    "status": "ACTIVE",
    "assignedWarehouseId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "profilePhotoKey": null,
    "createdAt": "2026-10-11T08:00:00.000Z"
  }
}
```

---

### 1.2 `GET /employees`
Lists employees with composable filters and pagination.

- **Role**: `ADMIN`
- **Query Parameters**:
  - `role`: Optional `Role` (`ADMIN | WAREHOUSE_STAFF | CS | TECHNICIAN`)
  - `department`: Optional `Department` (`TECHNICAL | CUSTOMER_SERVICE | WAREHOUSE | MANAGEMENT`)
  - `status`: Optional `UserStatus` (`ACTIVE | ON_LEAVE | INACTIVE`)
  - `warehouse_id`: Optional UUID
  - `q`: Optional search string (matches `name` or `email` case-insensitively)
  - `page`: Default 1
  - `pageSize`: Default 20, max 100
- **Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Ahmed Mostafa",
      "email": "ahmed.mostafa@fahdgroup.com",
      "role": "TECHNICIAN",
      "department": "TECHNICAL",
      "status": "ACTIVE",
      "assignedWarehouseId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "profilePhotoKey": "employees/photos/ahmed_123"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

---

### 1.3 `GET /employees/:id`
Retrieves single employee profile.

- **Role**: `ADMIN` or the employee themselves (`user.id === params.id`)
- **Response (200 OK)**:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Ahmed Mostafa",
    "email": "ahmed.mostafa@fahdgroup.com",
    "role": "TECHNICIAN",
    "department": "TECHNICAL",
    "phone": "+201012345678",
    "nationalId": "29501011234567",
    "hireDate": "2026-01-15",
    "status": "ACTIVE",
    "assignedWarehouseId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "profilePhotoKey": "employees/photos/ahmed_123",
    "createdAt": "2026-10-11T08:00:00.000Z"
  }
}
```

---

### 1.4 `PATCH /employees/:id`
Updates profile metadata.

- **Role**: `ADMIN`
- **Request Body**:
```json
{
  "name": "Ahmed Mostafa Updated",
  "department": "TECHNICAL",
  "phone": "+201099999999",
  "assignedWarehouseId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
}
```

---

### 1.5 `PATCH /employees/:id/status`
Updates operational status with mandatory reason.

- **Role**: `ADMIN`
- **Request Body**:
```json
{
  "status": "INACTIVE",
  "reason": "Employee resigned"
}
```
*Note: Setting status to `INACTIVE` revokes all active Redis refresh sessions (`rt:{userId}:*`). Setting `ON_LEAVE` does not revoke sessions.*

---

### 1.6 `POST /employees/:id/photo`
Uploads profile photo to Cloudinary.

- **Role**: `ADMIN`
- **Request**: `multipart/form-data`, field `file` (max 5 MB, JPEG or PNG checked by magic bytes).
*Note: If the employee already had a `profilePhotoKey`, the previous asset in Cloudinary is deleted immediately upon successful update of the database.*
- **Response (200 OK)**:
```json
{
  "data": {
    "profilePhotoKey": "employees/photos/p9s7dfy234",
    "url": "https://res.cloudinary.com/.../employees/photos/p9s7dfy234.jpg"
  }
}
```

---

## 2. Attendance Endpoints

### 2.1 `POST /attendance/check-in`
Technician check-in with GPS verification.

- **Role**: `TECHNICIAN`
- **Request Body**:
```json
{
  "lat": 30.0444,
  "lng": 31.2357
}
```
- **Response (201 Created)**:
```json
{
  "data": {
    "id": "661e8400-e29b-41d4-a716-446655440001",
    "workDate": "2026-10-11",
    "checkInAt": "2026-10-11T06:45:12.345Z",
    "checkInDistanceM": 45.2,
    "status": "ON_TIME"
  }
}
```
- **Error Responses**:
  - Distance > 150m:
    ```json
    {
      "error": {
        "code": "OUT_OF_RANGE",
        "message": "Check-in coordinates are 240.5m away from assigned warehouse (maximum 150m allowed)",
        "details": { "distanceM": 240.5, "allowedRadiusM": 150 }
      }
    }
    ```
  - Second check-in on same day:
    ```json
    {
      "error": {
        "code": "ALREADY_CHECKED_IN",
        "message": "Attendance record already exists for today (2026-10-11)"
      }
    }
    ```
  - No assigned warehouse:
    ```json
    {
      "error": {
        "code": "NO_ASSIGNED_WAREHOUSE",
        "message": "Technician has no assigned warehouse"
      }
    }
    ```

---

### 2.2 `POST /attendance/check-out`
Technician check-out from anywhere (no GPS check).

- **Role**: `TECHNICIAN`
- **Request Body**: Empty `{}`.
- **Response (200 OK)**:
```json
{
  "data": {
    "id": "661e8400-e29b-41d4-a716-446655440001",
    "workDate": "2026-10-11",
    "checkInAt": "2026-10-11T06:45:12.345Z",
    "checkOutAt": "2026-10-11T15:30:00.000Z",
    "status": "ON_TIME",
    "hoursWorked": 8.75
  }
}
```
- **Error Responses**:
  - No active check-in today:
    ```json
    {
      "error": {
        "code": "NO_ACTIVE_CHECK_IN",
        "message": "No open check-in found for today"
      }
    }
    ```

---

### 2.3 `PATCH /attendance/:id`
Admin overrides an existing attendance record.

- **Role**: `ADMIN`
- **Request Body**:
```json
{
  "checkInAt": "2026-10-11T07:00:00.000Z",
  "checkOutAt": "2026-10-11T16:00:00.000Z",
  "status": "ON_TIME",
  "overrideReason": "Technician device GPS failed at gate; authorized by supervisor"
}
```
*Note: `overrideReason` is strictly mandatory.*

- **Response (200 OK)**:
```json
{
  "data": {
    "id": "661e8400-e29b-41d4-a716-446655440001",
    "workDate": "2026-10-11",
    "checkInAt": "2026-10-11T07:00:00.000Z",
    "checkOutAt": "2026-10-11T16:00:00.000Z",
    "status": "ON_TIME",
    "overrideReason": "Technician device GPS failed at gate; authorized by supervisor",
    "overriddenBy": "admin-uuid",
    "overriddenAt": "2026-10-11T16:05:00.000Z"
  }
}
```

---

## 3. Reporting & Jobs Endpoints

### 3.1 `GET /attendance/report`
Enqueues background Excel generation job.

- **Role**: `ADMIN`
- **Query Parameters**:
  - `from`: ISO date `YYYY-MM-DD`
  - `to`: ISO date `YYYY-MM-DD` (difference between `to` and `from` must not exceed 366 days, else 400 `DATE_RANGE_EXCEEDS_MAXIMUM`)
  - `department`: Optional `Department`
  - `employee_id`: Optional UUID
- **Response (202 Accepted)**:
```json
{
  "data": {
    "jobId": "report-attendance-981247"
  }
}
```

---

### 3.2 `GET /jobs/:id`
Queries asynchronous job status.

- **Role**: `ADMIN` or the user who initiated the job
- **Response (200 OK)**:
```json
{
  "data": {
    "id": "report-attendance-981247",
    "status": "COMPLETED",
    "downloadUrl": "https://res.cloudinary.com/.../reports/attendance_20261011.xlsx",
    "error": null
  }
}
```
*Possible `status` values: `QUEUED | RUNNING | COMPLETED | FAILED`.*
