# Quickstart: Milestone M2a — HR & Attendance

**Branch**: `feat/m2a-hr-attendance` | **Date**: 2026-10-11  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide walks through configuring, building, and verifying Milestone M2a.

---

## 1. Environment Setup

Ensure `apps/api/.env` includes the required M2a keys:
```bash
# Timezone & Attendance Defaults
APP_TIMEZONE=Africa/Cairo
ATTENDANCE_CUTOFF_TIME=09:00
ATTENDANCE_RADIUS_M=150

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=alfahd-ems
CLOUDINARY_API_KEY=mock_key
CLOUDINARY_API_SECRET=mock_secret

# BullMQ Redis
REDIS_URL=redis://127.0.0.1:6379
```

---

## 2. Monorepo Build Sequence

Always build shared types first per the project constitution:
```bash
# 1. Build shared types
pnpm --filter @alfahd/types build

# 2. Run API typecheck
pnpm --filter @alfahd/api typecheck

# 3. Run migrations
pnpm --filter @alfahd/api db:migrate

# 4. Run tests
pnpm --filter @alfahd/api test
```

---

## 3. Verifying Key Flows

### 3.1 Creating an Employee
```bash
curl -X POST http://localhost:3000/employees \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mahmoud Hassan",
    "email": "mahmoud.hassan@fahdgroup.com",
    "role": "TECHNICIAN",
    "department": "TECHNICAL",
    "phone": "+201011112222",
    "nationalId": "29001011234567",
    "hireDate": "2026-02-01",
    "assignedWarehouseId": "'$WAREHOUSE_ID'"
  }'
```

### 3.2 Technician Check-in (Within 150m)
```bash
curl -X POST http://localhost:3000/attendance/check-in \
  -H "Authorization: Bearer $TECH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 30.0444,
    "lng": 31.2357
  }'
```

### 3.3 Technician Check-out (From Anywhere)
```bash
curl -X POST http://localhost:3000/attendance/check-out \
  -H "Authorization: Bearer $TECH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3.4 Requesting Attendance Excel Report
```bash
curl -X GET "http://localhost:3000/attendance/report?from=2026-01-01&to=2026-10-11" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Returns { "data": { "jobId": "..." } }

# Poll job status
curl -X GET "http://localhost:3000/jobs/$JOB_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
