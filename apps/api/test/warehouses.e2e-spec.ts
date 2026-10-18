import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Role } from '@alfahd/types';
import { setupTestApp, getAuthHeader } from './test-utils.js';
import { makeCreateWarehouseDto } from './fakers/index.js';
import { envelopeData } from './utils/supertest.util.js';
import { RepositoryService } from '../src/modules/repository/repository.service.js';
import type { Warehouse } from '../src/entities/warehouses.entity.js';

describe('Warehouses (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const WAREHOUSE_1_ID = '11111111-1111-4111-8111-111111111111';
  const WAREHOUSE_2_ID = '22222222-2222-4222-8222-222222222222';
  const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';

  let warehouseStore: Warehouse[] = [];

  const mockRepositoryService = {
    warehouses: {
      findByName: async (name: string) => {
        return warehouseStore.find(
          (w) => w.name.trim().toLowerCase() === name.trim().toLowerCase(),
        );
      },
      findById: async (id: string) => {
        return warehouseStore.find((w) => w.id === id);
      },
      findManyWithPagination: async (params: { search?: string; limit: number; offset: number }) => {
        let items = [...warehouseStore];
        if (params.search) {
          const s = params.search.toLowerCase();
          items = items.filter(
            (w) => w.name.toLowerCase().includes(s) || w.address.toLowerCase().includes(s),
          );
        }
        return {
          items: items.slice(params.offset, params.offset + params.limit),
          total: items.length,
        };
      },
      create: async (data: Partial<Warehouse>) => {
        const created: Warehouse = {
          id: '33333333-3333-4333-8333-333333333333',
          name: data.name!,
          address: data.address!,
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
          geofenceRadiusMeters: data.geofenceRadiusMeters ?? 150,
          managerId: data.managerId ?? null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        warehouseStore.push(created);
        return created;
      },
      updateWarehouse: async (id: string, updates: Partial<Warehouse>) => {
        const index = warehouseStore.findIndex((w) => w.id === id);
        if (index === -1) return undefined;
        warehouseStore[index] = {
          ...warehouseStore[index],
          ...updates,
          updatedAt: new Date(),
        };
        return warehouseStore[index];
      },
      canDeleteWarehouse: async (id: string) => {
        if (id === WAREHOUSE_2_ID) {
          return { canDelete: false, reason: 'Warehouse has active inventory' };
        }
        return { canDelete: true };
      },
      deleteById: async (id: string) => {
        warehouseStore = warehouseStore.filter((w) => w.id !== id);
      },
    },
    products: {},
    inventory: {},
  };

  beforeAll(async () => {
    warehouseStore = [
      {
        id: WAREHOUSE_1_ID,
        name: 'Main Hub',
        address: '123 Nile St, Cairo',
        latitude: 30.0444,
        longitude: 31.2357,
        geofenceRadiusMeters: 200,
        managerId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: WAREHOUSE_2_ID,
        name: 'Alexandria Hub',
        address: '45 Corniche, Alex',
        latitude: 31.2001,
        longitude: 29.9187,
        geofenceRadiusMeters: 150,
        managerId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

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
      await request(app.getHttpServer()).get('/warehouses').expect(401);
    });

    it('returns 403 Forbidden when TECHNICIAN attempts to list warehouses', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      await request(app.getHttpServer()).get('/warehouses').set(auth).expect(403);
    });

    it('returns 200 OK when WAREHOUSE_STAFF lists warehouses', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const res = await request(app.getHttpServer()).get('/warehouses').set(auth).expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data.items).toHaveLength(2);
    });

    it('returns 200 OK when CS lists warehouses', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      const res = await request(app.getHttpServer()).get('/warehouses').set(auth).expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data.items).toBeDefined();
    });

    it('returns 403 Forbidden when WAREHOUSE_STAFF attempts to create a warehouse', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      await request(app.getHttpServer())
        .post('/warehouses')
        .set(auth)
        .send({ name: 'Giza Hub', address: 'Pyramids Rd' })
        .expect(403);
    });

    it('returns 403 Forbidden when CS attempts to create a warehouse', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      await request(app.getHttpServer())
        .post('/warehouses')
        .set(auth)
        .send({ name: 'Giza Hub', address: 'Pyramids Rd' })
        .expect(403);
    });

    it('allows ADMIN to create a warehouse with 201 Created', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const payload = makeCreateWarehouseDto({
        name: 'Giza Distribution Center',
        address: '45 Pyramids Rd, Giza',
        latitude: 29.9792,
        longitude: 31.1342,
        geofenceRadiusMeters: 300,
      });

      const res = await request(app.getHttpServer())
        .post('/warehouses')
        .set(auth)
        .send(payload)
        .expect(201);

      const data = envelopeData<Warehouse>(res);
      expect(data).toMatchObject({
        name: 'Giza Distribution Center',
        address: '45 Pyramids Rd, Giza',
        geofenceRadiusMeters: 300,
        isActive: true,
      });
    });

    it('returns 403 Forbidden when non-ADMIN attempts to patch a warehouse', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      await request(app.getHttpServer())
        .patch(`/warehouses/${WAREHOUSE_1_ID}`)
        .set(auth)
        .send({ name: 'Renamed Hub' })
        .expect(403);
    });

    it('returns 403 Forbidden when non-ADMIN attempts to delete a warehouse', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      await request(app.getHttpServer())
        .delete(`/warehouses/${WAREHOUSE_1_ID}`)
        .set(auth)
        .expect(403);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('returns 400 Bad Request when creating warehouse with missing fields', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/warehouses')
        .set(auth)
        .send({ name: '' })
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });

    it('returns 400 Bad Request when warehouse ID param is not a valid UUID', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .get('/warehouses/not-a-valid-uuid')
        .set(auth)
        .expect(400);
    });

    it('returns 409 Conflict when creating a warehouse with existing name', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/warehouses')
        .set(auth)
        .send({
          name: 'Main Hub',
          address: 'Another Street, Cairo',
          latitude: 30.0444,
          longitude: 31.2357,
        })
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });

    it('returns 404 Not Found when requesting non-existent warehouse', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .get(`/warehouses/${NON_EXISTENT_ID}`)
        .set(auth)
        .expect(404);
    });

    it('returns 409 Conflict when deleting a warehouse with active inventory', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .delete(`/warehouses/${WAREHOUSE_2_ID}`)
        .set(auth)
        .expect(409);

      expect(res.body.message).toContain('active inventory');
    });

    it('returns 204 No Content when deleting a warehouse with no active inventory', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .delete(`/warehouses/${WAREHOUSE_1_ID}`)
        .set(auth)
        .expect(204);
    });
  });
});
