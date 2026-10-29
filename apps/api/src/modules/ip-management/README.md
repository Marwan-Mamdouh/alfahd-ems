# 🌐 IpModule (IPv4 Pool Management & Allocation Ledger)

**Path:** `apps/api/src/modules/ip-management`  
**Architecture:** 5-Layer LMS Facade Repository Pattern  
**Status:** Milestone M2b Complete (100% Type-Safe, Pure Drizzle ORM, Vitest Unit + E2E Green)

---

## 1. Overview & Business Scope

Derived from **SOW Section 2.1.6, Milestone M2b Specification**, and [`docs/contracts/m2b-supply-implementation.md`](file:///E:/alfahd-ems/docs/contracts/m2b-supply-implementation.md):

- **Individual IPv4 Host Address Management:** Tracks individual public/private IPv4 host addresses for subscriber internet allocations.
- **Strict IPv4 Validation:** Only valid individual IPv4 host addresses are allowed. Subnet ranges (CIDR `/24`), IP ranges (`-`), and IPv6 addresses are strictly rejected with 400 Bad Request.
- **Simplified Dual-State Lifecycle:**
  - **`FREE`**: Available for customer assignment or manual reservation.
  - **`RESERVED`**: In use or set aside for VIP/infrastructure needs.
  - _(Note: Customer CRUD and ticket allocations are intentionally deferred to M3a/M4 per the implementation contract)._
- **Soft Decommissioning (`isArchived`):**
  - Addresses can be decommissioned from circulation by setting `isArchived: true`.
  - _Invariant:_ A `RESERVED` IP cannot be archived directly (must be released back to `FREE` first).
  - _Invariant:_ An archived IP cannot be reserved.
- **Immutable Mutation Audit Ledger (`ip_history`):**
  - Every mutation automatically records an entry in `ip_history` tracking `fromStatus`, `toStatus`, `action`, `reason`, `actorId`, and timestamp.
  - Supported actions: `CREATE`, `RESERVE`, `RELEASE`, `ARCHIVE`, `UNARCHIVE`, `UPDATE_METADATA`.
- **Duplicate-Tolerant CSV Bulk Import:**
  - Administrators can upload CSV files containing `address,notes` columns.
  - Parser skips intra-file duplicate rows and already-existing database entries without failing the batch.
  - Returns an execution summary: `{ total, inserted, skipped, errors }`.

---

## 2. Architecture & The LMS 5-Layer Pattern

```
┌──────────────────────────────────────────────────────────┐
│                      IpController                        │
│  - REST HTTP endpoints (/ip-addresses/*)                 │
│  - Multipart CSV file interceptor                        │
│  - RolesGuard RBAC (ADMIN, TECHNICIAN)                   │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                       IpService                          │
│  - IPv4 validation & duplicate checks                    │
│  - Reservation, release, and archive guards              │
│  - CSV parsing, deduplication, and atomic history audit  │
│  - Injects ONLY RepositoryService                        │
└────────────────────────────┬─────────────────────────────┘
                             │ Injects single facade:
                             ▼
┌──────────────────────────────────────────────────────────┐
│               RepositoryService (Facade)                 │
│  - Centralized injection facade: this.repo.ip            │
│  - Atomic transactions: this.repo.transaction(tx => ...) │
└────────────────────────────┬─────────────────────────────┘
                             │ Delegates calls to:
                             ▼
┌──────────────────────────────────────────────────────────┐
│                      IpRepository                        │
│  - Pure Drizzle ORM operations on ipAddresses & history  │
│  - Pagination, case-insensitive address lookup           │
└────────────────────────────┬─────────────────────────────┘
                             │ Extends:
                             ▼
┌──────────────────────────────────────────────────────────┐
│    BaseRepository<IpAddress, NewIpAddress, ipAddresses>  │
│  - Generic CRUD: findAll, findById, create, deleteById   │
└────────────────────────────┬─────────────────────────────┘
                             │ Injects:
                             ▼
┌──────────────────────────────────────────────────────────┐
│                @Inject(DRIZZLE) db                       │
│  - NodePgDatabase<typeof schema> (PostgreSQL Pool)       │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Database Layer (`ip.repository.ts`)

### A. Schemas & Tables (`src/database/schema/index.ts`)

- **`ip_addresses`**:
  - `id`: UUID primary key
  - `address`: PostgreSQL `inet` column type, unique, not null
  - `status`: `ip_status` enum (`FREE`, `RESERVED`), default `FREE`
  - `isArchived`: Boolean, default `false`
  - `customerId`: Nullable UUID (deferred to M3a)
  - `notes`: TEXT
  - `createdAt` / `updatedAt`: Timestamps
- **`ip_history`**:
  - `id`: UUID primary key
  - `ipId`: UUID foreign key referencing `ip_addresses.id`
  - `fromStatus` / `toStatus`: `ip_status` enums
  - `action`: `ip_history_action` enum (`CREATE`, `RESERVE`, `RELEASE`, `ARCHIVE`, `UNARCHIVE`, `UPDATE_METADATA`)
  - `reason`: TEXT
  - `actorId`: UUID foreign key referencing `users.id`
  - `createdAt`: Timestamp

### B. `IpRepository` Methods

- `findByAddress(address, tx?)`: Case-insensitive trimmed IP lookup.
- `findManyWithPagination(params)`: Filters by status, `isArchived`, address search, and pagination.
- `createIp(data, tx?)` / `updateIp(id, updates, tx?)`: Drizzle entity insertion and modification.
- `createHistory(data, tx?)`: Appends mutation audit row to `ip_history`.
- `findHistoryByIp(ipId)`: Retrieves chronological history audit trail for an address.

---

## 4. Service Layer (`ip.service.ts`)

Orchestrates business logic and transactional integrity:

- **`create(dto: CreateIpDto, actorId)`**:
  - Validates individual IPv4 host format (rejects CIDR ranges and IPv6).
  - Checks address uniqueness (throws `ConflictException` 409).
  - Atomically creates IP with status `FREE` and logs `CREATE` history.
- **`reserve(id, reason, actorId)`**:
  - Guard: Rejects archived IPs with 400 Bad Request.
  - Guard: Rejects already reserved IPs with 409 Conflict.
  - Updates status to `RESERVED` and logs `RESERVE` history.
- **`release(id, reason, actorId)`**:
  - Guard: Rejects already free IPs with 409 Conflict.
  - Resets status to `FREE`, clears `customerId`, and logs `RELEASE` history.
- **`archive(id, reason, actorId)`**:
  - Guard: Rejects `RESERVED` IPs with 409 Conflict (must release first).
  - Idempotent: If already archived, returns immediately.
  - Sets `isArchived: true` and logs `ARCHIVE` history.
- **`unarchive(id, reason, actorId)`**:
  - Idempotent: If not archived, returns immediately.
  - Sets `isArchived: false` and logs `UNARCHIVE` history.
- **`update(id, dto: UpdateIpDto, actorId)`**:
  - Updates metadata notes and logs `UPDATE_METADATA` history.
- **`getHistory(ipId)`**:
  - Returns formatted audit timeline.
- **`importCsv(csvContent, actorId)`**:
  - Validates presence of `address` column header.
  - Skips duplicate rows in the CSV and IPs already present in the database.
  - Records line-by-line format error summaries without aborting the batch.
  - Commits valid addresses with `CREATE` history records.

---

## 5. Controller Layer & API Reference (`ip.controller.ts`)

All routes dynamically consume the centralized route constants manifest (`src/common/constants/routes.constants.ts`):

- Controller: `@Controller(routes.ip.root)`
- Routes: `@Get(routes.ip.id)`, `@Patch(routes.ip.id)`, `@Post(routes.ip.reserve)`, `@Post(routes.ip.release)`, `@Post(routes.ip.archive)`, `@Post(routes.ip.unarchive)`, `@Get(routes.ip.history)`, `@Post(routes.ip.import)`

Base Route: `/ip-addresses`  
Guards: `JwtAuthGuard`, `RolesGuard`

| HTTP Method | Route                         | Description                                 | Allowed Roles         | Request Body / Query           | Success Response               | Errors              |
| :---------- | :---------------------------- | :------------------------------------------ | :-------------------- | :----------------------------- | :----------------------------- | :------------------ |
| `POST`      | `/ip-addresses`               | Register an individual IPv4 address         | `ADMIN`               | `CreateIpDto`                  | `201 Created` (`IpAddressDto`) | `400`, `409`        |
| `GET`       | `/ip-addresses`               | List IP addresses with filters & pagination | `ADMIN`, `TECHNICIAN` | `IpQueryDto`                   | `200 OK` (`{ items, total }`)  | `400`               |
| `GET`       | `/ip-addresses/:id`           | Get details of an IP address                | `ADMIN`, `TECHNICIAN` | None                           | `200 OK` (`IpAddressDto`)      | `400`, `404`        |
| `PATCH`     | `/ip-addresses/:id`           | Update metadata notes                       | `ADMIN`               | `UpdateIpDto`                  | `200 OK` (`IpAddressDto`)      | `400`, `404`        |
| `POST`      | `/ip-addresses/:id/reserve`   | Mark FREE IP as RESERVED                    | `ADMIN`               | `{ reason?: string }`          | `200 OK` (`IpAddressDto`)      | `400`, `404`, `409` |
| `POST`      | `/ip-addresses/:id/release`   | Release RESERVED IP back to FREE            | `ADMIN`               | `{ reason?: string }`          | `200 OK` (`IpAddressDto`)      | `400`, `404`, `409` |
| `POST`      | `/ip-addresses/:id/archive`   | Archive FREE IP from allocation             | `ADMIN`               | `{ reason?: string }`          | `200 OK` (`IpAddressDto`)      | `400`, `404`, `409` |
| `POST`      | `/ip-addresses/:id/unarchive` | Unarchive IP back to active pool            | `ADMIN`               | `{ reason?: string }`          | `200 OK` (`IpAddressDto`)      | `400`, `404`        |
| `GET`       | `/ip-addresses/:id/history`   | Get full mutation audit history             | `ADMIN`               | None                           | `200 OK` (`IpHistoryDto[]`)    | `400`, `404`        |
| `POST`      | `/ip-addresses/import`        | Bulk import addresses from CSV file         | `ADMIN`               | `multipart/form-data` (`file`) | `200 OK` (`IpImportResultDto`) | `400`, `403`        |

---

## 6. Testing & Quality Assurance

- **Unit Tests**:
  - [`ip.service.spec.ts`](file:///e:/alfahd-ems/apps/api/src/modules/ip-management/ip.service.spec.ts) (25 tests): Validates host address constraints (CIDR/IPv6 rejection), duplicate handling, reservation/release transitions, archival guards, and CSV row-level error parsing.
  - [`ip.controller.spec.ts`](file:///e:/alfahd-ems/apps/api/src/modules/ip-management/ip.controller.spec.ts) (12 tests): Verifies HTTP delegation, role guards, and multipart file buffer extraction.

- **Integration & E2E Test Suite**:
  - [`test/ip.e2e-spec.ts`](file:///e:/alfahd-ems/apps/api/test/ip.e2e-spec.ts) (**25 test cases** across 7 testing suites):

  #### Suite 1: Authentication & RBAC (7 tests)
  1. `401 Unauthorized` — Rejects unauthenticated requests lacking a Bearer JWT token.
  2. `200 OK` — Allows `TECHNICIAN` to list and filter IP addresses.
  3. `200 OK` — Allows `TECHNICIAN` to read individual IP address details by ID.
  4. `403 Forbidden` — Blocks `TECHNICIAN` from creating new IP host records.
  5. `403 Forbidden` — Blocks `CS` (Customer Support) from viewing the IP address catalog.
  6. `403 Forbidden` — Blocks `WAREHOUSE_STAFF` from reserving IP addresses.
  7. `201 Created` — Allows `ADMIN` to register a new IP address.

  #### Suite 2: IPv4 Validation & Invariants (4 tests)
  8. `400 Bad Request` — Rejects CIDR subnet range notation (e.g. `10.0.0.0/24`).
  9. `400 Bad Request` — Rejects IPv6 addresses (e.g. `2001:db8::1`).
  10. `400 Bad Request` — Rejects malformed IP addresses (e.g. `999.999.999.999`).
  11. `409 Conflict` — Rejects registration when the IP address already exists.

  #### Suite 3: Reservation & Release Lifecycle (5 tests)
  12. `200 OK` — Allows `ADMIN` to reserve an unallocated `FREE` IP address.
  13. `409 Conflict` — Blocks reservation when IP is already in `RESERVED` status.
  14. `400 Bad Request` — Blocks reserving an archived IP (`isArchived: true`).
  15. `200 OK` — Allows `ADMIN` to release a `RESERVED` IP address back to `FREE`.
  16. `409 Conflict` — Blocks releasing an IP that is already in `FREE` status.

  #### Suite 4: Archive & Decommission Constraints (3 tests)
  17. `409 Conflict` — Blocks archiving a `RESERVED` IP address (must be released to `FREE` first).
  18. `200 OK` — Decommissions a `FREE` IP address by marking it `isArchived: true`.
  19. `200 OK` — Restores an archived IP address back into active circulation.

  #### Suite 5: Metadata & History Ledger (2 tests)
  20. `200 OK` — Updates IP metadata notes without mutating its allocation state.
  21. `200 OK` — Retrieves chronological mutation audit history records for an IP address.

  #### Suite 6: CSV Bulk Import (2 tests)
  22. `403 Forbidden` — Blocks non-ADMIN roles (`TECHNICIAN`) from uploading CSV import batches.
  23. `200 OK` — Parses multipart CSV file, commits valid host addresses, skips intra-file duplicates and existing records, and returns execution summary.

  #### Suite 7: Edge Cases & Route Guarding (2 tests)
  24. `404 Not Found` — Returns not found when accessing a non-existent IP UUID.
  25. `400 Bad Request` — Rejects malformed / non-UUID route parameters.
