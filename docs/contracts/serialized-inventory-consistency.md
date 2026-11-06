# Serialized inventory consistency

`products.is_serialized` is the authoritative classification. Migration backfills it for
products with existing router records. A product becomes serialized atomically with its first
successful router receipt or opening-stock registration; rolling that operation back also rolls
back the classification. Classification is not inferred from product names, SKUs or categories.
Before first onboarding, generic inventory operations can establish opening stock; afterwards,
quantity-only writes are rejected and serialized stock must be managed through router operations.

Generic inventory writes and router onboarding acquire a `FOR NO KEY UPDATE` product lock before
warehouse locks and hold it through commit. Generic transfers acquire warehouse locks in sorted
order. The weaker product lock is intentional: it serializes classification and generic writes
without conflicting with foreign-key key-share locks taken by other router operations.

The opt-in PostgreSQL regression suite requires an already migrated **disposable** database. It
inserts synthetic fixtures and leaves them in that database for inspection:

```powershell
$env:INVENTORY_TEST_DATABASE_URL = 'postgresql://user:password@localhost:55456/disposable_db'
pnpm --filter @alfahd/api exec vitest run test/inventory-classification.pg.spec.ts
```

The suite checks both lock orderings and rollback of classification with a caller-owned transaction.
It also exercises selected router custody, repair, onboarding and IP invariants against PostgreSQL;
it does not replace the full set of migration and lifecycle concurrency acceptance tests.
