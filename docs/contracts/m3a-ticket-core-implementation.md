# M3a Ticket Core Implementation Contract

- **Recorded:** 2026-10-29
- **Updated & Aligned:** 2026-11-05
- **Governing docs:** SoW §2.1.12, §3, §4.3; CRM SRS §3, §5, §6; `PLAN.md` §1 (Constitution), §2 (Decisions), §3 (M3a Scope, DoD, Bad Shape Tests)
- **Business decisions:** Ahmed & Marwan, confirmed in implementation planning and supply chain reconciliation
- **Backend delivery:** Ahmed (WS-B / WS-C)
- **Integration, contract review and schema merge:** Marwan (WS-P)
- **Status:** Approved business direction; technical freeze items aligned with `PLAN.md` and M2b contracts.

---

## 1. Read This First

This document is the governing implementation contract and engineering blueprint for **Milestone M3a (Ticket Core)**. It specifies the canonical data structures, operational lifecycle state machines, transactional seams, validation invariants, role-based access controls (RBAC), and LMS repository patterns required to implement the core service ticket engine.

Read this document alongside the master [`PLAN.md`](file:///e:/alfahd-ems/PLAN.md) and [`AGENTS.md`](file:///e:/alfahd-ems/AGENTS.md) before writing any code.

Distinguish three categories:
1. **Approved Requirement:** The mandatory functional behavior, lifecycle transitions, and business rules derived from the SoW and SRS.
2. **Engineering Invariant:** Non-negotiable architectural constraints (e.g. single atomic database transactions, 5-layer LMS repository pattern, CWE sanitization, zero docker dependencies for unit/e2e tests).
3. **Constitution & Bad Shape Rule:** Hard architectural red lines defined in `PLAN.md` (e.g. no database-level foreign key on `tickets.customer_id`, strictly stub-only `customers`, no premature CRM fields).

---

## 2. Changes & Clarifications Across Governing Documents

| Earlier Assumption / Draft | Locked Requirement (`PLAN.md` & SoW) | Rationale & Architectural Rule |
| :--- | :--- | :--- |
| `Customer` might be mistaken for Customer Service employee | **`Customer`** is the external client/subscriber receiving telecom service at a physical GPS location. **`CS`** is the internal employee (`Role.CS`). | Explicit domain separation between subscriber and operator. |
| Full CRM customer fields in M3a | **`customers` is a minimal stub only** (`id, name, phone, address, gps_lat, gps_lng, status, created_at, updated_at`). | **Constitution Rule:** No `national_id`, billing, subscription plans, or contracts are allowed. Those belong strictly to **M4 CRM**. |
| `tickets.customer_id` as a strict foreign key | **Bare UUID column (`uuid('customer_id').notNull()`) WITHOUT a DB-level foreign key constraint**. | **PLAN.md M3a Bad Shape Rule:** "`tickets.customer_id` created as a real FK" is explicitly forbidden. Referential integrity is validated at the application/repository level to prevent blocking M4 CRM customer schema refactoring. |
| IP status updated to `ASSIGNED` on ticket completion | **IP status is marked `RESERVED`**; `ip_history.action` is `'RESERVE'`. | **M2b Supply Contract Decision §4:** IP statuses are strictly `FREE` and `RESERVED`. There is no `ASSIGNED` status in `ip_status`. An allocated address is in `RESERVED` status and associated with the customer/ticket in audit metadata. |
| Single photo URL string on `tickets` row | Normalized **`ticket_photos`** one-to-many relationship supporting multiple photos. | Field technicians must be able to upload multiple completion proof photos (e.g. router backplate, optical fiber power meter, outdoor cable entry). |
| Photo upload is optional for all tickets | **`INSTALLATION` tickets cannot reach `COMPLETED` with zero photos** (`400 Bad Request`). For maintenance/complaint, photos are optional. | Enforces SOW §2.1.12 proof-of-work invariant across all caller paths via a centralized service guard. |
| Router, IP, and ticket updates on close run separately | **Single caller-owned database transaction (`tx`)**: closing an `INSTALLATION` ticket updates ticket status, marks router `INSTALLED_AT_CUSTOMER` with customer custody handoff, and marks IP address `RESERVED`. | Atomicity invariant: if any step fails (e.g. router is damaged or IP is already reserved), the entire operation rolls back cleanly. |
| Ticket assignment includes automated workload balancing | Auto-balancing belongs to **M3b (Morning Batch)**. M3a implements **manual assignment** by `CS` / `ADMIN`. | Strict milestone phasing per `PLAN.md` §3 M3a/M3b. |

---

## 3. Scope & Phasing Boundaries

### Deliver in Milestone M3a
1. **Shared Types & Tuples (`packages/types/src/index.ts`)**:
   - `TICKET_TYPES`: `['INSTALLATION', 'TECHNICAL_ISSUE', 'COMPLAINT', 'MAINTENANCE'] as const`
   - `TICKET_PRIORITIES`: `['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const`
   - `TICKET_STATUSES`: `['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const`
   - `CUSTOMER_STATUSES`: `['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const`
2. **Canonical Schema (`apps/api/src/database/schema/index.ts`)**:
   - `customers` (minimal stub table)
   - `tickets` (core service ticket entity)
   - `ticket_status_history` (audit trail for all status transitions)
   - `ticket_photos` (normalized completion photo records)
   - Database migration generated via `drizzle-kit generate`.
3. **5-Layer LMS Repository Layer**:
   - `CustomersRepository`, `TicketsRepository`, `TicketPhotosRepository` extending `BaseRepository`.
   - Registered into `RepositoryService` facade and test mocks.
4. **Tickets Core Service & Controller (`apps/api/src/modules/tickets/`)**:
   - Ticket CRUD, multi-criteria pagination, filtering by `status`, `type`, `priority`, `assignedTechnicianId`, `customerId`, and date ranges.
   - Strict operational lifecycle state machine transitions (`PENDING` $\to$ `ASSIGNED` $\to$ `IN_PROGRESS` $\to$ `COMPLETED` / `CANCELLED`).
   - Reasoned cancellation endpoint (CS and Admin only).
   - Completion photo upload (`POST /tickets/:id/photos`) and centralized validation guard.
   - Transactional close-time handoff to M2b routers and IP pool via caller-owned transaction context (`tx`).
   - CS Customer Satisfaction rating (1–5 stars) on closed tickets.
5. **Customer Stub Module (`apps/api/src/modules/customers/`)**:
   - Minimal CRUD for subscriber stubs (name, phone, address, coordinates, status).
6. **Testing & QA**:
   - 100% Vitest unit and E2E integration test suites running with zero external container dependencies.

### Explicitly Excluded from M3a (Deferred to Later Milestones)
- **M3b**: Automated morning batch clustering, workload balancing algorithm, and suggestion confirmation endpoints.
- **M3c**: Real-time WebSocket GPS tracking gateway and mobile location pings.
- **M4 CRM**: Full subscriber profiles, national IDs, subscription plans, contracts, billing accounts, and invoices.
- **Mobile Client**: React Native mobile screens (deferred to M5).

---

## 4. The Customer Stub Entity (§4.1)

In Milestone M3a, customers exist solely as the recipient target for field tickets, physical GPS locations for technician navigation, and asset holders for installed routers.

### A. Drizzle Schema Definition
```typescript
export const customerStatusEnum = pgEnum('customer_status', CUSTOMER_STATUSES);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).notNull(),
    address: varchar('address', { length: 255 }).notNull(),
    gpsLat: doublePrecision('gps_lat'),
    gpsLng: doublePrecision('gps_lng'),
    status: customerStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_customers_status').on(table.status),
    index('idx_customers_phone').on(table.phone),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
```

### B. Constitution Invariants
1. `name`, `phone`, and `address` are strictly mandatory (`notNull()`).
2. **Prohibited Fields (M4 CRM Boundary)**: The table must **NOT** contain `national_id`, `subscription_plan`, `billing_account_id`, `contract_start`, or pricing fields. Adding any of these violates `PLAN.md` M3a Bad Shape rules.
3. Soft delete: Inactive customers are marked with `status = 'INACTIVE'` or `'SUSPENDED'`; rows are never hard deleted.

---

## 5. The Ticket Domain & Operational Lifecycle

### 5.1 Canonical Schema: `tickets` & `ticket_status_history`

```typescript
export const ticketTypeEnum = pgEnum('ticket_type', TICKET_TYPES);
export const ticketPriorityEnum = pgEnum('ticket_priority', TICKET_PRIORITIES);
export const ticketStatusEnum = pgEnum('ticket_status', TICKET_STATUSES);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketNumber: varchar('ticket_number', { length: 50 }).notNull().unique(),
    // Bare UUID: No DB-level FK constraint (PLAN.md M3a Bad Shape Rule).
    customerId: uuid('customer_id').notNull(),
    type: ticketTypeEnum('type').notNull(),
    priority: ticketPriorityEnum('priority').default('MEDIUM').notNull(),
    status: ticketStatusEnum('status').default('PENDING').notNull(),
    description: text('description').notNull(),
    assignedTechnicianId: uuid('assigned_technician_id').references(() => users.id),
    assignedRouterId: uuid('assigned_router_id').references(() => routers.id),
    assignedIpId: uuid('assigned_ip_id').references(() => ipAddresses.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    cancelledBy: uuid('cancelled_by').references(() => users.id),
    customerRating: integer('customer_rating'), // 1 to 5 stars
    ratingFeedback: text('rating_feedback'),
    ratedBy: uuid('rated_by').references(() => users.id),
    ratedAt: timestamp('rated_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_tickets_number').on(table.ticketNumber),
    index('idx_tickets_customer').on(table.customerId),
    index('idx_tickets_status').on(table.status),
    index('idx_tickets_technician').on(table.assignedTechnicianId),
    index('idx_tickets_type').on(table.type),
    index('idx_tickets_created_at').on(table.createdAt),
  ],
);

export const ticketStatusHistory = pgTable(
  'ticket_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .references(() => tickets.id, { onDelete: 'cascade' })
      .notNull(),
    fromStatus: ticketStatusEnum('from_status').notNull(),
    toStatus: ticketStatusEnum('to_status').notNull(),
    changedBy: uuid('changed_by').references(() => users.id).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ticket_status_history_ticket').on(table.ticketId),
    index('idx_ticket_status_history_created').on(table.createdAt),
  ],
);
```

### 5.2 State Machine Diagram

```
                 ┌───────────────┐
                 │    PENDING    │◄─────────────────┐
                 └───────┬───────┘                  │
                         │ Assign                   │ Reassign / Unassign
                         ▼                          │
                 ┌───────────────┐                  │
                 │   ASSIGNED    ├──────────────────┘
                 └───────┬───────┘
                         │ Start (Tech Arrival)
                         ▼
                 ┌───────────────┐
                 │  IN_PROGRESS  │
                 └───────┬───────┘
                         │ Complete (Finished + Proof Photos Verified + M2b Handoff)
                         ▼
                 ┌───────────────┐
                 │   COMPLETED   │ (Terminal)
                 └───────────────┘

   [From PENDING, ASSIGNED, or IN_PROGRESS]
        ──► CANCELLED (Terminal, Mandatory CS/Admin Reason)
```

### 5.3 Status Transition Whitelist

| From Status | Allowed Destination Statuses | Authorized Roles | Requirements & Transaction Invariants |
| :--- | :--- | :--- | :--- |
| `PENDING` | `ASSIGNED` | `ADMIN`, `CS` | Requires valid `assignedTechnicianId`. Sets `assignedAt = now()`. |
| `PENDING` | `CANCELLED` | `ADMIN`, `CS` | Requires mandatory non-blank `reason`. Sets `cancelledAt = now()`, `cancelledBy = currentUser.id`. |
| `ASSIGNED` | `IN_PROGRESS` | `TECHNICIAN`, `ADMIN` | Technician marks arrival at customer site. Sets `startedAt = now()`. Technician ownership guard enforced. |
| `ASSIGNED` | `PENDING` | `ADMIN`, `CS` | Unassigns technician. Clears `assignedTechnicianId` and `assignedAt`. |
| `ASSIGNED` | `CANCELLED` | `ADMIN`, `CS` | Requires mandatory non-blank `reason`. Releases reserved hardware/IP if assigned. |
| `IN_PROGRESS` | `COMPLETED` | `TECHNICIAN`, `ADMIN` | Sets `completedAt = now()`. **If INSTALLATION:** requires $\ge 1$ completion photo + atomic router & IP handoff in shared `tx`. |
| `IN_PROGRESS` | `CANCELLED` | `ADMIN`, `CS` | Requires mandatory non-blank `reason`. Releases reserved hardware/IP. |
| `COMPLETED` | *None* | — | **Terminal state.** No transitions allowed (`400 Bad Request`). |
| `CANCELLED` | *None* | — | **Terminal state.** No transitions allowed (`400 Bad Request`). |

### 5.4 Transition Invariants
1. **Strict Whitelist (No Skipped Steps)**: Attempting `PENDING` $\to$ `COMPLETED` or `PENDING` $\to$ `IN_PROGRESS` returns `400 Bad Request`.
2. **Technician Ownership Guard**: A `TECHNICIAN` can only transition tickets where `assignedTechnicianId === currentUser.userId`. Attempting to start or complete another technician's ticket returns `403 Forbidden`.
3. **Mandatory Audit Logging**: Every status transition appends a record to `ticket_status_history` capturing `fromStatus`, `toStatus`, `changedBy`, `reason`, and `createdAt` in the exact same database transaction.
4. **Ticket Identifier Generation**: Formatted as `TCK-YYYYMMDD-XXXX` (e.g. `TCK-20261105-0001`), generated deterministically using a date-prefixed collision-free sequence or transaction lock.

---

## 6. Completion Proof & Mandatory Photo Rules

Per SOW §2.1.12 and CRM SRS §3:

### A. Schema: `ticket_photos`
```typescript
export const ticketPhotos = pgTable(
  'ticket_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .references(() => tickets.id, { onDelete: 'cascade' })
      .notNull(),
    photoUrl: text('photo_url').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    sizeBytes: integer('size_bytes'),
    uploadedBy: uuid('uploaded_by')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ticket_photos_ticket').on(table.ticketId),
  ],
);

export type TicketPhoto = typeof ticketPhotos.$inferSelect;
export type NewTicketPhoto = typeof ticketPhotos.$inferInsert;
```

### B. Centralized Validation Guard Invariant
- **Single Source of Truth**: The photo requirement is enforced exclusively inside `TicketsService.complete()`, guaranteeing that no caller (REST controller, future mobile app, or admin override) can bypass it:
  ```typescript
  if (ticket.type === 'INSTALLATION') {
    const photoCount = await this.repo.ticketPhotos.countByTicketId(ticket.id, tx);
    if (photoCount === 0) {
      throw new BadRequestException({
        code: 'PHOTO_REQUIRED_FOR_INSTALLATION',
        message: 'Installation tickets require at least one completion photo proof before closure',
      });
    }
  }
  ```
- **Other Ticket Types (`TECHNICAL_ISSUE`, `COMPLAINT`, `MAINTENANCE`)**: Photos are optional.
- **Upload Endpoint**: `POST /tickets/:id/photos` accepts `multipart/form-data`, enforces a 5MB maximum file size, validates JPEG/PNG MIME types, and uploads via `StorageService`.

---

## 7. Transactional Close-Time Integration with M2b (Supply Chain)

When an **`INSTALLATION`** ticket transitions to `COMPLETED`, hardware and IP assignments commit in the exact same database transaction:

```
┌────────────────────────────────────────────────────────────────────────┐
│               Single Atomic Database Transaction (tx)                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. tickets.update: status = 'COMPLETED', completedAt = now()           │
│ 2. ticket_status_history.insert: from IN_PROGRESS to COMPLETED         │
│ 3. routers.transition (via RoutersService with tx):                    │
│    - Status: INSTALLED_AT_CUSTOMER                                     │
│    - Close active technician custody: releasedAt = now()               │
│    - Open customer custody: holderType = 'CUSTOMER', notes = ticketNum │
│    - Clear physical warehouse location: warehouseId = null             │
│ 4. ip_addresses.reserve (via IpService with tx):                       │
│    - Status remains/becomes: RESERVED                                  │
│    - Record customer/ticket linkage in notes or audit metadata         │
│    - ip_history.insert: action = 'RESERVE', toStatus = 'RESERVED'      │
└────────────────────────────────────────────────────────────────────────┘
```

### Seam Implementation Rules:
1. `RoutersService.transition(id, dto, { tx, actorId })`: Accepts the caller-owned transaction `tx`. If the router is not in `ASSIGNED_TO_TECHNICIAN` status or is physically damaged, it throws an error and rolls back the entire ticket completion transaction.
2. `IpService.reserve(id, dto, { tx, actorId })`: Validates that the IP is eligible and commits the reservation under `tx`.
3. If either the router or IP operation fails, the ticket remains in `IN_PROGRESS` status with zero orphaned mutations.

---

## 8. Customer Satisfaction Rating (§8)

Customer feedback is collected post-completion by customer service:
- **Eligible Status**: Only tickets in `COMPLETED` status can be rated. Attempting to rate a `PENDING`, `ASSIGNED`, `IN_PROGRESS`, or `CANCELLED` ticket throws `400 Bad Request` (`TICKET_NOT_COMPLETED`).
- **Rating Range**: Integer from **1 to 5** inclusive. Validated via class-validator `@IsInt()`, `@Min(1)`, `@Max(5)`.
- **Role Permission**: Allowed for `ADMIN` and `CS`. Technicians are strictly forbidden (`403 Forbidden`) from submitting ratings on their own tasks.
- **Payload**:
  ```typescript
  export class SubmitTicketRatingDto {
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsOptional()
    @IsString()
    feedback?: string;
  }
  ```

---

## 9. RBAC & Route Matrix

Base Route: `/tickets`  
Guards: `JwtAuthGuard`, `RolesGuard`

| Method | Path | Description | Allowed Roles | Success Code | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/tickets` | Create a new service ticket | `ADMIN`, `CS` | `201 Created` | `400`, `401`, `403` |
| `GET` | `/tickets` | List tickets with filters & pagination | `ADMIN`, `CS`, `TECHNICIAN` | `200 OK` | `400`, `401`, `403` |
| `GET` | `/tickets/:id` | Get ticket details, history & photos | `ADMIN`, `CS`, `TECHNICIAN` | `200 OK` | `400`, `401`, `403`, `404` |
| `POST` | `/tickets/:id/assign` | Manually assign technician | `ADMIN`, `CS` | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `POST` | `/tickets/:id/start` | Technician marks arrival / starts work | `TECHNICIAN`, `ADMIN` | `200 OK` | `400`, `401`, `403`, `404` |
| `POST` | `/tickets/:id/complete` | Complete ticket (validates photos & M2b) | `TECHNICIAN`, `ADMIN` | `200 OK` | `400`, `401`, `403`, `404` |
| `POST` | `/tickets/:id/cancel` | Cancel ticket with mandatory reason | `ADMIN`, `CS` | `200 OK` | `400`, `401`, `403`, `404` |
| `POST` | `/tickets/:id/photos` | Upload completion proof photo | `TECHNICIAN`, `ADMIN` | `201 Created` | `400`, `401`, `403`, `404` |
| `POST` | `/tickets/:id/rating` | Record customer satisfaction rating (1-5) | `ADMIN`, `CS` | `200 OK` | `400`, `401`, `403`, `404` |

*Note for `TECHNICIAN`: `GET /tickets` automatically scopes results to tickets where `assignedTechnicianId === currentUser.userId` unless called by an Admin or CS.*

---

## 10. The 5-Layer LMS Architecture Blueprint

```
┌─────────────────────────────────────────────────────────────┐
│                      TicketsController                      │
│  - REST routing (/tickets/*)                                │
│  - RolesGuard RBAC (ADMIN, CS, TECHNICIAN)                  │
│  - Swagger OpenAPI decorators                               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       TicketsService                        │
│  - Whitelist state machine transitions                      │
│  - Centralized photo completion guard                       │
│  - Transactional closure with RoutersService & IpService    │
│  - Injects ONLY RepositoryService (+ Storage/Routers/Ip)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Injects single facade:
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 RepositoryService (Facade)                  │
│  - Central facade: this.repo.tickets, this.repo.customers   │
│  - Atomic transactions: this.repo.transaction(tx => ...)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Delegates to:
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      TicketsRepository                      │
│  - Pure Drizzle ORM queries on tickets, history, & photos   │
│  - Multi-field filtering (status, technician, customer)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Extends:
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   BaseRepository<Ticket, NewTicket, typeof tickets>         │
│  - Generic CRUD: findAll, findById, create, update, delete  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Injects:
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  @Inject(DRIZZLE) db                        │
│  - NodePgDatabase<typeof schema> (PostgreSQL Pool)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Testing & Quality Assurance Contract

Every module in M3a must provide both unit and end-to-end integration tests conforming to existing M2b standards:

1. **Unit Tests (`src/modules/tickets/tickets.service.spec.ts`)**:
   - Verify state machine transitions along the approved whitelist.
   - Reject illegal transitions with `400 Bad Request`.
   - Enforce $\ge 1$ photo requirement on `INSTALLATION` tickets and allow closure without photos on `MAINTENANCE`.
   - Verify caller-owned transaction execution on close and rollback on injected failure.
   - Require mandatory non-blank reason for cancellation.
   - Verify 1–5 star rating validation and reject ratings on uncompleted tickets.
2. **Integration (E2E) Test Suite (`test/tickets.e2e-spec.ts`)**:
   - RBAC enforcement (Technicians cannot cancel, CS cannot complete, unauthorized roles return 403).
   - End-to-end workflow: `Create (CS)` $\to$ `Assign (CS)` $\to$ `Start (Tech)` $\to$ `Upload Photo (Tech)` $\to$ `Complete (Tech)` $\to$ `Rate (CS)`.
   - In-memory mock stores with zero external container requirements.

---

## 12. Technical Freeze Checklist (Aligned with Master Plan)

The following concrete technical points are frozen for implementation:

1. **Ticket Number Format**:
   - Formatted as `TCK-YYYYMMDD-XXXX` (e.g. `TCK-20261105-0001`), generated deterministically.
2. **Customer Linkage**:
   - `tickets.customer_id` is a bare UUID column (`uuid('customer_id').notNull()`) with an index, strictly avoiding a database-level foreign key to prevent blocking M4 CRM schema refactoring.
3. **Asset Associations on Ticket**:
   - `assigned_router_id` (nullable UUID referencing `routers.id`) and `assigned_ip_id` (nullable UUID referencing `ip_addresses.id`) are stored on the `tickets` table upon assignment, allowing atomic verification and locking during closure.
4. **Photo Storage Provider**:
   - Reuses `StorageService` (`StorageModule`) supporting Cloudinary and local disk / in-memory test mocks. Photos are uploaded via `multipart/form-data` with a 5MB limit and JPEG/PNG MIME validation.
5. **IP Pool Allocation Status**:
   - IP status on ticket completion is confirmed as `RESERVED` with customer identification recorded in audit history (`action: 'RESERVE'`).
