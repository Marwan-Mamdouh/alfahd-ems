# Data Model: M1 Foundation

## Entities

### `users`
Core entity representing system actors.

**Fields**:
- `id`: UUID (Primary Key)
- `email`: VARCHAR (Unique)
- `password_hash`: VARCHAR
- `role`: ENUM ('ADMIN', 'WAREHOUSE_STAFF', 'CS', 'TECHNICIAN')
- `is_active`: BOOLEAN (Default: true) - Ensures no hard deletes per constitution.
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**Validation Rules**:
- Email must be valid and unique.
- Role must be one of the defined ENUM values.

**State Transitions**:
- Can be deactivated (`is_active` = false). Cannot be hard deleted.

### `warehouses` (stub)
Foundation for future inventory/supply chain modules.

**Fields**:
- `id`: UUID (Primary Key)
- `name`: VARCHAR
- `is_active`: BOOLEAN (Default: true) — Required by Constitution Principle IV (soft-delete everywhere, no exceptions).
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### `sessions` (Redis Key-Value)
Ephemeral entities managed via Redis representing active user logins.

**Key Pattern**: `rt:{userId}:{tokenId}`
**Value**: User session metadata (or empty if existence implies validity).
**TTL**: 7 days (604800 seconds).

**State Transitions**:
- Created on login.
- Validated on token refresh.
- Deleted (revoked) on logout, manual Admin revocation, or token expiration.
