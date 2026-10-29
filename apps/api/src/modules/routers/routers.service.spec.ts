import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { RoutersService } from './routers.service.js';
import { RepositoryService } from '../repository/repository.service.js';
import type { Router, RouterAssignment } from '../../database/schema/index.js';

describe('RoutersService', () => {
  let service: RoutersService;

  const mockRouter: Router = {
    id: '11111111-1111-4111-8111-111111111111',
    serialNumber: 'SN-RTR-001',
    productId: '22222222-2222-4222-8222-222222222222',
    status: 'AVAILABLE',
    physicalCondition: 'SERVICEABLE',
    warehouseId: '33333333-3333-4333-8333-333333333333',
    externalLocation: null,
    notes: 'Test router',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockAssignment: RouterAssignment = {
    id: '44444444-4444-4444-4444-444444444444',
    routerId: mockRouter.id,
    holderType: 'WAREHOUSE',
    warehouseId: mockRouter.warehouseId,
    technicianId: null,
    assignedAt: new Date('2026-01-01T00:00:00Z'),
    releasedAt: null,
    assignedBy: 'user-admin',
    notes: 'Initial assignment',
  };

  const mockWarehouse = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Cairo Hub',
    isActive: true,
  };

  const mockProduct = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Optical Router V1',
    sku: 'RTR-OPT-01',
  };

  const mockRoutersRepo = {
    findBySerialNumber: vi.fn(),
    findById: vi.fn(),
    createRouter: vi.fn(),
    updateRouter: vi.fn(),
    createAssignment: vi.fn(),
    findActiveAssignment: vi.fn(),
    releaseActiveAssignment: vi.fn(),
    findAssignmentsByRouter: vi.fn(),
    createConditionHistory: vi.fn(),
    findConditionHistory: vi.fn(),
    findManyWithPagination: vi.fn(),
    getWarehouseRouterCounts: vi.fn(),
  };

  const mockWarehousesRepo = {
    findById: vi.fn(),
  };

  const mockProductsRepo = {
    findById: vi.fn(),
  };

  const mockInventoryRepo = {
    getStock: vi.fn(),
    recordMovementInTransaction: vi.fn(),
  };

  const mockReportsQueue = {
    add: vi.fn(),
  };

  const mockRepositoryService = {
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb({})),
    routers: mockRoutersRepo,
    warehouses: mockWarehousesRepo,
    products: mockProductsRepo,
    inventory: mockInventoryRepo,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutersService,
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
        {
          provide: getQueueToken('reports'),
          useValue: mockReportsQueue,
        },
      ],
    }).compile();

    service = module.get<RoutersService>(RoutersService);
  });

  describe('create', () => {
    it('registers an existing router without adding inventory stock (isNewReceipt=false)', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockRoutersRepo.createRouter.mockResolvedValue(mockRouter);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);

      const result = await service.create(
        {
          serialNumber: 'SN-RTR-001',
          productId: mockProduct.id,
          warehouseId: mockWarehouse.id,
          isNewReceipt: false,
        },
        'admin-id',
      );

      expect(mockRoutersRepo.createRouter).toHaveBeenCalled();
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          holderType: 'WAREHOUSE',
          warehouseId: mockWarehouse.id,
        }),
        expect.anything(),
      );
      expect(mockInventoryRepo.recordMovementInTransaction).not.toHaveBeenCalled();
      expect(result.serialNumber).toBe('SN-RTR-001');
    });

    it('receives a new router into warehouse and atomically increments inventory (isNewReceipt=true)', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockRoutersRepo.createRouter.mockResolvedValue(mockRouter);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockInventoryRepo.getStock.mockResolvedValue({ quantity: 5 });

      await service.create(
        {
          serialNumber: 'SN-RTR-001',
          productId: mockProduct.id,
          warehouseId: mockWarehouse.id,
          isNewReceipt: true,
        },
        'admin-id',
      );

      expect(mockInventoryRepo.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'INBOUND_SUPPLIER',
          quantity: 1,
        }),
        6,
      );
    });

    it('throws ConflictException if serial number already exists', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(mockRouter);

      await expect(
        service.create(
          {
            serialNumber: 'SN-RTR-001',
            productId: mockProduct.id,
            warehouseId: mockWarehouse.id,
          },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if warehouse is deactivated', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue({ ...mockWarehouse, isActive: false });

      await expect(
        service.create(
          {
            serialNumber: 'SN-RTR-001',
            productId: mockProduct.id,
            warehouseId: mockWarehouse.id,
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assign', () => {
    it('assigns an AVAILABLE serviceable router to a technician and decrements warehouse stock', async () => {
      mockRoutersRepo.findById.mockResolvedValue(mockRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue({
        ...mockAssignment,
        releasedAt: new Date(),
      });
      mockRoutersRepo.createAssignment.mockResolvedValue({
        ...mockAssignment,
        holderType: 'TECHNICIAN',
        technicianId: 'tech-1',
      });
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN',
        warehouseId: null,
      });
      mockInventoryRepo.getStock.mockResolvedValue({ quantity: 10 });

      const result = await service.assign(
        mockRouter.id,
        { technicianId: 'tech-1', notes: 'Handed over' },
        'admin-id',
      );

      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalled();
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          holderType: 'TECHNICIAN',
          technicianId: 'tech-1',
        }),
        expect.anything(),
      );
      expect(mockInventoryRepo.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'OUTBOUND_TECHNICIAN',
          quantity: 1,
        }),
        9,
      );
      expect(result.status).toBe('ASSIGNED_TO_TECHNICIAN');
    });

    it('throws ConflictException if router is not AVAILABLE or unserviceable', async () => {
      mockRoutersRepo.findById.mockResolvedValue({
        ...mockRouter,
        status: 'RETURNED',
      });

      await expect(
        service.assign(mockRouter.id, { technicianId: 'tech-1' }, 'admin-id'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transition', () => {
    it('enforces whitelist and transitions ASSIGNED_TO_TECHNICIAN to RETURNED', async () => {
      const assignedRouter = { ...mockRouter, status: 'ASSIGNED_TO_TECHNICIAN' as const };
      mockRoutersRepo.findById.mockResolvedValue(assignedRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue({ ...assignedRouter, status: 'RETURNED' });

      const result = await service.transition(
        mockRouter.id,
        { status: 'RETURNED', targetWarehouseId: mockWarehouse.id },
        'admin-id',
      );

      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalled();
      expect(result.status).toBe('RETURNED');
    });

    it('rejects illegal transitions (AVAILABLE -> DAMAGED via transition) with 400 Bad Request', async () => {
      mockRoutersRepo.findById.mockResolvedValue(mockRouter);

      await expect(
        service.transition(mockRouter.id, { status: 'DAMAGED' }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition from terminal status (LOST / DECOMMISSIONED)', async () => {
      mockRoutersRepo.findById.mockResolvedValue({
        ...mockRouter,
        status: 'DECOMMISSIONED' as const,
      });

      await expect(
        service.transition(mockRouter.id, { status: 'AVAILABLE' }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCondition', () => {
    it('handles warehouse damage for AVAILABLE router: keeps status, empties custody, decrements usable stock', async () => {
      mockRoutersRepo.findById.mockResolvedValue(mockRouter);
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockInventoryRepo.getStock.mockResolvedValue({ quantity: 5 });
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        physicalCondition: 'DAMAGED',
      });

      const result = await service.updateCondition(
        mockRouter.id,
        {
          physicalCondition: 'DAMAGED',
          reason: 'Dropped in warehouse during audit',
        },
        'admin-id',
      );

      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalled();
      expect(mockInventoryRepo.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'ADJUSTMENT',
          quantity: 1,
        }),
        4,
      );
      expect(result.status).toBe('AVAILABLE');
      expect(result.physicalCondition).toBe('DAMAGED');
    });
  });

  describe('exportRouterReport', () => {
    it('enqueues a router inventory report job with ROUTER_INVENTORY_REPORT discriminator', async () => {
      mockReportsQueue.add.mockResolvedValue({ id: 'job-router-123' });

      const result = await service.exportRouterReport(
        { warehouseId: mockWarehouse.id },
        'admin-id',
      );

      expect(mockReportsQueue.add).toHaveBeenCalledWith(
        'router-inventory-summary',
        expect.objectContaining({
          type: 'ROUTER_INVENTORY_REPORT',
          params: { warehouseId: mockWarehouse.id },
        }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
      expect(result.jobId).toBe('job-router-123');
    });
  });
});
