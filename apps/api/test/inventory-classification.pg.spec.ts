import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { ConflictException } from '@nestjs/common';
import * as schema from '../src/database/schema/index.js';
import { RepositoryService } from '../src/modules/repository/repository.service.js';
import { ProductsRepository } from '../src/modules/repository/repositories/products.repository.js';
import { WarehousesRepository } from '../src/modules/repository/repositories/warehouses.repository.js';
import { InventoryRepository } from '../src/modules/repository/repositories/inventory.repository.js';
import { RoutersRepository } from '../src/modules/repository/repositories/routers.repository.js';
import { IpRepository } from '../src/modules/repository/repositories/ip.repository.js';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { RoutersService } from '../src/modules/routers/routers.service.js';
import { IpService } from '../src/modules/ip-management/ip.service.js';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service.js';
import { UsersService } from '../src/users/users.service.js';

// Only point this at a migrated, disposable database; the suite writes fixtures.
const url = process.env.INVENTORY_TEST_DATABASE_URL;
describe.skipIf(!url)('serialized inventory consistency (PostgreSQL)', () => {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  const products = new ProductsRepository(db);
  const inventoryRepo = new InventoryRepository(db);
  const repo = new RepositoryService(
    db,
    products,
    new WarehousesRepository(db),
    inventoryRepo,
    new RoutersRepository(db),
    new IpRepository(db),
  );
  const inventory = new InventoryService(repo);
  const routers = new RoutersService(repo, {} as never);
  const ips = new IpService(repo);
  const warehouses = new WarehousesService(repo);
  const users = new UsersService(
    db,
    { send: async () => {} } as never,
    { revokeAllSessions: async () => 0 } as never,
  );
  const warehouseId = randomUUID();
  const actorId = randomUUID();
  const technicianId = randomUUID();

  beforeAll(async () => {
    await db
      .insert(schema.warehouses)
      .values({ id: warehouseId, name: 'Synthetic test warehouse' });
    await db.insert(schema.users).values({
      id: actorId,
      email: `${actorId}@example.invalid`,
      passwordHash: 'synthetic',
      role: 'ADMIN',
    });
    await db.insert(schema.users).values({
      id: technicianId,
      email: `${technicianId}@example.invalid`,
      passwordHash: 'synthetic',
      role: 'TECHNICIAN',
      assignedWarehouseId: warehouseId,
    });
  });
  afterAll(async () => {
    // Fixtures are left in the disposable DB for inspection; only close connections.
    await pool.end();
  });
  async function product() {
    const id = randomUUID();
    await db
      .insert(schema.products)
      .values({ id, name: 'Generic device', sku: id, category: 'Hardware', model: 'test' });
    return id;
  }
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  async function waitForProductLock() {
    for (let i = 0; i < 100; i++) {
      const result = await pool.query(
        "SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%products%'",
      );
      if (result.rowCount) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Expected a transaction to wait for the product lock');
  }

  it('rejects an adjustment waiting behind a first receipt', async () => {
    const productId = await product();
    const entered = deferred();
    const release = deferred();
    const receipt = db.transaction(async (tx) => {
      await routers.create(
        { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
        actorId,
        tx,
      );
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const adjustment = inventory.adjustStock({
      productId,
      warehouseId,
      newQuantity: 0,
      notes: 'race',
      responsibleUserId: actorId,
    });
    try {
      await waitForProductLock();
    } finally {
      release.resolve();
    }
    await receipt;
    await expect(adjustment).rejects.toThrow('serialized SKU');
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    expect(
      await db.select().from(schema.routers).where(eq(schema.routers.productId, productId)),
    ).toHaveLength(1);
  });

  it('commits an adjustment before a waiting first receipt without losing it', async () => {
    const productId = await product();
    const entered = deferred();
    const release = deferred();
    const original = inventoryRepo.getStock.bind(inventoryRepo);
    inventoryRepo.getStock = async (...args) => {
      const result = await original(...args);
      if (args[1] === productId) {
        entered.resolve();
        await release.promise;
      }
      return result;
    };
    try {
      const adjustment = inventory.adjustStock({
        productId,
        warehouseId,
        newQuantity: 2,
        notes: 'opening stock',
        responsibleUserId: actorId,
      });
      await entered.promise;
      const receipt = routers.create(
        { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
        actorId,
      );
      try {
        await waitForProductLock();
      } finally {
        release.resolve();
      }
      await adjustment;
      await receipt;
      inventoryRepo.getStock = original;
      expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(3);
      expect(
        (await db.select().from(schema.products).where(eq(schema.products.id, productId)))[0]
          .isSerialized,
      ).toBe(true);
    } finally {
      inventoryRepo.getStock = original;
    }
  });

  it('rolls classification back with a caller-owned failed receipt', async () => {
    const productId = await product();
    await expect(
      db.transaction(async (tx) => {
        await routers.create(
          { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
          actorId,
          tx,
        );
        throw new Error('synthetic rollback');
      }),
    ).rejects.toThrow('synthetic rollback');
    expect(
      (await db.select().from(schema.products).where(eq(schema.products.id, productId)))[0]
        .isSerialized,
    ).toBe(false);
    expect(await inventoryRepo.getStock(warehouseId, productId)).toBeUndefined();
    await inventory.adjustStock({
      productId,
      warehouseId,
      newQuantity: 2,
      notes: 'opening stock',
      responsibleUserId: actorId,
    });
  });

  it('restores a repaired router once after inspection, even with competing updates', async () => {
    const productId = await product();
    const [router] = await db
      .insert(schema.routers)
      .values({
        productId,
        warehouseId,
        serialNumber: randomUUID(),
        status: 'UNDER_REPAIR',
        physicalCondition: 'UNDER_REPAIR',
      })
      .returning();

    await routers.transition(
      router.id,
      { status: 'AVAILABLE', reason: 'Repair completed' },
      actorId,
    );
    expect(await inventoryRepo.getStock(warehouseId, productId)).toBeUndefined();
    expect(await repo.routers.findActiveAssignment(router.id)).toBeUndefined();

    await Promise.all([
      routers.updateCondition(
        router.id,
        { physicalCondition: 'SERVICEABLE', reason: 'Inspection passed' },
        actorId,
      ),
      routers.updateCondition(
        router.id,
        { physicalCondition: 'SERVICEABLE', reason: 'Inspection passed' },
        actorId,
      ),
    ]);
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    expect((await repo.routers.findActiveAssignment(router.id))?.holderType).toBe('WAREHOUSE');
    expect(
      await db
        .select()
        .from(schema.routerAssignments)
        .where(eq(schema.routerAssignments.routerId, router.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.stockMovements)
        .where(eq(schema.stockMovements.productId, productId)),
    ).toHaveLength(1);
  });

  it('preserves technician custody and history when customer installation is gated', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await routers.assign(router.id, { technicianId }, actorId);
    await expect(
      routers.transition(
        router.id,
        { status: 'INSTALLED_AT_CUSTOMER', reason: 'Installed' },
        actorId,
      ),
    ).rejects.toThrow('Customer installation is unavailable');
    const assignments = await repo.routers.findAssignmentsByRouter(router.id);
    expect(assignments).toHaveLength(2);
    expect(
      assignments
        .filter((assignment) => assignment.releasedAt === null)
        .map((assignment) => assignment.holderType),
    ).toEqual(['TECHNICIAN']);
    expect(
      assignments
        .filter((assignment) => assignment.releasedAt !== null)
        .map((assignment) => assignment.holderType)
        .sort(),
    ).toEqual(['WAREHOUSE']);
    expect((await routers.findById(router.id)).status).toBe('ASSIGNED_TO_TECHNICIAN');
    expect(await repo.routers.findStatusHistory(router.id)).toHaveLength(0);
  });

  it('rejects damaged registration against stock already represented by a serial', async () => {
    const productId = await product();
    await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await expect(
      routers.create(
        { productId, warehouseId, serialNumber: randomUUID(), physicalCondition: 'DAMAGED' },
        actorId,
      ),
    ).rejects.toThrow();
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    expect(
      await db.select().from(schema.routers).where(eq(schema.routers.productId, productId)),
    ).toHaveLength(1);
  });

  it('serializes competing IP reservations with one actual history event', async () => {
    const ip = await ips.create(
      { address: `10.123.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      actorId,
    );
    const outcomes = await Promise.allSettled([
      ips.reserve(ip.id, 'first', actorId),
      ips.reserve(ip.id, 'second', actorId),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const history = await repo.ip.findHistoryByIp(ip.id);
    expect(history.filter((event) => event.action === 'RESERVE')).toHaveLength(1);
  });

  it('rolls IP metadata back when audit insertion fails', async () => {
    const ip = await ips.create(
      {
        address: `10.124.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
        notes: 'before',
      },
      actorId,
    );
    const original = repo.ip.createHistory.bind(repo.ip);
    repo.ip.createHistory = async () => {
      throw new Error('injected audit failure');
    };
    try {
      await expect(ips.update(ip.id, { notes: 'after' }, actorId)).rejects.toThrow(
        'injected audit failure',
      );
    } finally {
      repo.ip.createHistory = original;
    }
    expect((await ips.findById(ip.id)).notes).toBe('before');
    expect(
      (await repo.ip.findHistoryByIp(ip.id)).filter((event) => event.action === 'UPDATE_METADATA'),
    ).toHaveLength(0);
  });

  it('enforces IPv4 host semantics and canonical uniqueness in direct SQL', async () => {
    await expect(
      pool.query("INSERT INTO ip_addresses(address) VALUES ('2001:db8::1')"),
    ).rejects.toThrow();
    await expect(
      pool.query("INSERT INTO ip_addresses(address) VALUES ('192.0.2.0/24')"),
    ).rejects.toThrow();
    const address = `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    await pool.query('INSERT INTO ip_addresses(address) VALUES ($1::inet)', [address]);
    await expect(
      pool.query("INSERT INTO ip_addresses(address) VALUES (($1 || '/32')::inet)", [address]),
    ).rejects.toThrow();
  });

  it('preserves concurrent receipts against initially absent stock and rejects competing assignments', async () => {
    const productId = await product();
    const created = await Promise.all(
      Array.from({ length: 2 }, () =>
        routers.create(
          { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
          actorId,
        ),
      ),
    );
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(2);
    const assignments = await Promise.allSettled([
      routers.assign(created[0].id, { technicianId }, actorId),
      routers.assign(created[0].id, { technicianId }, actorId),
    ]);
    expect(assignments.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    expect((await repo.routers.findActiveAssignment(created[0].id))?.holderType).toBe('TECHNICIAN');
  });

  it('serializes receipt against warehouse deactivation', async () => {
    const productId = await product();
    const id = randomUUID();
    await db.insert(schema.warehouses).values({ id, name: 'Synthetic deactivation race' });
    const outcomes = await Promise.allSettled([
      warehouses.remove(id),
      routers.create(
        { productId, warehouseId: id, serialNumber: randomUUID(), isNewReceipt: true },
        actorId,
      ),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [warehouse] = await db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.id, id));
    const devices = await db
      .select()
      .from(schema.routers)
      .where(eq(schema.routers.warehouseId, id));
    if (!warehouse.isActive) expect(devices).toHaveLength(0);
    else expect(devices).toHaveLength(1);
  });

  it('never leaves an archived reserved IP during competing operations', async () => {
    const address = `10.125.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    const ip = await ips.create({ address }, actorId);
    const outcomes = await Promise.allSettled([
      ips.reserve(ip.id, 'reserve', actorId),
      ips.archive(ip.id, 'archive', actorId),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const current = await ips.findById(ip.id);
    expect(current.isArchived && current.status === 'RESERVED').toBe(false);
    const history = await repo.ip.findHistoryByIp(ip.id);
    expect(
      history.filter((event) => event.action === 'RESERVE' || event.action === 'ARCHIVE'),
    ).toHaveLength(1);
  });

  it('rolls back a return and its lifecycle history with the caller transaction', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await routers.assign(router.id, { technicianId }, actorId);
    await expect(
      db.transaction(async (tx) => {
        await routers.transition(
          router.id,
          { status: 'RETURNED', reason: 'Return', targetWarehouseId: warehouseId },
          actorId,
          tx,
        );
        throw new Error('caller rollback');
      }),
    ).rejects.toThrow('caller rollback');
    expect((await routers.findById(router.id)).status).toBe('ASSIGNED_TO_TECHNICIAN');
    expect((await repo.routers.findActiveAssignment(router.id))?.holderType).toBe('TECHNICIAN');
    expect(await repo.routers.findStatusHistory(router.id)).toHaveLength(0);
  });

  it('moves usable stock and custody, removes both for external repair, then restores once', async () => {
    const productId = await product();
    const destination = randomUUID();
    await db.insert(schema.warehouses).values({ id: destination, name: 'Synthetic destination' });
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await routers.updateCondition(
      router.id,
      { physicalCondition: 'SERVICEABLE', warehouseId: destination, reason: 'Move' },
      actorId,
    );
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(0);
    expect((await inventoryRepo.getStock(destination, productId))?.quantity).toBe(1);
    expect((await repo.routers.findActiveAssignment(router.id))?.warehouseId).toBe(destination);
    await routers.updateCondition(
      router.id,
      {
        physicalCondition: 'UNDER_REPAIR',
        externalLocation: 'Synthetic repair shop',
        reason: 'Repair',
      },
      actorId,
    );
    expect((await inventoryRepo.getStock(destination, productId))?.quantity).toBe(0);
    expect(await repo.routers.findActiveAssignment(router.id)).toBeUndefined();
    expect((await routers.findById(router.id)).warehouseId).toBeNull();
    await routers.updateCondition(
      router.id,
      { physicalCondition: 'SERVICEABLE', warehouseId: destination, reason: 'Inspected' },
      actorId,
    );
    expect((await inventoryRepo.getStock(destination, productId))?.quantity).toBe(1);
    expect((await repo.routers.findActiveAssignment(router.id))?.warehouseId).toBe(destination);
  });

  it('requires transition reasons and persists the valid reason atomically', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await routers.assign(router.id, { technicianId }, actorId);
    await expect(
      routers.transition(router.id, { status: 'RETURNED', reason: '  ' }, actorId),
    ).rejects.toThrow();
    await expect(
      routers.transition(router.id, { status: 'AVAILABLE', reason: 'Not allowed' }, actorId),
    ).rejects.toThrow();
    expect(await repo.routers.findStatusHistory(router.id)).toHaveLength(0);
    await routers.transition(
      router.id,
      { status: 'RETURNED', reason: '  Recovered  ', targetWarehouseId: warehouseId },
      actorId,
    );
    const history = await repo.routers.findStatusHistory(router.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: 'ASSIGNED_TO_TECHNICIAN',
      toStatus: 'RETURNED',
      changedBy: actorId,
      reason: 'Recovered',
    });
    expect(history[0].createdAt).toBeInstanceOf(Date);
  });

  it('records reconstructable IP metadata and does not audit no-op edits', async () => {
    const ip = await ips.create(
      {
        address: `10.126.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
        notes: 'before',
      },
      actorId,
    );
    await ips.update(ip.id, { notes: 'after' }, actorId);
    await ips.update(ip.id, { notes: 'after' }, actorId);
    const changes = (await repo.ip.findHistoryByIp(ip.id)).filter(
      (event) => event.action === 'UPDATE_METADATA',
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      metadataBefore: { notes: 'before' },
      metadataAfter: { notes: 'after' },
      actorId,
    });
    expect(changes[0].createdAt).toBeInstanceOf(Date);
  });

  it('allows only one competing opening registration and never fabricates a receipt', async () => {
    const productId = await product();
    await inventory.adjustStock({
      productId,
      warehouseId,
      newQuantity: 1,
      notes: 'opening stock',
      responsibleUserId: actorId,
    });
    const outcomes = await Promise.allSettled([
      routers.create({ productId, warehouseId, serialNumber: randomUUID() }, actorId),
      routers.create(
        { productId, warehouseId, serialNumber: randomUUID(), physicalCondition: 'DAMAGED' },
        actorId,
      ),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const devices = await db
      .select()
      .from(schema.routers)
      .where(eq(schema.routers.productId, productId));
    expect(devices).toHaveLength(1);
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(
      devices[0].physicalCondition === 'SERVICEABLE' ? 1 : 0,
    );
    const movements = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.productId, productId));
    expect(
      movements.filter((movement) => movement.movementType === 'INBOUND_SUPPLIER'),
    ).toHaveLength(0);
  });

  it('rolls back assignment, stock and custody with a caller-owned transaction', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await expect(
      db.transaction(async (tx) => {
        await routers.assign(router.id, { technicianId }, actorId, tx);
        throw new Error('caller rollback');
      }),
    ).rejects.toThrow('caller rollback');
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    expect((await routers.findById(router.id)).status).toBe('AVAILABLE');
    expect((await repo.routers.findActiveAssignment(router.id))?.holderType).toBe('WAREHOUSE');
    expect(await repo.routers.findAssignmentsByRouter(router.id)).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.stockMovements)
        .where(eq(schema.stockMovements.productId, productId)),
    ).toHaveLength(1);
  });

  it('records one release when two release attempts compete', async () => {
    const ip = await ips.create(
      { address: `10.127.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      actorId,
    );
    await ips.reserve(ip.id, 'reserve', actorId);
    const outcomes = await Promise.allSettled([
      ips.release(ip.id, 'one', actorId),
      ips.release(ip.id, 'two', actorId),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect((await ips.findById(ip.id)).status).toBe('FREE');
    expect(
      (await repo.ip.findHistoryByIp(ip.id)).filter((event) => event.action === 'RELEASE'),
    ).toHaveLength(1);
  });

  it('records one unarchive when concurrent retries restore an archived IP', async () => {
    const ip = await ips.create(
      { address: `10.128.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      actorId,
    );
    await ips.archive(ip.id, 'archive', actorId);
    await Promise.all([ips.unarchive(ip.id, 'one', actorId), ips.unarchive(ip.id, 'two', actorId)]);
    expect((await ips.findById(ip.id)).isArchived).toBe(false);
    expect(
      (await repo.ip.findHistoryByIp(ip.id)).filter((event) => event.action === 'UNARCHIVE'),
    ).toHaveLength(1);
  });

  it.each(['receipt', 'return', 'condition'] as const)(
    'rejects %s waiting behind warehouse deactivation',
    async (operation) => {
      const target = randomUUID();
      await db
        .insert(schema.warehouses)
        .values({ id: target, name: `Synthetic inactive ${operation}` });
      const productId = await product();
      let routerId = '';
      if (operation !== 'receipt') {
        const router = await routers.create(
          { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
          actorId,
        );
        routerId = router.id;
        if (operation === 'return') await routers.assign(router.id, { technicianId }, actorId);
      }
      const entered = deferred();
      const release = deferred();
      const deactivation = db.transaction(async (tx) => {
        await repo.warehouses.findByIdForUpdate(target, tx);
        await repo.warehouses.softDeactivate(target, tx);
        entered.resolve();
        await release.promise;
      });
      await entered.promise;
      const placement =
        operation === 'receipt'
          ? routers.create(
              { productId, warehouseId: target, serialNumber: randomUUID(), isNewReceipt: true },
              actorId,
            )
          : operation === 'return'
            ? routers.transition(
                routerId,
                { status: 'RETURNED', reason: 'Return', targetWarehouseId: target },
                actorId,
              )
            : routers.updateCondition(
                routerId,
                { physicalCondition: 'SERVICEABLE', warehouseId: target, reason: 'Move' },
                actorId,
              );
      const outcome = placement.then(
        () => 'fulfilled',
        () => 'rejected',
      );
      try {
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          const result = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%warehouses%'",
          );
          if (result.rowCount) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(blocked).toBe(true);
      } finally {
        release.resolve();
      }
      await deactivation;
      expect(await outcome).toBe('rejected');
      expect(
        await db.select().from(schema.routers).where(eq(schema.routers.warehouseId, target)),
      ).toHaveLength(0);
      expect((await repo.warehouses.findById(target))?.isActive).toBe(false);
    },
  );

  it('rolls back condition and location changes and their stock and custody history', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await expect(
      db.transaction(async (tx) => {
        await routers.updateCondition(
          router.id,
          { physicalCondition: 'DAMAGED', reason: 'Synthetic damage' },
          actorId,
          tx,
        );
        throw new Error('caller rollback');
      }),
    ).rejects.toThrow('caller rollback');
    expect((await routers.findById(router.id)).physicalCondition).toBe('SERVICEABLE');
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    expect((await repo.routers.findActiveAssignment(router.id))?.holderType).toBe('WAREHOUSE');
    expect(await repo.routers.findConditionHistory(router.id)).toHaveLength(0);
    expect(await repo.routers.findAssignmentsByRouter(router.id)).toHaveLength(1);
  });

  it.each(['receipt', 'return', 'condition'] as const)(
    'blocks deactivation waiting behind a committed %s placement',
    async (operation) => {
      const target = randomUUID();
      await db
        .insert(schema.warehouses)
        .values({ id: target, name: `Synthetic placement ${operation}` });
      const productId = await product();
      let routerId = '';
      if (operation !== 'receipt') {
        const router = await routers.create(
          { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
          actorId,
        );
        routerId = router.id;
        if (operation === 'return') await routers.assign(router.id, { technicianId }, actorId);
      }
      const entered = deferred();
      const release = deferred();
      const placement = db.transaction(async (tx) => {
        if (operation === 'receipt')
          await routers.create(
            { productId, warehouseId: target, serialNumber: randomUUID(), isNewReceipt: true },
            actorId,
            tx,
          );
        else if (operation === 'return')
          await routers.transition(
            routerId,
            { status: 'RETURNED', reason: 'Return', targetWarehouseId: target },
            actorId,
            tx,
          );
        else
          await routers.updateCondition(
            routerId,
            { physicalCondition: 'SERVICEABLE', warehouseId: target, reason: 'Move' },
            actorId,
            tx,
          );
        entered.resolve();
        await release.promise;
      });
      await entered.promise;
      const outcome = warehouses.remove(target).then(
        () => 'fulfilled',
        () => 'rejected',
      );
      try {
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          const result = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%warehouses%'",
          );
          if (result.rowCount) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(blocked).toBe(true);
      } finally {
        release.resolve();
      }
      await placement;
      expect(await outcome).toBe('rejected');
      expect((await repo.warehouses.findById(target))?.isActive).toBe(true);
      expect(
        await db.select().from(schema.routers).where(eq(schema.routers.warehouseId, target)),
      ).toHaveLength(1);
    },
  );

  it('protects warehouses with stock, assigned staff, technicians, damaged/repair routers, or active custody', async () => {
    const stockWh = randomUUID();
    const staffWh = randomUUID();
    const techWh = randomUUID();
    const damagedWh = randomUUID();
    const underRepairWh = randomUUID();
    const custodyWh = randomUUID();

    await db.insert(schema.warehouses).values([
      { id: stockWh, name: 'Synthetic stock blocker' },
      { id: staffWh, name: 'Synthetic staff blocker' },
      { id: techWh, name: 'Synthetic tech blocker' },
      { id: damagedWh, name: 'Synthetic damaged blocker' },
      { id: underRepairWh, name: 'Synthetic under repair blocker' },
      { id: custodyWh, name: 'Synthetic custody blocker' },
    ]);
    const productId = await product();
    await db
      .insert(schema.warehouseInventory)
      .values({ warehouseId: stockWh, productId, quantity: 1 });
    await db.insert(schema.users).values([
      {
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'synthetic',
        role: 'WAREHOUSE_STAFF',
        assignedWarehouseId: staffWh,
      },
      {
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'synthetic',
        role: 'TECHNICIAN',
        assignedWarehouseId: techWh,
      },
    ]);
    await db.insert(schema.routers).values([
      {
        productId,
        warehouseId: damagedWh,
        serialNumber: randomUUID(),
        status: 'AVAILABLE',
        physicalCondition: 'DAMAGED',
      },
      {
        productId,
        warehouseId: underRepairWh,
        serialNumber: randomUUID(),
        status: 'AVAILABLE',
        physicalCondition: 'UNDER_REPAIR',
      },
    ]);
    const custodyRouterId = randomUUID();
    await db.insert(schema.routers).values({
      id: custodyRouterId,
      productId,
      warehouseId: null, // Router has active custody at custodyWh, but is NOT physically located there
      serialNumber: randomUUID(),
      status: 'AVAILABLE',
      physicalCondition: 'SERVICEABLE',
    });
    await db.insert(schema.routerAssignments).values({
      routerId: custodyRouterId,
      holderType: 'WAREHOUSE',
      warehouseId: custodyWh,
      releasedAt: null,
      assignedBy: actorId,
    });

    for (const id of [stockWh, staffWh, techWh, damagedWh, underRepairWh, custodyWh]) {
      await expect(warehouses.remove(id)).rejects.toMatchObject({ status: 409 });
      expect((await repo.warehouses.findById(id))?.isActive).toBe(true);
    }

    // Verify active-custody blocker fires specifically when physical routers, staff, and stock are 0
    await expect(warehouses.remove(custodyWh)).rejects.toThrow(
      /active router custody assignment\(s\)\. Release custody first\./,
    );
  });

  it.each([
    'receipt',
    'return',
    'condition',
    'inbound',
    'transfer',
    'employeeCreate',
    'employeeUpdate',
  ] as const)('rejects %s targeting an already deactivated warehouse', async (operation) => {
    const target = randomUUID();
    await db.insert(schema.warehouses).values({ id: target, name: 'Synthetic deactivated target' });
    await warehouses.remove(target);
    expect((await repo.warehouses.findById(target))?.isActive).toBe(false);

    const productId = await product();
    let routerId = '';
    if (operation === 'return' || operation === 'condition') {
      const router = await routers.create(
        { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
        actorId,
      );
      routerId = router.id;
      if (operation === 'return') await routers.assign(router.id, { technicianId }, actorId);
    }

    if (operation === 'receipt') {
      await expect(
        routers.create(
          { productId, warehouseId: target, serialNumber: randomUUID(), isNewReceipt: true },
          actorId,
        ),
      ).rejects.toThrow(/deactivated warehouse/);
    } else if (operation === 'return') {
      await expect(
        routers.transition(
          routerId,
          { status: 'RETURNED', reason: 'Return', targetWarehouseId: target },
          actorId,
        ),
      ).rejects.toThrow(/deactivated warehouse/);
    } else if (operation === 'condition') {
      await expect(
        routers.updateCondition(
          routerId,
          { physicalCondition: 'SERVICEABLE', warehouseId: target, reason: 'Move' },
          actorId,
        ),
      ).rejects.toThrow(/deactivated warehouse/);
    } else if (operation === 'inbound') {
      await expect(
        inventory.receiveInbound({
          productId,
          warehouseId: target,
          quantity: 1,
          supplierName: 'Synthetic Supplier',
          responsibleUserId: actorId,
        }),
      ).rejects.toThrow(/deactivated warehouse/);
    } else if (operation === 'transfer') {
      await inventory.adjustStock({
        productId,
        warehouseId,
        newQuantity: 5,
        notes: 'Source stock',
        responsibleUserId: actorId,
      });
      await expect(
        inventory.transferStock({
          productId,
          fromWarehouseId: warehouseId,
          toWarehouseId: target,
          quantity: 1,
          responsibleUserId: actorId,
        }),
      ).rejects.toThrow(/deactivated warehouse/);
    } else if (operation === 'employeeCreate') {
      await expect(
        users.createEmployee({
          name: 'Synthetic Tech',
          email: `${randomUUID()}@example.invalid`,
          role: 'TECHNICIAN',
          assignedWarehouseId: target,
        }),
      ).rejects.toThrow(/deactivated warehouse/);
    } else if (operation === 'employeeUpdate') {
      await expect(
        users.updateEmployee(technicianId, {
          assignedWarehouseId: target,
        }),
      ).rejects.toThrow(/deactivated warehouse/);
    }
  });

  it('serializes concurrent user assignment against warehouse deactivation', async () => {
    const target = randomUUID();
    await db
      .insert(schema.warehouses)
      .values({ id: target, name: 'Synthetic user assignment race' });

    const outcomes = await Promise.allSettled([
      warehouses.remove(target),
      users.createEmployee({
        name: 'Concurrent Staff',
        email: `${randomUUID()}@example.invalid`,
        role: 'WAREHOUSE_STAFF',
        assignedWarehouseId: target,
      }),
    ]);

    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1);

    const deactivationOutcome = outcomes[0];
    const assignmentOutcome = outcomes[1];

    if (deactivationOutcome.status === 'fulfilled') {
      // Deactivation won: warehouse is inactive, employee creation was rejected with 400
      expect((await repo.warehouses.findById(target))?.isActive).toBe(false);
      expect((assignmentOutcome as PromiseRejectedResult).reason).toMatchObject({ status: 400 });
    } else {
      // User assignment won: warehouse remains active, deactivation was rejected with 409
      expect((await repo.warehouses.findById(target))?.isActive).toBe(true);
      expect((deactivationOutcome as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    }
  });

  it('preserves historical movements, closed custody, and audit trails after deactivation', async () => {
    const target = randomUUID();
    await db
      .insert(schema.warehouses)
      .values({ id: target, name: 'Synthetic historical preservation' });
    const productId = await product();

    // 1. Inbound receipt into target warehouse
    const router = await routers.create(
      { productId, warehouseId: target, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );

    // 2. Assign to technician (closes warehouse custody, stock -1)
    await routers.assign(router.id, { technicianId }, actorId);

    // 3. Deactivate warehouse (no stock, no staff, no physical routers, no active custody)
    await warehouses.remove(target);
    expect((await repo.warehouses.findById(target))?.isActive).toBe(false);

    // 4. Verify historical stock movement referencing target warehouse remains intact
    const movements = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.warehouseId, target));
    expect(movements.length).toBeGreaterThanOrEqual(1);

    // 5. Verify historical closed custody assignment referencing target warehouse remains intact
    const historicalCustody = await repo.routers.findAssignmentsByRouter(router.id);
    const targetAssignment = historicalCustody.find((a) => a.warehouseId === target);
    expect(targetAssignment).toBeDefined();
    expect(targetAssignment?.releasedAt).toBeInstanceOf(Date);
  });

  it('retains both concurrent receipts when a stock row already exists', async () => {
    const productId = await product();
    await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await Promise.all(
      Array.from({ length: 2 }, () =>
        routers.create(
          { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
          actorId,
        ),
      ),
    );
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(3);
    expect(
      await db.select().from(schema.routers).where(eq(schema.routers.productId, productId)),
    ).toHaveLength(3);
    expect(
      await db
        .select()
        .from(schema.stockMovements)
        .where(eq(schema.stockMovements.productId, productId)),
    ).toHaveLength(3);
  });

  it('rolls back router, custody, stock and movement when a late receipt step fails', async () => {
    const productId = await product();
    const serialNumber = randomUUID();
    const original = inventoryRepo.recordMovementWithDelta.bind(inventoryRepo);
    inventoryRepo.recordMovementWithDelta = async (...args) => {
      await original(...args);
      throw new Error('synthetic post-movement failure');
    };
    try {
      await expect(
        routers.create({ productId, warehouseId, serialNumber, isNewReceipt: true }, actorId),
      ).rejects.toThrow('synthetic post-movement failure');
    } finally {
      inventoryRepo.recordMovementWithDelta = original;
    }
    expect(await repo.routers.findBySerialNumber(serialNumber)).toBeUndefined();
    expect(await inventoryRepo.getStock(warehouseId, productId)).toBeUndefined();
    expect(
      await db
        .select()
        .from(schema.stockMovements)
        .where(eq(schema.stockMovements.productId, productId)),
    ).toHaveLength(0);
    expect(
      (await db.select().from(schema.products).where(eq(schema.products.id, productId)))[0]
        .isSerialized,
    ).toBe(false);
  });

  it.each(['SERVICEABLE', 'DAMAGED', 'UNDER_REPAIR'] as const)(
    'reconciles a single %s opening unit and rejects a serial retry',
    async (physicalCondition) => {
      const productId = await product();
      const serialNumber = randomUUID();
      await inventory.adjustStock({
        productId,
        warehouseId,
        newQuantity: 1,
        notes: 'opening count',
        responsibleUserId: actorId,
      });
      await routers.create({ productId, warehouseId, serialNumber, physicalCondition }, actorId);
      await expect(
        routers.create({ productId, warehouseId, serialNumber, physicalCondition }, actorId),
      ).rejects.toThrow();
      expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(
        physicalCondition === 'SERVICEABLE' ? 1 : 0,
      );
      const movements = await db
        .select()
        .from(schema.stockMovements)
        .where(eq(schema.stockMovements.productId, productId));
      expect(
        movements.filter((movement) => movement.movementType === 'INBOUND_SUPPLIER'),
      ).toHaveLength(0);
      expect(
        movements.filter((movement) => movement.notes?.includes('Explicit reconciliation')),
      ).toHaveLength(physicalCondition === 'SERVICEABLE' ? 0 : 1);
    },
  );

  it('rejects competing concurrent retries with the same serial number and avoids duplicate movements', async () => {
    const productId = await product();
    const serialNumber = randomUUID();
    const outcomes = await Promise.allSettled([
      routers.create({ productId, warehouseId, serialNumber, isNewReceipt: true }, actorId),
      routers.create({ productId, warehouseId, serialNumber, isNewReceipt: true }, actorId),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const rejected = outcomes.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    const movements = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.productId, productId));
    expect(movements).toHaveLength(1);
  });

  it('verifies complete reconciliation evidence when onboarding damaged opening units', async () => {
    const productId = await product();
    const damagedSerial = randomUUID();
    const serviceableSerial = randomUUID();

    // 1. Establish opening stock of 2 units
    await inventory.adjustStock({
      productId,
      warehouseId,
      newQuantity: 2,
      notes: 'opening count for reconciliation evidence',
      responsibleUserId: actorId,
    });

    // 2. Onboard 1 damaged opening unit
    const damagedRouter = await routers.create(
      {
        productId,
        warehouseId,
        serialNumber: damagedSerial,
        physicalCondition: 'DAMAGED',
        notes: 'Broken chassis on opening inspection',
      },
      actorId,
    );

    // 3. Onboard 1 serviceable opening unit
    const serviceableRouter = await routers.create(
      {
        productId,
        warehouseId,
        serialNumber: serviceableSerial,
        physicalCondition: 'SERVICEABLE',
      },
      actorId,
    );

    // 4. Verify opening stock adjusted down by 1 (2 opening - 1 damaged = 1 serviceable stock remaining)
    const stock = await inventoryRepo.getStock(warehouseId, productId);
    expect(stock?.quantity).toBe(1);

    // 5. Verify registration capacity is now exhausted (1 stock - 1 usable registered = 0)
    await expect(
      routers.create(
        {
          productId,
          warehouseId,
          serialNumber: randomUUID(),
          physicalCondition: 'SERVICEABLE',
        },
        actorId,
      ),
    ).rejects.toThrow(ConflictException);

    // 6. Verify damaged router properties and custody
    expect(damagedRouter.physicalCondition).toBe('DAMAGED');
    expect(damagedRouter.status).toBe('AVAILABLE');
    const damagedCustody = await repo.routers.findActiveAssignment(damagedRouter.id);
    expect(damagedCustody).toBeUndefined();

    // 7. Verify serviceable router custody
    const serviceableCustody = await repo.routers.findActiveAssignment(serviceableRouter.id);
    expect(serviceableCustody?.holderType).toBe('WAREHOUSE');

    // 8. Verify condition history audit evidence for damaged router
    const condHistory = await repo.routers.findConditionHistory(damagedRouter.id);
    expect(condHistory).toHaveLength(1);
    expect(condHistory[0]).toMatchObject({
      fromCondition: 'SERVICEABLE',
      toCondition: 'DAMAGED',
      reason: 'Broken chassis on opening inspection',
      changedBy: actorId,
    });

    // 9. Verify movement audit evidence: exactly 1 ADJUSTMENT movement for reconciliation
    const movements = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.productId, productId));
    const reconciliationMovements = movements.filter(
      (m) =>
        m.movementType === 'ADJUSTMENT' &&
        m.notes?.includes('Explicit reconciliation: opening stock unit registered as DAMAGED'),
    );
    expect(reconciliationMovements).toHaveLength(1);
    expect(reconciliationMovements[0].quantity).toBe(1);
    expect(reconciliationMovements[0].responsibleUserId).toBe(actorId);
  });

  it.each(['inbound', 'outbound', 'return', 'transfer'] as const)(
    'rejects generic %s waiting behind first serialized receipt',
    async (operation) => {
      const productId = await product();
      const destination = randomUUID();
      await db
        .insert(schema.warehouses)
        .values({ id: destination, name: 'Synthetic transfer target' });
      const entered = deferred();
      const release = deferred();
      const receipt = db.transaction(async (tx) => {
        await routers.create(
          { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
          actorId,
          tx,
        );
        entered.resolve();
        await release.promise;
      });
      await entered.promise;
      const dto = { productId, warehouseId, quantity: 1, responsibleUserId: actorId };
      const generic =
        operation === 'inbound'
          ? inventory.receiveInbound({ ...dto, supplierName: 'Synthetic' })
          : operation === 'outbound'
            ? inventory.issueOutbound({ ...dto, technicianId })
            : operation === 'return'
              ? inventory.receiveReturn({ ...dto, technicianId })
              : inventory.transferStock({
                  productId,
                  fromWarehouseId: warehouseId,
                  toWarehouseId: destination,
                  quantity: 1,
                  responsibleUserId: actorId,
                });
      const outcome = generic.then(
        () => 'fulfilled',
        () => 'rejected',
      );
      try {
        await waitForProductLock();
      } finally {
        release.resolve();
      }
      await receipt;
      expect(await outcome).toBe('rejected');
      expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
      expect(await inventoryRepo.getStock(destination, productId)).toBeUndefined();
    },
  );

  it('rolls back a valid lifecycle transition if status audit insertion fails', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    await routers.assign(router.id, { technicianId }, actorId);
    const original = repo.routers.createStatusHistory.bind(repo.routers);
    repo.routers.createStatusHistory = async () => {
      throw new Error('synthetic status audit failure');
    };
    try {
      await expect(
        routers.transition(
          router.id,
          { status: 'RETURNED', targetWarehouseId: warehouseId, reason: 'Returned' },
          actorId,
        ),
      ).rejects.toThrow('synthetic status audit failure');
    } finally {
      repo.routers.createStatusHistory = original;
    }
    expect((await routers.findById(router.id)).status).toBe('ASSIGNED_TO_TECHNICIAN');
    expect((await repo.routers.findActiveAssignment(router.id))?.holderType).toBe('TECHNICIAN');
    expect(await repo.routers.findStatusHistory(router.id)).toHaveLength(0);
  });

  it('rolls back assignment, stock and custody when assignment audit or late step fails', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    const original = repo.routers.createAssignment.bind(repo.routers);
    repo.routers.createAssignment = async () => {
      throw new Error('synthetic assignment failure');
    };
    try {
      await expect(routers.assign(router.id, { technicianId }, actorId)).rejects.toThrow(
        'synthetic assignment failure',
      );
    } finally {
      repo.routers.createAssignment = original;
    }
    expect((await routers.findById(router.id)).status).toBe('AVAILABLE');
    expect((await repo.routers.findActiveAssignment(router.id))?.holderType).toBe('WAREHOUSE');
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
    expect(await repo.routers.findAssignmentsByRouter(router.id)).toHaveLength(1);
  });

  it('rolls back condition change, location and custody when condition audit fails', async () => {
    const productId = await product();
    const router = await routers.create(
      { productId, warehouseId, serialNumber: randomUUID(), isNewReceipt: true },
      actorId,
    );
    const original = repo.routers.createConditionHistory.bind(repo.routers);
    repo.routers.createConditionHistory = async () => {
      throw new Error('synthetic condition audit failure');
    };
    try {
      await expect(
        routers.updateCondition(
          router.id,
          { physicalCondition: 'DAMAGED', reason: 'Synthetic damage' },
          actorId,
        ),
      ).rejects.toThrow('synthetic condition audit failure');
    } finally {
      repo.routers.createConditionHistory = original;
    }
    expect((await routers.findById(router.id)).physicalCondition).toBe('SERVICEABLE');
    expect(await repo.routers.findConditionHistory(router.id)).toHaveLength(0);
    expect((await inventoryRepo.getStock(warehouseId, productId))?.quantity).toBe(1);
  });

  it('rejects outbound movement on insufficient stock without recording movement or zero-stock row', async () => {
    const productId = await product();
    const targetWh = randomUUID();
    await db.insert(schema.warehouses).values({ id: targetWh, name: 'Synthetic zero stock' });

    await expect(
      inventoryRepo.recordMovementWithDelta(
        {
          warehouseId: targetWh,
          productId,
          movementType: 'OUTBOUND_TECHNICIAN',
          quantity: 1,
          responsibleUserId: actorId,
        },
        -1,
      ),
    ).rejects.toThrow(/Insufficient stock in warehouse/);

    const stock = await inventoryRepo.getStock(targetWh, productId);
    expect(stock).toBeUndefined();

    const movements = await db
      .select()
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.warehouseId, targetWh));
    expect(movements).toHaveLength(0);
  });
});
