import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Role } from '@alfahd/types';
import { setupTestApp, getAuthHeader } from './test-utils.js';
import { makeCreateProductDto } from './fakers/index.js';
import { envelopeData } from './utils/supertest.util.js';
import { RepositoryService } from '../src/modules/repository/repository.service.js';
import type { Product, ProductWithStock } from '../src/entities/inventory.entity.js';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const PRODUCT_1_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const PRODUCT_2_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';

  let productStore: Product[] = [];

  const mockRepositoryService = {
    products: {
      findBySku: async (sku: string) => {
        return productStore.find((p) => p.sku === sku);
      },
      findById: async (id: string) => {
        return productStore.find((p) => p.id === id);
      },
      findByIdWithStock: async (id: string): Promise<ProductWithStock | undefined> => {
        const prod = productStore.find((p) => p.id === id);
        if (!prod) return undefined;
        const totalStock = 50;
        return {
          ...prod,
          totalStock,
          isLowStock: totalStock <= prod.lowStockThreshold,
        };
      },
      findManyWithStock: async (params: {
        search?: string;
        category?: string;
        isLowStock?: boolean;
        limit: number;
        offset: number;
      }) => {
        let items: ProductWithStock[] = productStore.map((p) => ({
          ...p,
          totalStock: 50,
          isLowStock: 50 <= p.lowStockThreshold,
        }));

        if (params.search) {
          const s = params.search.toLowerCase();
          items = items.filter(
            (p) =>
              p.name.toLowerCase().includes(s) ||
              p.sku.toLowerCase().includes(s) ||
              p.model.toLowerCase().includes(s),
          );
        }

        if (params.category) {
          items = items.filter((p) => p.category === params.category);
        }

        return {
          items: items.slice(params.offset, params.offset + params.limit),
          total: items.length,
        };
      },
      create: async (data: Partial<Product>) => {
        const created: Product = {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          name: data.name!,
          sku: data.sku!,
          model: data.model!,
          category: data.category!,
          description: data.description ?? null,
          lowStockThreshold: data.lowStockThreshold ?? 10,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        productStore.push(created);
        return created;
      },
      updateProduct: async (id: string, updates: Partial<Product>) => {
        const index = productStore.findIndex((p) => p.id === id);
        if (index === -1) return undefined;
        productStore[index] = {
          ...productStore[index],
          ...updates,
          updatedAt: new Date(),
        };
        return productStore[index];
      },
      canDeleteProduct: async (id: string) => {
        if (id === PRODUCT_2_ID) {
          return { canDelete: false, reason: 'Product has active inventory stock' };
        }
        return { canDelete: true };
      },
      deleteById: async (id: string) => {
        productStore = productStore.filter((p) => p.id !== id);
      },
    },
    warehouses: {},
    inventory: {},
  };

  beforeAll(async () => {
    productStore = [
      {
        id: PRODUCT_1_ID,
        name: 'Fiber Router XR-500',
        sku: 'RTR-XR500',
        model: 'XR-500',
        category: 'Routers',
        description: 'Gigabit dual-band wireless router',
        lowStockThreshold: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: PRODUCT_2_ID,
        name: 'Cat6 Ethernet Cable 100m',
        sku: 'CBL-CAT6-100',
        model: 'CAT6-100M',
        category: 'Cables',
        description: 'Shielded high-speed ethernet cable roll',
        lowStockThreshold: 5,
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
      await request(app.getHttpServer()).get('/products').expect(401);
    });

    it('returns 200 OK when TECHNICIAN reads products list', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      const res = await request(app.getHttpServer()).get('/products').set(auth).expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data.items).toBeDefined();
    });

    it('returns 200 OK when CS reads product details by ID', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      const res = await request(app.getHttpServer())
        .get(`/products/${PRODUCT_1_ID}`)
        .set(auth)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: PRODUCT_1_ID,
        sku: 'RTR-XR500',
      });
    });

    it('returns 403 Forbidden when CS attempts to create a product', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      await request(app.getHttpServer())
        .post('/products')
        .set(auth)
        .send({
          name: 'Optical Receiver',
          sku: 'OPT-RCV-01',
          model: 'RCV-01',
          category: 'Optics',
        })
        .expect(403);
    });

    it('returns 403 Forbidden when TECHNICIAN attempts to create a product', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      await request(app.getHttpServer())
        .post('/products')
        .set(auth)
        .send({
          name: 'Optical Receiver',
          sku: 'OPT-RCV-01',
          model: 'RCV-01',
          category: 'Optics',
        })
        .expect(403);
    });

    it('allows WAREHOUSE_STAFF to create a product with 201 Created', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const payload = makeCreateProductDto({
        name: 'SFP+ Transceiver 10G',
        sku: 'SFP-10G-SR',
        model: '10G-SR',
        category: 'Optics',
        description: '10G Multimode SFP+ Module',
        lowStockThreshold: 15,
      });

      const res = await request(app.getHttpServer())
        .post('/products')
        .set(auth)
        .send(payload)
        .expect(201);

      const data = envelopeData<Product>(res);
      expect(data).toMatchObject({
        name: 'SFP+ Transceiver 10G',
        sku: 'SFP-10G-SR',
        lowStockThreshold: 15,
      });
    });

    it('allows WAREHOUSE_STAFF to patch a product', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      const res = await request(app.getHttpServer())
        .patch(`/products/${PRODUCT_1_ID}`)
        .set(auth)
        .send({
          name: 'Fiber Router XR-500 v2',
        })
        .expect(200);

      expect(res.body.data.name).toBe('Fiber Router XR-500 v2');
    });

    it('returns 403 Forbidden when WAREHOUSE_STAFF attempts to delete a product', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      await request(app.getHttpServer())
        .delete(`/products/${PRODUCT_1_ID}`)
        .set(auth)
        .expect(403);
    });

    it('allows ADMIN to delete a product', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .delete(`/products/${PRODUCT_1_ID}`)
        .set(auth)
        .expect(204);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('returns 400 Bad Request when creating product with missing required fields', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(auth)
        .send({ name: 'Incomplete' })
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });

    it('returns 400 Bad Request when product ID is not a valid UUID', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .get('/products/not-a-valid-uuid')
        .set(auth)
        .expect(400);
    });

    it('returns 409 Conflict when creating a product with duplicate SKU', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/products')
        .set(auth)
        .send({
          name: 'Duplicate SKU Item',
          sku: 'CBL-CAT6-100',
          model: 'M-1',
          category: 'Cables',
        })
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });

    it('returns 404 Not Found when requesting non-existent product', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .get(`/products/${NON_EXISTENT_ID}`)
        .set(auth)
        .expect(404);
    });

    it('returns 409 Conflict when deleting a product that has active stock', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .delete(`/products/${PRODUCT_2_ID}`)
        .set(auth)
        .expect(409);

      expect(res.body.message).toContain('active inventory');
    });
  });
});
