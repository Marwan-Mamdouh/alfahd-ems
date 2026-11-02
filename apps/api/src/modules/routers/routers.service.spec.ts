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
    findByIdForUpdate: vi.fn(),
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
    recordMovementWithDelta: vi.fn(),
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
      expect(mockInventoryRepo.recordMovementWithDelta).not.toHaveBeenCalled();
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

      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'INBOUND_SUPPLIER',
          quantity: 1,
        }),
        1,
        expect.anything(),
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
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
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

      const result = await service.assign(
        mockRouter.id,
        { technicianId: 'tech-1', notes: 'Handed over' },
        'admin-id',
      );

      expect(mockRoutersRepo.findByIdForUpdate).toHaveBeenCalledWith(
        mockRouter.id,
        expect.anything(),
      );
      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalled();
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          holderType: 'TECHNICIAN',
          technicianId: 'tech-1',
        }),
        expect.anything(),
      );
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'OUTBOUND_TECHNICIAN',
          quantity: 1,
        }),
        -1,
        expect.anything(),
      );
      expect(result.status).toBe('ASSIGNED_TO_TECHNICIAN');
    });

    it('throws ConflictException if router is not AVAILABLE or unserviceable', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
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
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(assignedRouter);
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
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);

      await expect(
        service.transition(mockRouter.id, { status: 'DAMAGED' }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition from terminal status (LOST / DECOMMISSIONED)', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
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
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
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
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'ADJUSTMENT',
          quantity: 1,
        }),
        -1,
        expect.anything(),
      );
      expect(result.status).toBe('AVAILABLE');
      expect(result.physicalCondition).toBe('DAMAGED');
    });
  });

  describe('transaction atomicity & caller-owned externalTx', () => {
    it('executes create entirely within externalTx when provided', async () => {
      const mockExternalTx = {} as any;
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockRoutersRepo.createRouter.mockResolvedValue(mockRouter);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);

      await service.create(
        {
          serialNumber: 'SN-EXTERNAL-TX',
          productId: mockProduct.id,
          warehouseId: mockWarehouse.id,
          isNewReceipt: true,
        },
        'admin-id',
        mockExternalTx,
      );

      // Verify repo.transaction was NOT called because externalTx was provided
      expect(mockRepositoryService.transaction).not.toHaveBeenCalled();
      expect(mockRoutersRepo.createRouter).toHaveBeenCalledWith(expect.anything(), mockExternalTx);
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.anything(),
        mockExternalTx,
      );
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.anything(),
        1,
        mockExternalTx,
      );
    });

    it('rolls back completely when an injected failure occurs during create', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockRoutersRepo.createRouter.mockResolvedValue(mockRouter);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockInventoryRepo.recordMovementWithDelta.mockRejectedValueOnce(
        new Error('Injected stock write failure'),
      );

      // If inventory write fails inside the transaction, the promise rejects and transaction aborts
      await expect(
        service.create(
          {
            serialNumber: 'SN-FAIL',
            productId: mockProduct.id,
            warehouseId: mockWarehouse.id,
            isNewReceipt: true,
          },
          'admin-id',
        ),
      ).rejects.toThrow('Injected stock write failure');
    });

    it('executes assign entirely within externalTx when provided', async () => {
      const mockExternalTx = {} as any;
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue(mockRouter);
      mockInventoryRepo.recordMovementWithDelta.mockResolvedValueOnce({} as any);

      await service.assign(mockRouter.id, { technicianId: 'tech-1' }, 'admin-id', mockExternalTx);

      expect(mockRepositoryService.transaction).not.toHaveBeenCalled();
      expect(mockRoutersRepo.findByIdForUpdate).toHaveBeenCalledWith(mockRouter.id, mockExternalTx);
      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalledWith(
        mockRouter.id,
        expect.any(Date),
        mockExternalTx,
      );
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.anything(),
        mockExternalTx,
      );
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.anything(),
        -1,
        mockExternalTx,
      );
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
