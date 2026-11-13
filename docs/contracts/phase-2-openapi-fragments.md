# Phase 2 OpenAPI fragments — review draft

These **OpenAPI 3.0.3 fragments**, not a complete standalone document or generated Swagger snapshot, describe baseline `97bcd31` from controllers, DTOs, database schema and response interceptor. Path blocks must be embedded under `paths` in a document that defines bearer authentication and the included components. The [standalone review snapshot](phase-2-openapi.json) covers the full action matrix; the [wire catalog](phase-2-wire-contracts.md) adds validation and examples. Future attendance, lookup and product-deactivation routes in [the proposal](phase-2-proposed-contracts.md) are not implemented and are deliberately excluded. Synthetic examples are not live HTTP evidence.

All six operations require a bearer access token. `x-roles` documents server authorization, not a standard OpenAPI security scheme. Common responses: 400 for malformed UUID/query, 401 for missing/invalid token and 403 for an unauthorized role. Error bodies follow the global filter envelope in the handoff. Check service behavior rather than assuming every valid but unknown history ID produces 404.

```yaml
/inventory/movements:
  get:
    summary: List stock movements
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN, WAREHOUSE_STAFF]
    parameters:
      - { name: warehouseId, in: query, schema: { type: string, format: uuid } }
      - { name: productId, in: query, schema: { type: string, format: uuid } }
      - { name: technicianId, in: query, schema: { type: string, format: uuid } }
      - name: movementType
        in: query
        schema: { type: string, enum: [INBOUND_SUPPLIER, OUTBOUND_TECHNICIAN, RETURN_TECHNICIAN, TRANSFER_WAREHOUSE, ADJUSTMENT] }
      - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
      - { name: offset, in: query, schema: { type: integer, minimum: 0, default: 0 } }
    responses:
      '200':
        description: Paginated movement records and total before pagination
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data:
                  type: object
                  required: [items, total]
                  properties:
                    items:
                      type: array
                      items: { $ref: '#/components/schemas/StockMovement' }
                    total: { type: integer, minimum: 0 }
      '400': { description: Invalid query }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
/inventory/movements/{id}:
  get:
    summary: Get one stock movement
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN, WAREHOUSE_STAFF]
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    responses:
      '200':
        description: Movement record
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data: { $ref: '#/components/schemas/StockMovement' }
      '400': { description: Invalid UUID }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
      '404': { description: Movement not found }
/routers/{id}/assignments:
  get:
    summary: List router custody assignments
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN, WAREHOUSE_STAFF]
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    responses:
      '200':
        description: Unpaginated assignment history
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data: { type: array, items: { $ref: '#/components/schemas/RouterAssignment' } }
      '400': { description: Invalid UUID }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
/routers/{id}/condition-history:
  get:
    summary: List router physical-condition history
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN, WAREHOUSE_STAFF]
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    responses:
      '200':
        description: Unpaginated condition history
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data: { type: array, items: { $ref: '#/components/schemas/RouterConditionHistory' } }
      '400': { description: Invalid UUID }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
/routers/{id}/status-history:
  get:
    summary: List router lifecycle history
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN, WAREHOUSE_STAFF]
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    responses:
      '200':
        description: Unpaginated status history
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data: { type: array, items: { $ref: '#/components/schemas/RouterStatusHistory' } }
      '400': { description: Invalid UUID }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
/ip-addresses/{id}/history:
  get:
    summary: List IP mutation history
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN]
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    responses:
      '200':
        description: Unpaginated IP history
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data: { type: array, items: { $ref: '#/components/schemas/IpHistory' } }
      '400': { description: Invalid UUID }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
```

The following components accompany those fragments. `createdAt`, `assignedAt` and `releasedAt` serialize as ISO date-time strings. All examples use synthetic identifiers. The condition/status enum values are intentionally represented as strings here; use `packages/types/src/index.ts` for the complete allowed values, not these fragments as a validator for mutation inputs.

