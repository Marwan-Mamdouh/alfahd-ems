import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Role } from '@alfahd/types';
import { setupTestApp, getAuthHeader, createAuthToken } from './test-utils.js';
import { makeInboundStockDto } from './fakers/index.js';
import { envelopeData } from './utils/supertest.util.js';
import { RepositoryService } from '../src/modules/repository/repository.service.js';
import type {
  WarehouseInventory,
  StockMovement,
  NewStockMovement,
} from '../src/entities/inventory.entity.js';

describe('Inventory (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const WAREHOUSE_A_ID = '11111111-1111-4111-8111-111111111111';
  const WAREHOUSE_B_ID = '22222222-2222-4222-8222-222222222222';
  const PRODUCT_X_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const TECHNICIAN_ID = '44444444-4444-4444-8444-444444444444';
  const STAFF_USER_ID = '55555555-5555-4555-8555-555555555555';
  const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';

  let stockStore: WarehouseInventory[] = [];
  let movementsStore: StockMovement[] = [];

  const mockRepositoryService = {
    warehouses: {
      findById: async (id: string) => {
        if (id === WAREHOUSE_A_ID || id === WAREHOUSE_B_ID) {
          return { id, name: `Warehouse ${id.substring(0, 4)}`, isActive: true };
        }
        return undefined;
      },
    },
    products: {
      findById: async (id: string) => {
        if (id === PRODUCT_X_ID) {
          return { id, name: 'Optic Cable', sku: 'OPT-100', isActive: true };
        }
        return undefined;
      },
    },
    inventory: {
      getStock: async (warehouseId: string, productId: string) => {
        return stockStore.find(
          (s) => s.warehouseId === warehouseId && s.productId === productId,
        );
      },
      recordMovementInTransaction: async (movement: NewStockMovement, newQuantity: number) => {
        let stock = stockStore.find(
          (s) => s.warehouseId === movement.warehouseId && s.productId === movement.productId,
        );
        if (!stock) {
          stock = {
            id: 'inv-' + Math.random().toString(36).substring(2, 9),
            warehouseId: movement.warehouseId,
            productId: movement.productId,
            quantity: newQuantity,
            updatedAt: new Date(),
          };
          stockStore.push(stock);
        } else {
          stock.quantity = newQuantity;
          stock.updatedAt = new Date();
        }

        const createdMovement: StockMovement = {
          id: 'mov-' + Math.random().toString(36).substring(2, 9),
          warehouseId: movement.warehouseId,
          productId: movement.productId,
          movementType: movement.movementType,
          quantity: movement.quantity,
          technicianId: movement.technicianId ?? null,
          supplierName: movement.supplierName ?? null,
          responsibleUserId: movement.responsibleUserId,
          notes: movement.notes ?? null,
          createdAt: new Date(),
        };
        movementsStore.push(createdMovement);

        return { inventory: stock, movement: createdMovement };
      },
      executeTransferInTransaction: async (
        fromWarehouseId: string,
        toWarehouseId: string,
        productId: string,
        _quantity: number,
        sourceNewQty: number,
        destNewQty: number,
        movementOut: NewStockMovement,
        movementIn: NewStockMovement,
      ) => {
        const source = stockStore.find(
          (s) => s.warehouseId === fromWarehouseId && s.productId === productId,
        )!;
        source.quantity = sourceNewQty;

        let dest = stockStore.find(
          (s) => s.warehouseId === toWarehouseId && s.productId === productId,
        );
        if (!dest) {
          dest = {
            id: 'inv-' + Math.random().toString(36).substring(2, 9),
            warehouseId: toWarehouseId,
            productId,
            quantity: destNewQty,
            updatedAt: new Date(),
          };
          stockStore.push(dest);
        } else {
          dest.quantity = destNewQty;
        }

        const movOut: StockMovement = {
          id: 'mov-' + Math.random().toString(36).substring(2, 9),
          warehouseId: movementOut.warehouseId,
          productId: movementOut.productId,
          movementType: movementOut.movementType,
          quantity: movementOut.quantity,
          technicianId: null,
          supplierName: null,
          responsibleUserId: movementOut.responsibleUserId,
          notes: movementOut.notes ?? null,
          createdAt: new Date(),
        };
        const movIn: StockMovement = {
          id: 'mov-' + Math.random().toString(36).substring(2, 9),
          warehouseId: movementIn.warehouseId,
          productId: movementIn.productId,
          movementType: movementIn.movementType,
          quantity: movementIn.quantity,
          technicianId: null,
          supplierName: null,
          responsibleUserId: movementIn.responsibleUserId,
          notes: movementIn.notes ?? null,
          createdAt: new Date(),
        };
        movementsStore.push(movOut, movIn);

        return { sourceInventory: source, destInventory: dest };
      },
      findManyInventory: async () => {
        return {
          items: stockStore.map((s) => ({
            ...s,
            productName: 'Optic Cable',
            sku: 'OPT-100',
            warehouseName: 'Warehouse 1111',
          })),
          total: stockStore.length,
        };
      },
      findManyMovements: async () => {
        return {
          items: movementsStore,
          total: movementsStore.length,
        };
      },
      findMovementById: async (id: string) => {
        return movementsStore.find((m) => m.id === id);
      },
    },
  };

  beforeAll(async () => {
    stockStore = [
      {
        id: 'inv-init-1',
        warehouseId: WAREHOUSE_A_ID,
        productId: PRODUCT_X_ID,
        quantity: 100,
        updatedAt: new Date(),
      },
    ];
    movementsStore = [];

    const testApp = await setupTestApp({
      overrideProviders: [
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
      ],
    });

    app = testApp.app;
    jwtService = testApp.moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Authentication & Authorization (RBAC)', () => {
    it('returns 401 Unauthorized when request lacks JWT token', async () => {
      await request(app.getHttpServer()).get('/inventory').expect(401);
    });

    it('returns 403 Forbidden when TECHNICIAN attempts to query inventory', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      await request(app.getHttpServer()).get('/inventory').set(auth).expect(403);
    });

    it('returns 200 OK when CS queries inventory', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      const res = await request(app.getHttpServer()).get('/inventory').set(auth).expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data.items).toBeDefined();
    });

    it('returns 200 OK when WAREHOUSE_STAFF queries warehouse stock', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const res = await request(app.getHttpServer())
        .get(`/inventory/warehouses/${WAREHOUSE_A_ID}`)
        .set(auth)
        .expect(200);

      expect(res.body.data.items).toBeDefined();
    });

    it('returns 403 Forbidden when CS attempts inbound stock receipt', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      await request(app.getHttpServer())
        .post('/inventory/inbound')
        .set(auth)
        .send({
          warehouseId: WAREHOUSE_A_ID,
          productId: PRODUCT_X_ID,
          quantity: 10,
          supplierName: 'FastOptics',
        })
        .expect(403);
    });

    it('returns 403 Forbidden when WAREHOUSE_STAFF attempts stock adjust', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      await request(app.getHttpServer())
        .post('/inventory/adjust')
        .set(auth)
        .send({
          warehouseId: WAREHOUSE_A_ID,
          productId: PRODUCT_X_ID,
          newQuantity: 80,
          notes: 'Routine audit discrepancy correction',
        })
        .expect(403);
    });

    it('allows ADMIN to perform stock adjust with 200 OK', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/inventory/adjust')
        .set(auth)
        .send({
          warehouseId: WAREHOUSE_A_ID,
          productId: PRODUCT_X_ID,
          newQuantity: 95,
          notes: 'Annual inventory audit adjustment',
        })
        .expect(200);

      expect(res.body.data.inventory.quantity).toBe(95);
    });
  });

  describe('User Context Injection (@CurrentUser)', () => {
    it('automatically binds authenticated user id as responsibleUserId', async () => {
      const token = createAuthToken(jwtService, {
        role: Role.WAREHOUSE_STAFF,
        userId: STAFF_USER_ID,
      });

      const payload = makeInboundStockDto({
        warehouseId: WAREHOUSE_A_ID,
        productId: PRODUCT_X_ID,
        quantity: 20,
        supplierName: 'Global Telecom Supplies',
      });

      const res = await request(app.getHttpServer())
        .post('/inventory/inbound')
        .set({ Authorization: `Bearer ${token}` })
        .send(payload)
        .expect(201);

      const data = envelopeData<{ movement: StockMovement }>(res);
      expect(data.movement.responsibleUserId).toBe(STAFF_USER_ID);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('returns 400 Bad Request when inbound quantity is zero or negative', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .post('/inventory/inbound')
        .set(auth)
        .send({
          warehouseId: WAREHOUSE_A_ID,
          productId: PRODUCT_X_ID,
          quantity: 0,
          supplierName: 'Test Supplier',
        })
        .expect(400);
    });

    it('returns 404 Not Found when inbound targets non-existent warehouse', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .post('/inventory/inbound')
        .set(auth)
        .send({
          warehouseId: NON_EXISTENT_ID,
          productId: PRODUCT_X_ID,
          quantity: 10,
          supplierName: 'Test Supplier',
        })
        .expect(404);
    });

    it('returns 400 Bad Request when outbound exceeds available stock', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/inventory/outbound')
        .set(auth)
        .send({
          warehouseId: WAREHOUSE_A_ID,
          productId: PRODUCT_X_ID,
          technicianId: TECHNICIAN_ID,
          quantity: 99999,
        })
        .expect(400);

      expect(res.body.message).toContain('Insufficient stock');
    });

    it('returns 400 Bad Request when transfer specifies same source and destination warehouse', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/inventory/transfer')
        .set(auth)
        .send({
          fromWarehouseId: WAREHOUSE_A_ID,
          toWarehouseId: WAREHOUSE_A_ID,
          productId: PRODUCT_X_ID,
          quantity: 5,
        })
        .expect(400);

      expect(res.body.message).toContain('same warehouse');
    });

    it('successfully processes stock transfer between warehouses with 200 OK', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/inventory/transfer')
        .set(auth)
        .send({
          fromWarehouseId: WAREHOUSE_A_ID,
          toWarehouseId: WAREHOUSE_B_ID,
          productId: PRODUCT_X_ID,
          quantity: 15,
        })
        .expect(200);

      expect(res.body.data.destInventory.quantity).toBe(15);
    });
  });
});
