import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Role } from '@alfahd/types';
import { setupTestApp, getAuthHeader } from './test-utils.js';
import {
  makeRouter,
  makeCreateRouterDto,
  makeAssignRouterDto,
  makeUpdateRouterConditionDto,
  makeTransitionRouterDto,
} from './fakers/index.js';
import { envelopeData } from './utils/supertest.util.js';
import { RepositoryService } from '../src/modules/repository/repository.service.js';
import type {
  Router,
  RouterAssignment,
  RouterConditionHistory,
  WarehouseInventory,
  NewStockMovement,
} from '../src/database/schema/index.js';

describe('Routers (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const WAREHOUSE_ACTIVE_ID = '11111111-1111-4111-8111-111111111111';
  const WAREHOUSE_INACTIVE_ID = '22222222-2222-4222-8222-222222222222';
  const PRODUCT_ROUTER_ID = '33333333-3333-4333-8333-333333333333';
  const TECH_USER_ID = '44444444-4444-4444-8444-444444444444';
  const ROUTER_1_ID = '55555555-5555-4555-8555-555555555555';
  const ROUTER_ASSIGNED_ID = '66666666-6666-4666-8666-666666666666';
  const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';

  let routerStore: Router[] = [];
  let assignmentStore: RouterAssignment[] = [];
  const conditionHistoryStore: RouterConditionHistory[] = [];
  let stockStore: WarehouseInventory[] = [];

  const mockReportsQueue = {
    add: vi.fn(async () => ({ id: 'mock-report-job-id' })),
  };

  const mockRepositoryService = {
    transaction: async (cb: (tx: any) => Promise<any>) => cb({}),
    routers: {
      findBySerialNumber: async (serial: string) => {
        return routerStore.find((r) => r.serialNumber.toLowerCase() === serial.toLowerCase());
      },
      findById: async (id: string) => {
        return routerStore.find((r) => r.id === id);
      },
      findManyWithPagination: async (params: {
        warehouseId?: string;
        productId?: string;
        technicianId?: string;
        status?: string;
        physicalCondition?: string;
        brand?: string;
        search?: string;
        limit: number;
        offset: number;
      }) => {
        let items = [...routerStore];
        if (params.status) {
          items = items.filter((r) => r.status === params.status);
        }
        if (params.physicalCondition) {
          items = items.filter((r) => r.physicalCondition === params.physicalCondition);
        }
        if (params.search) {
          const s = params.search.toLowerCase();
          items = items.filter((r) => r.serialNumber.toLowerCase().includes(s));
        }
        return {
          items: items.slice(params.offset, params.offset + params.limit),
          total: items.length,
        };
      },
      createRouter: async (data: Partial<Router>) => {
        const created: Router = {
          id: data.id ?? '77777777-7777-4777-8777-777777777777',
          serialNumber: data.serialNumber!,
          productId: data.productId!,
          status: data.status ?? 'AVAILABLE',
          physicalCondition: data.physicalCondition ?? 'SERVICEABLE',
          warehouseId: data.warehouseId ?? null,
          externalLocation: data.externalLocation ?? null,
          notes: data.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        routerStore.push(created);
        return created;
      },
      updateRouter: async (id: string, updates: Partial<Router>) => {
        const idx = routerStore.findIndex((r) => r.id === id);
        if (idx === -1) return undefined;
        routerStore[idx] = {
          ...routerStore[idx],
          ...updates,
          updatedAt: new Date(),
        };
        return routerStore[idx];
      },
      createAssignment: async (data: Partial<RouterAssignment>) => {
        const created: RouterAssignment = {
          id: 'assign-' + Math.random().toString(36).substring(2, 9),
          routerId: data.routerId!,
          holderType: data.holderType ?? 'WAREHOUSE',
          warehouseId: data.warehouseId ?? null,
          technicianId: data.technicianId ?? null,
          assignedBy: data.assignedBy!,
          assignedAt: data.assignedAt ?? new Date(),
          releasedAt: data.releasedAt ?? null,
          notes: data.notes ?? null,
        };
        assignmentStore.push(created);
        return created;
      },
      findActiveAssignment: async (routerId: string) => {
        return assignmentStore.find((a) => a.routerId === routerId && a.releasedAt === null);
      },
      releaseActiveAssignment: async (routerId: string) => {
        const active = assignmentStore.find(
          (a) => a.routerId === routerId && a.releasedAt === null,
        );
        if (active) {
          active.releasedAt = new Date();
          return active;
        }
        return undefined;
      },
      findAssignmentsByRouter: async (routerId: string) => {
        return assignmentStore.filter((a) => a.routerId === routerId);
      },
      createConditionHistory: async (data: Partial<RouterConditionHistory>) => {
        const created: RouterConditionHistory = {
          id: 'cond-' + Math.random().toString(36).substring(2, 9),
          routerId: data.routerId!,
          fromCondition: data.fromCondition!,
          toCondition: data.toCondition!,
          fromWarehouseId: data.fromWarehouseId ?? null,
          toWarehouseId: data.toWarehouseId ?? null,
          externalLocation: data.externalLocation ?? null,
          changedBy: data.changedBy!,
          reason: data.reason ?? '',
          createdAt: new Date(),
        };
        conditionHistoryStore.push(created);
        return created;
      },
      findConditionHistory: async (routerId: string) => {
        return conditionHistoryStore.filter((c) => c.routerId === routerId);
      },
    },
    warehouses: {
      findById: async (id: string) => {
        if (id === WAREHOUSE_ACTIVE_ID) {
          return { id, name: 'Main Hub', isActive: true };
        }
        if (id === WAREHOUSE_INACTIVE_ID) {
          return { id, name: 'Old Hub', isActive: false };
        }
        return undefined;
      },
    },
    products: {
      findById: async (id: string) => {
        if (id === PRODUCT_ROUTER_ID) {
          return { id, name: 'Standard Router', sku: 'RTR-STD-01', isActive: true };
        }
        return undefined;
      },
      findBySku: async () => undefined,
    },
    inventory: {
      getStock: async (warehouseId: string, productId: string) => {
        return (
          stockStore.find((s) => s.warehouseId === warehouseId && s.productId === productId) ?? {
            id: 'inv-def',
            warehouseId,
            productId,
            quantity: 10,
            updatedAt: new Date(),
          }
        );
      },
      recordMovementInTransaction: async (movement: NewStockMovement, newQuantity: number) => {
        let stock = stockStore.find(
          (s) => s.warehouseId === movement.warehouseId && s.productId === movement.productId,
        );
        if (!stock) {
          stock = {
            id: 'inv-stock-1',
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
        return { id: 'mov-1', ...movement, createdAt: new Date() };
      },
    },
  };

  beforeAll(async () => {
    routerStore = [
      makeRouter({
        id: ROUTER_1_ID,
        serialNumber: 'SN-AVAILABLE-001',
        productId: PRODUCT_ROUTER_ID,
        status: 'AVAILABLE',
        physicalCondition: 'SERVICEABLE',
        warehouseId: WAREHOUSE_ACTIVE_ID,
      }),
      makeRouter({
        id: ROUTER_ASSIGNED_ID,
        serialNumber: 'SN-ASSIGNED-002',
        productId: PRODUCT_ROUTER_ID,
        status: 'ASSIGNED_TO_TECHNICIAN',
        physicalCondition: 'SERVICEABLE',
        warehouseId: null,
      }),
    ];

    assignmentStore = [
      {
        id: 'init-assignment-wh-1',
        routerId: ROUTER_1_ID,
        holderType: 'WAREHOUSE',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        technicianId: null,
        assignedBy: 'admin-seed',
        assignedAt: new Date(),
        releasedAt: null,
        notes: 'Initial warehouse receipt',
      },
      {
        id: 'init-assignment-tech-2',
        routerId: ROUTER_ASSIGNED_ID,
        holderType: 'TECHNICIAN',
        warehouseId: null,
        technicianId: TECH_USER_ID,
        assignedBy: 'admin-seed',
        assignedAt: new Date(),
        releasedAt: null,
        notes: 'Initial tech assignment',
      },
    ];

    stockStore = [
      {
        id: 'inv-1',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        productId: PRODUCT_ROUTER_ID,
        quantity: 15,
        updatedAt: new Date(),
      },
    ];

    const testApp = await setupTestApp({
      overrideProviders: [
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
        {
          provide: getQueueToken('reports'),
          useValue: mockReportsQueue,
        },
      ],
    });

    app = testApp.app;
    jwtService = testApp.moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Authentication & RBAC', () => {
    it('returns 401 Unauthorized when request lacks JWT token', async () => {
      await request(app.getHttpServer()).get('/routers').expect(401);
    });

    it('returns 200 OK when TECHNICIAN reads router list', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      const res = await request(app.getHttpServer()).get('/routers').set(auth).expect(200);

      expect(res.body.data.items).toBeDefined();
    });

    it('returns 200 OK when CS reads router details by ID', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      const res = await request(app.getHttpServer())
        .get(`/routers/${ROUTER_1_ID}`)
        .set(auth)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: ROUTER_1_ID,
        serialNumber: 'SN-AVAILABLE-001',
      });
    });

    it('returns 403 Forbidden when CS attempts to register a router', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(
          makeCreateRouterDto({
            productId: PRODUCT_ROUTER_ID,
            warehouseId: WAREHOUSE_ACTIVE_ID,
          }),
        )
        .expect(403);
    });

    it('returns 403 Forbidden when TECHNICIAN attempts to register a router', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(
          makeCreateRouterDto({
            productId: PRODUCT_ROUTER_ID,
            warehouseId: WAREHOUSE_ACTIVE_ID,
          }),
        )
        .expect(403);
    });

    it('returns 403 Forbidden when WAREHOUSE_STAFF attempts to export router report', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      await request(app.getHttpServer())
        .post('/routers/export')
        .set(auth)
        .send({ warehouseId: WAREHOUSE_ACTIVE_ID })
        .expect(403);
    });

    it('allows ADMIN to export router report', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/routers/export')
        .set(auth)
        .send({ warehouseId: WAREHOUSE_ACTIVE_ID })
        .expect(200);

      expect(res.body.data).toHaveProperty('jobId');
      expect(mockReportsQueue.add).toHaveBeenCalled();
    });
  });

  describe('Router Registration (Creation)', () => {
    it('allows WAREHOUSE_STAFF to register a router with 201 Created', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const dto = makeCreateRouterDto({
        serialNumber: 'SN-NEW-999',
        productId: PRODUCT_ROUTER_ID,
        warehouseId: WAREHOUSE_ACTIVE_ID,
        isNewReceipt: true,
      });

      const res = await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(dto)
        .expect(201);

      const data = envelopeData<any>(res);
      expect(data).toMatchObject({
        serialNumber: 'SN-NEW-999',
        status: 'AVAILABLE',
        physicalCondition: 'SERVICEABLE',
        warehouseId: WAREHOUSE_ACTIVE_ID,
      });
    });

    it('returns 409 Conflict when serial number already exists', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const dto = makeCreateRouterDto({
        serialNumber: 'SN-AVAILABLE-001',
        productId: PRODUCT_ROUTER_ID,
        warehouseId: WAREHOUSE_ACTIVE_ID,
      });

      const res = await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(dto)
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });

    it('returns 400 Bad Request when warehouse is inactive', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const dto = makeCreateRouterDto({
        serialNumber: 'SN-UNIQUE-987',
        productId: PRODUCT_ROUTER_ID,
        warehouseId: WAREHOUSE_INACTIVE_ID,
      });

      const res = await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(dto)
        .expect(400);

      expect(res.body.message).toContain('deactivated');
    });

    it('returns 400 Bad Request when serialNumber is missing', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send({
          productId: PRODUCT_ROUTER_ID,
          warehouseId: WAREHOUSE_ACTIVE_ID,
        })
        .expect(400);
    });
  });

  describe('Custody Assignment & Handoff', () => {
    it('assigns an AVAILABLE router to a technician and sets status to ASSIGNED_TO_TECHNICIAN', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const dto = makeAssignRouterDto({ technicianId: TECH_USER_ID, notes: 'Field deploy' });

      const res = await request(app.getHttpServer())
        .post(`/routers/${ROUTER_1_ID}/assign`)
        .set(auth)
        .send(dto)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: ROUTER_1_ID,
        status: 'ASSIGNED_TO_TECHNICIAN',
        currentHolderType: 'TECHNICIAN',
        currentHolderId: TECH_USER_ID,
      });
    });

    it('returns 409 Conflict when attempting to assign a router already assigned', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const dto = makeAssignRouterDto({ technicianId: TECH_USER_ID });

      const res = await request(app.getHttpServer())
        .post(`/routers/${ROUTER_ASSIGNED_ID}/assign`)
        .set(auth)
        .send(dto)
        .expect(409);

      expect(res.body.message).toContain('not available for assignment');
    });

    it('retrieves assignment custody history for a router', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const res = await request(app.getHttpServer())
        .get(`/routers/${ROUTER_ASSIGNED_ID}/assignments`)
        .set(auth)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Lifecycle State Machine & Whitelist Transitions', () => {
    it('transitions an ASSIGNED_TO_TECHNICIAN router to RETURNED along the approved whitelist', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const dto = makeTransitionRouterDto({
        status: 'RETURNED',
        reason: 'Customer replaced router',
        targetWarehouseId: WAREHOUSE_ACTIVE_ID,
      });

      const res = await request(app.getHttpServer())
        .patch(`/routers/${ROUTER_ASSIGNED_ID}/transition`)
        .set(auth)
        .send(dto)
        .expect(200);

      expect(res.body.data.status).toBe('RETURNED');
    });

    it('returns 400 Bad Request when attempting an illegal transition (RETURNED -> INSTALLED_AT_CUSTOMER)', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const dto = makeTransitionRouterDto({
        status: 'INSTALLED_AT_CUSTOMER',
        reason: 'Direct jump not allowed',
      });

      const res = await request(app.getHttpServer())
        .patch(`/routers/${ROUTER_ASSIGNED_ID}/transition`)
        .set(auth)
        .send(dto)
        .expect(400);

      expect(res.body.message).toContain('Invalid status transition');
    });
  });

  describe('Physical Condition & Warehouse Stock Delta', () => {
    it('updates physical condition and logs audit trail', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const dto = makeUpdateRouterConditionDto({
        physicalCondition: 'DAMAGED',
        reason: 'Dropped during inspection',
      });

      const res = await request(app.getHttpServer())
        .patch(`/routers/${ROUTER_1_ID}/condition`)
        .set(auth)
        .send(dto)
        .expect(200);

      expect(res.body.data.physicalCondition).toBe('DAMAGED');
    });

    it('retrieves condition audit history for the router', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const res = await request(app.getHttpServer())
        .get(`/routers/${ROUTER_1_ID}/condition-history`)
        .set(auth)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].toCondition).toBe('DAMAGED');
    });
  });

  describe('Edge Cases', () => {
    it('returns 404 Not Found for non-existent router ID', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer()).get(`/routers/${NON_EXISTENT_ID}`).set(auth).expect(404);
    });

    it('returns 400 Bad Request for malformed UUID', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer()).get('/routers/invalid-uuid-123').set(auth).expect(400);
    });
  });
});