```yaml
StockMovement:
  type: object
  required: [id, productId, warehouseId, movementType, quantity, supplierName, technicianId, responsibleUserId, notes, createdAt]
  properties:
    id: { type: string, format: uuid }
    productId: { type: string, format: uuid }
    warehouseId: { type: string, format: uuid }
    movementType: { type: string }
    quantity: { type: integer, description: Recorded quantity; adjustment deltas may be negative or zero }
    supplierName: { type: string, nullable: true }
    technicianId: { type: string, format: uuid, nullable: true }
    responsibleUserId: { type: string, format: uuid }
    notes: { type: string, nullable: true }
    createdAt: { type: string, format: date-time }
RouterAssignment:
  type: object
  required: [id, routerId, holderType, warehouseId, technicianId, assignedAt, releasedAt, assignedBy, notes]
  properties:
    id: { type: string, format: uuid }
    routerId: { type: string, format: uuid }
    holderType: { type: string }
    warehouseId: { type: string, format: uuid, nullable: true }
    technicianId: { type: string, format: uuid, nullable: true }
    assignedAt: { type: string, format: date-time }
    releasedAt: { type: string, format: date-time, nullable: true }
    assignedBy: { type: string, format: uuid }
    notes: { type: string, nullable: true }
RouterConditionHistory:
  type: object
  required: [id, routerId, fromCondition, toCondition, fromWarehouseId, toWarehouseId, externalLocation, reason, changedBy, createdAt]
  properties:
    id: { type: string, format: uuid }
    routerId: { type: string, format: uuid }
    fromCondition: { type: string }
    toCondition: { type: string }
    fromWarehouseId: { type: string, format: uuid, nullable: true }
    toWarehouseId: { type: string, format: uuid, nullable: true }
    externalLocation: { type: string, nullable: true }
    reason: { type: string }
    changedBy: { type: string, format: uuid }
    createdAt: { type: string, format: date-time }
RouterStatusHistory:
  type: object
  required: [id, routerId, fromStatus, toStatus, reason, changedBy, createdAt]
  properties:
    id: { type: string, format: uuid }
    routerId: { type: string, format: uuid }
    fromStatus: { type: string }
    toStatus: { type: string }
    reason: { type: string }
    changedBy: { type: string, format: uuid }
    createdAt: { type: string, format: date-time }
IpHistory:
  type: object
  required: [id, ipId, fromStatus, toStatus, action, reason, actorId, createdAt]
  properties:
    id: { type: string, format: uuid }
    ipId: { type: string, format: uuid }
    fromStatus: { type: string, enum: [FREE, RESERVED] }
    toStatus: { type: string, enum: [FREE, RESERVED] }
    action: { type: string, enum: [CREATE, RESERVE, RELEASE, ARCHIVE, UNARCHIVE, UPDATE_METADATA] }
    reason: { type: string, nullable: true }
    metadataBefore: { type: object, nullable: true, additionalProperties: true }
    metadataAfter: { type: object, nullable: true, additionalProperties: true }
    actorId: { type: string, format: uuid }
    createdAt: { type: string, format: date-time }
```

