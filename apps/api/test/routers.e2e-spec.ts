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
  const WAREHOUSE_SECONDARY_ID = '33332222-1111-4444-8888-999900001111';
  const WAREHOUSE_INACTIVE_ID = '22222222-2222-4222-8222-222222222222';
  const PRODUCT_ROUTER_ID = '33333333-3333-4333-8333-333333333333';
  const TECH_USER_ID = '44444444-4444-4444-8444-444444444444';
  const ROUTER_1_ID = '55555555-5555-4555-8555-555555555555';
  const ROUTER_ASSIGNED_ID = '66666666-6666-4666-8666-666666666666';
  const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';
  const ZERO_STOCK_PRODUCT_ID = '00000000-0000-4000-8000-000000000099';
  const LIMITED_PRODUCT_ID = '11112222-3333-4444-8555-666677778888';
  const RECONCILE_PRODUCT_ID = '77778888-9999-4444-8888-111122223333';

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
      findByIdForUpdate: async (id: string) => {
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
      countRegisteredUsableInWarehouse: async (warehouseId: string, productId: string) => {
        return routerStore.filter(
          (r) =>
            r.warehouseId === warehouseId &&
            r.productId === productId &&
            r.status === 'AVAILABLE' &&
            r.physicalCondition === 'SERVICEABLE',
        ).length;
      },
    },
    warehouses: {
      findById: async (id: string) => {
        if (id === WAREHOUSE_ACTIVE_ID) {
          return { id, name: 'Main Hub', isActive: true };
        }
        if (id === WAREHOUSE_SECONDARY_ID) {
          return { id, name: 'Secondary Hub', isActive: true };
        }
        if (id === WAREHOUSE_INACTIVE_ID) {
          return { id, name: 'Old Hub', isActive: false };
        }
        return undefined;
      },
      findByIdForUpdate: async (id: string) => {
        if (id === WAREHOUSE_ACTIVE_ID) {
          return { id, name: 'Main Hub', isActive: true };
        }
        if (id === WAREHOUSE_SECONDARY_ID) {
          return { id, name: 'Secondary Hub', isActive: true };
        }
        if (id === WAREHOUSE_INACTIVE_ID) {
          return { id, name: 'Old Hub', isActive: false };
        }
        return undefined;
      },
    },
    products: {
      findById: async (id: string) => {
        if (
          id === PRODUCT_ROUTER_ID ||
          id === ZERO_STOCK_PRODUCT_ID ||
          id === LIMITED_PRODUCT_ID ||
          id === RECONCILE_PRODUCT_ID
        ) {
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
      getStockForUpdate: async (warehouseId: string, productId: string) => {
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
      recordMovementWithDelta: async (movement: NewStockMovement, delta: number) => {
        let stock = stockStore.find(
          (s) => s.warehouseId === movement.warehouseId && s.productId === movement.productId,
        );
        if (!stock) {
          stock = {
            id: 'inv-stock-delta',
            warehouseId: movement.warehouseId,
            productId: movement.productId,
            quantity: Math.max(0, delta),
            updatedAt: new Date(),
          };
          stockStore.push(stock);
        } else {
          stock.quantity = Math.max(0, stock.quantity + delta);
          stock.updatedAt = new Date();
        }
        return { inventory: stock, movement: { id: 'mov-1', ...movement, createdAt: new Date() } };
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

    it('returns 409 Conflict when onboarding existing stock against zero opening stock', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);

      // Ensure mock inventory returns 0 for this combination
      stockStore.push({
        id: 'inv-zero',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        productId: ZERO_STOCK_PRODUCT_ID,
        quantity: 0,
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(
          makeCreateRouterDto({
            serialNumber: 'SN-ZERO-STOCK-TEST',
            productId: ZERO_STOCK_PRODUCT_ID,
            warehouseId: WAREHOUSE_ACTIVE_ID,
            isNewReceipt: false,
          }),
        )
        .expect(409);

      expect(res.body.message).toContain('0 recorded stock');
    });

    it('returns 409 Conflict when onboarding existing stock exceeds eligible capacity', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);

      // Set quantity to 1
      stockStore.push({
        id: 'inv-limited',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        productId: LIMITED_PRODUCT_ID,
        quantity: 1,
        updatedAt: new Date(),
      });

      // Insert 1 router already registered for this product
      routerStore.push(
        makeRouter({
          serialNumber: 'SN-ALREADY-TAKEN',
          productId: LIMITED_PRODUCT_ID,
          warehouseId: WAREHOUSE_ACTIVE_ID,
          status: 'AVAILABLE',
          physicalCondition: 'SERVICEABLE',
        }),
      );

      // Attempting to register another existing unit must fail with 409
      const res = await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(
          makeCreateRouterDto({
            serialNumber: 'SN-EXCEED-CAPACITY',
            productId: LIMITED_PRODUCT_ID,
            warehouseId: WAREHOUSE_ACTIVE_ID,
            isNewReceipt: false,
          }),
        )
        .expect(409);

      expect(res.body.message).toContain('already have registered serial numbers');
    });

    it('reconciles a damaged opening unit by recording ADJUSTMENT movement (-1) without new receipt', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);

      stockStore.push({
        id: 'inv-reconcile',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        productId: RECONCILE_PRODUCT_ID,
        quantity: 5,
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post('/routers')
        .set(auth)
        .send(
          makeCreateRouterDto({
            serialNumber: 'SN-DAMAGED-RECONCILE',
            productId: RECONCILE_PRODUCT_ID,
            warehouseId: WAREHOUSE_ACTIVE_ID,
            isNewReceipt: false,
            physicalCondition: 'DAMAGED',
            notes: 'Damaged opening stock inspection',
          }),
        )
        .expect(201);

      const data = envelopeData<any>(res);
      expect(data.physicalCondition).toBe('DAMAGED');
      expect(data.status).toBe('AVAILABLE');

      // Verify stock was adjusted down by 1
      const updatedStock = stockStore.find(
        (s) => s.warehouseId === WAREHOUSE_ACTIVE_ID && s.productId === RECONCILE_PRODUCT_ID,
      );
      expect(updatedStock?.quantity).toBe(4);
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

    it('A-to-B move decrements A, increments B and moves custody once', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const ROUTER_MOVE_ID = '99991111-2222-4333-8444-555566667777';

      // Insert available, serviceable router at WAREHOUSE_ACTIVE_ID
      routerStore.push(
        makeRouter({
          id: ROUTER_MOVE_ID,
          serialNumber: 'SN-MOVE-A-B',
          productId: PRODUCT_ROUTER_ID,
          warehouseId: WAREHOUSE_ACTIVE_ID,
          status: 'AVAILABLE',
          physicalCondition: 'SERVICEABLE',
        }),
      );

      // Add custody assignment at WAREHOUSE_ACTIVE_ID
      assignmentStore.push({
        id: 'assign-move-init',
        routerId: ROUTER_MOVE_ID,
        holderType: 'WAREHOUSE',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        technicianId: null,
        assignedBy: 'seed-admin',
        assignedAt: new Date(),
        releasedAt: null,
        notes: 'Initial warehouse custody',
      });

      // Ensure stock exists in both warehouses
      const stockA = stockStore.find(
        (s) => s.warehouseId === WAREHOUSE_ACTIVE_ID && s.productId === PRODUCT_ROUTER_ID,
      ) ?? {
        id: 'inv-a',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        productId: PRODUCT_ROUTER_ID,
        quantity: 10,
        updatedAt: new Date(),
      };
      if (!stockStore.includes(stockA)) stockStore.push(stockA);
      const initialQtyA = stockA.quantity;

      let stockB = stockStore.find(
        (s) => s.warehouseId === WAREHOUSE_SECONDARY_ID && s.productId === PRODUCT_ROUTER_ID,
      );
      if (!stockB) {
        stockB = {
          id: 'inv-b',
          warehouseId: WAREHOUSE_SECONDARY_ID,
          productId: PRODUCT_ROUTER_ID,
          quantity: 5,
          updatedAt: new Date(),
        };
        stockStore.push(stockB);
      }
      const initialQtyB = stockB.quantity;

      const res = await request(app.getHttpServer())
        .patch(`/routers/${ROUTER_MOVE_ID}/condition`)
        .set(auth)
        .send(
          makeUpdateRouterConditionDto({
            physicalCondition: 'SERVICEABLE',
            warehouseId: WAREHOUSE_SECONDARY_ID,
            reason: 'Inter-warehouse stock rebalance to Secondary Hub',
          }),
        )
        .expect(200);

      // Router now located at Secondary Hub with warehouse custody
      expect(res.body.data.warehouseId).toBe(WAREHOUSE_SECONDARY_ID);
      expect(res.body.data.currentHolderType).toBe('WAREHOUSE');
      expect(res.body.data.currentHolderId).toBe(WAREHOUSE_SECONDARY_ID);

      // Decremented A, incremented B
      expect(stockA.quantity).toBe(initialQtyA - 1);
      expect(stockB.quantity).toBe(initialQtyB + 1);

      // Verify active assignment moved
      const prevAssignment = assignmentStore.find((a) => a.id === 'assign-move-init');
      expect(prevAssignment?.releasedAt).not.toBeNull();
      const currentAssignment = assignmentStore.find(
        (a) => a.routerId === ROUTER_MOVE_ID && a.releasedAt === null,
      );
      expect(currentAssignment?.warehouseId).toBe(WAREHOUSE_SECONDARY_ID);
    });

    it('removes usable contribution and applicable custody when condition changes directly to UNDER_REPAIR', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const ROUTER_REPAIR_ID = '88882222-3333-4444-8555-666677778888';

      routerStore.push(
        makeRouter({
          id: ROUTER_REPAIR_ID,
          serialNumber: 'SN-DIRECT-REPAIR',
          productId: PRODUCT_ROUTER_ID,
          warehouseId: WAREHOUSE_ACTIVE_ID,
          status: 'AVAILABLE',
          physicalCondition: 'SERVICEABLE',
        }),
      );

      assignmentStore.push({
        id: 'assign-repair-init',
        routerId: ROUTER_REPAIR_ID,
        holderType: 'WAREHOUSE',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        technicianId: null,
        assignedBy: 'seed-admin',
        assignedAt: new Date(),
        releasedAt: null,
        notes: 'Initial custody',
      });

      const stock = stockStore.find(
        (s) => s.warehouseId === WAREHOUSE_ACTIVE_ID && s.productId === PRODUCT_ROUTER_ID,
      )!;
      const initialStock = stock.quantity;

      const res = await request(app.getHttpServer())
        .patch(`/routers/${ROUTER_REPAIR_ID}/condition`)
        .set(auth)
        .send(
          makeUpdateRouterConditionDto({
            physicalCondition: 'UNDER_REPAIR',
            reason: 'Diagnosed with faulty ethernet switch',
          }),
        )
        .expect(200);

      expect(res.body.data.physicalCondition).toBe('UNDER_REPAIR');
      expect(res.body.data.currentHolderType).toBeNull();
      expect(res.body.data.currentHolderId).toBeNull();

      // Stock decremented by 1
      expect(stock.quantity).toBe(initialStock - 1);

      // Active custody released
      const activeAssignment = assignmentStore.find(
        (a) => a.routerId === ROUTER_REPAIR_ID && a.releasedAt === null,
      );
      expect(activeAssignment).toBeUndefined();
    });

    it('clears physical warehouse placement while retaining auditable prior location when sent for external repair', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const ROUTER_EXT_ID = '77773333-4444-4555-8666-777788889999';

      routerStore.push(
        makeRouter({
          id: ROUTER_EXT_ID,
          serialNumber: 'SN-EXTERNAL-REPAIR',
          productId: PRODUCT_ROUTER_ID,
          warehouseId: WAREHOUSE_ACTIVE_ID,
          status: 'AVAILABLE',
          physicalCondition: 'UNDER_REPAIR',
        }),
      );

      const res = await request(app.getHttpServer())
        .patch(`/routers/${ROUTER_EXT_ID}/condition`)
        .set(auth)
        .send(
          makeUpdateRouterConditionDto({
            physicalCondition: 'UNDER_REPAIR',
            externalLocation: 'Apex Circuit Repairs Lab',
            reason: 'Sending out for component reflow',
          }),
        )
        .expect(200);

      // Physical warehouse placement cleared
      expect(res.body.data.warehouseId).toBeNull();
      expect(res.body.data.externalLocation).toBe('Apex Circuit Repairs Lab');
      expect(res.body.data.currentHolderType).toBeNull();

      // Prior location retained in condition history
      const history = conditionHistoryStore.filter((c) => c.routerId === ROUTER_EXT_ID);
      const latestHistory = history[history.length - 1];
      expect(latestHistory.fromWarehouseId).toBe(WAREHOUSE_ACTIVE_ID);
      expect(latestHistory.toWarehouseId).toBeNull();
      expect(latestHistory.externalLocation).toBe('Apex Circuit Repairs Lab');
    });

    it('restoring serviceability adds stock and restores warehouse custody upon return from repair', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const ROUTER_RETURN_REPAIR_ID = '66664444-5555-4666-8777-888899990000';

      routerStore.push(
        makeRouter({
          id: ROUTER_RETURN_REPAIR_ID,
          serialNumber: 'SN-REPAIRED-RETURN',
          productId: PRODUCT_ROUTER_ID,
          warehouseId: null,
          externalLocation: 'Apex Circuit Repairs Lab',
          status: 'AVAILABLE',
          physicalCondition: 'UNDER_REPAIR',
        }),
      );

      const stockB = stockStore.find(
        (s) => s.warehouseId === WAREHOUSE_SECONDARY_ID && s.productId === PRODUCT_ROUTER_ID,
      )!;
      const initialStockB = stockB.quantity;

      const res = await request(app.getHttpServer())
        .patch(`/routers/${ROUTER_RETURN_REPAIR_ID}/condition`)
        .set(auth)
        .send(
          makeUpdateRouterConditionDto({
            physicalCondition: 'SERVICEABLE',
            warehouseId: WAREHOUSE_SECONDARY_ID,
            reason: 'Passed post-repair diagnostic benchmark',
          }),
        )
        .expect(200);

      expect(res.body.data.physicalCondition).toBe('SERVICEABLE');
      expect(res.body.data.warehouseId).toBe(WAREHOUSE_SECONDARY_ID);
      expect(res.body.data.externalLocation).toBeNull();
      expect(res.body.data.currentHolderType).toBe('WAREHOUSE');
      expect(res.body.data.currentHolderId).toBe(WAREHOUSE_SECONDARY_ID);

      // Added back to usable stock in Secondary Hub
      expect(stockB.quantity).toBe(initialStockB + 1);
    });
  });

  describe('Atomicity, Concurrency & Rollback Invariants', () => {
    it('concurrent receipts preserve both increments on initially missing stock rows', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);

      const dto1 = makeCreateRouterDto({
        serialNumber: 'SN-CONCURRENT-001',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        productId: PRODUCT_ROUTER_ID,
        isNewReceipt: true,
      });
      const dto2 = makeCreateRouterDto({
        serialNumber: 'SN-CONCURRENT-002',
        warehouseId: WAREHOUSE_ACTIVE_ID,
        productId: PRODUCT_ROUTER_ID,
        isNewReceipt: true,
      });

      const initialStock =
        stockStore.find(
          (s) => s.warehouseId === WAREHOUSE_ACTIVE_ID && s.productId === PRODUCT_ROUTER_ID,
        )?.quantity ?? 0;

      // Execute both receipts concurrently
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer()).post('/routers').set(auth).send(dto1),
        request(app.getHttpServer()).post('/routers').set(auth).send(dto2),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const updatedStock = stockStore.find(
        (s) => s.warehouseId === WAREHOUSE_ACTIVE_ID && s.productId === PRODUCT_ROUTER_ID,
      )?.quantity;

      expect(updatedStock).toBe(initialStock + 2);
    });

    it('competing assignments cannot both succeed (one succeeds, one returns 409 Conflict)', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const targetRouterId = '11223344-5566-7788-99aa-bbccddeeff00';

      // Insert a fresh AVAILABLE router into store
      routerStore.push(
        makeRouter({
          id: targetRouterId,
          serialNumber: 'SN-RACE-ROUTER',
          productId: PRODUCT_ROUTER_ID,
          warehouseId: WAREHOUSE_ACTIVE_ID,
          status: 'AVAILABLE',
          physicalCondition: 'SERVICEABLE',
        }),
      );

      const assignDto1 = makeAssignRouterDto({
        technicianId: TECH_USER_ID,
        notes: 'Assign attempt 1',
      });
      const assignDto2 = makeAssignRouterDto({
        technicianId: TECH_USER_ID,
        notes: 'Assign attempt 2',
      });

      // Run competing assignments concurrently
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/routers/${targetRouterId}/assign`)
          .set(auth)
          .send(assignDto1),
        request(app.getHttpServer())
          .post(`/routers/${targetRouterId}/assign`)
          .set(auth)
          .send(assignDto2),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
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