Each audit history response can be empty: `{"data":[]}`. The stock-list example and individual movement fields are illustrated by the inbound movement in the [wire catalog](phase-2-wire-contracts.md#products-and-inventory-implemented). The typed fixtures in `apps/web/src/phase2-handoff/fixtures.ts` demonstrate independent loading/error/empty states, not network implementation.

## Multipart uploads, job polling and binary download

The following path block can be combined with the history block under `paths`. File size limits are enforced in the application at 5 MiB. Oversize multipart uploads are normalized to HTTP 400 by the global exception filter. Job access is restricted to the requester or ADMIN by the service, independently of authentication; unauthorized job IDs return 404. A direct provider URL in a completed job is distinct from the protected local download path.

```yaml
/employees/{id}/photo:
  post:
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN]
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    requestBody:
      required: true
      content:
        multipart/form-data:
          schema:
            type: object
            required: [file]
            properties:
              file: { type: string, format: binary, description: JPEG or PNG; maximum 5 MiB }
    responses:
      '200':
        description: Stored photo identifier and upload URL
        content:
          application/json:
            schema:
              type: object
              required: [data]
              properties:
                data:
                  type: object
                  required: [profilePhotoKey, url]
                  properties:
                    profilePhotoKey: { type: string }
                    url: { type: string }
      '400': { description: Invalid UUID, file, image type or size }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
      '404': { description: Employee not found }
/ip-addresses/import:
  post:
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN]
    requestBody:
      required: true
      content:
        multipart/form-data:
          schema:
            type: object
            required: [file]
            properties:
              file: { type: string, format: binary, description: CSV; maximum 5 MiB }
    responses:
      '202':
        description: Import job enqueued
        content:
          application/json:
            schema: { $ref: '#/components/schemas/JobEnqueuedEnvelope' }
      '400': { description: Invalid or oversized file }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
/ip-addresses/import/{id}:
  get:
    security: [{ bearerAuth: [] }]
    x-roles: [ADMIN]
    parameters:
      - { name: id, in: path, required: true, schema: { type: string }, description: Job ID, not necessarily a UUID }
    responses:
      '200':
        description: Authorized import job status
        content:
          application/json:
            schema: { $ref: '#/components/schemas/JobStatusEnvelope' }
      '401': { description: Unauthenticated }
      '403': { description: Insufficient role }
      '404': { description: Job not found or inaccessible }
/jobs/{id}:
  get:
    security: [{ bearerAuth: [] }]
    description: Accessible only to the job requester or ADMIN.
    parameters:
      - { name: id, in: path, required: true, schema: { type: string }, description: Job ID, not necessarily a UUID }
    responses:
      '200':
        description: Authorized job status
        content:
          application/json:
            schema: { $ref: '#/components/schemas/JobStatusEnvelope' }
      '401': { description: Unauthenticated }
      '404': { description: Job not found or inaccessible }
/jobs/{id}/download:
  get:
    security: [{ bearerAuth: [] }]
    description: Authorized local report download; bytes are not JSON-wrapped.
    parameters:
      - { name: id, in: path, required: true, schema: { type: string }, description: Job ID, not necessarily a UUID }
    responses:
      '200':
        description: Excel workbook
        headers:
          Cache-Control: { schema: { type: string }, example: 'private, no-store' }
          Content-Disposition: { schema: { type: string }, example: 'attachment; filename="report.xlsx"' }
        content:
          application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
            schema: { type: string, format: binary }
      '401': { description: Unauthenticated }
      '404': { description: Report not found or inaccessible }
```

Reusable components for the preceding block:

```yaml
JobEnqueuedEnvelope:
  type: object
  required: [data]
  properties:
    data:
      type: object
      required: [jobId]
      properties:
        jobId: { type: string }
JobStatusEnvelope:
  type: object
  required: [data]
  properties:
    data:
      type: object
      required: [id, status]
      properties:
        id: { type: string }
        status: { type: string, enum: [QUEUED, RUNNING, COMPLETED, FAILED] }
        downloadUrl: { type: string, nullable: true }
        error: { type: string, nullable: true }
        inserted: { type: integer }
        skipped: { type: integer }
        errors:
          type: array
          items:
            type: object
            required: [row, address, reason]
            properties:
              row: { type: integer }
              address: { type: string }
              reason: { type: string }
        result:
          type: object
          nullable: true
          required: [total, inserted, skipped, errors]
          properties:
            total: { type: integer }
            inserted: { type: integer }
            skipped: { type: integer }
            errors:
              type: array
              items:
                type: object
                required: [row, address, reason]
                properties:
                  row: { type: integer }
                  address: { type: string }
                  reason: { type: string }
```
