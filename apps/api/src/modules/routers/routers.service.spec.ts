import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { RoutersService } from './routers.service.js';
import { RepositoryService } from '../repository/repository.service.js';
import type * as schema from '../../database/schema/index.js';
import type {
  Router,
  RouterAssignment,
  RouterConditionHistory,
  RouterStatusHistory,
  StockMovement,
  WarehouseInventory,
} from '../../database/schema/index.js';
import type { TransitionRouterDto } from './dto/transition-router.dto.js';

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
    createStatusHistory: vi.fn(),
    findStatusHistory: vi.fn(),
    findManyWithPagination: vi.fn(),
    getWarehouseRouterCounts: vi.fn(),
    countRegisteredUsableInWarehouse: vi.fn(),
  };

  const mockWarehousesRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
  };

  const mockProductsRepo = {
    findById: vi.fn(),
    findByIdForUpdate: vi.fn(),
    markSerialized: vi.fn(),
  };

  const mockInventoryRepo = {
    getStock: vi.fn(),
    getStockForUpdate: vi.fn(),
    recordMovementInTransaction: vi.fn(),
    recordMovementWithDelta: vi.fn(),
  };

  const mockReportsQueue = {
    add: vi.fn(),
  };

  const mockExternalTx = {} as unknown as NodePgDatabase<typeof schema>;
  const mockMovementResult = {
    inventory: {} as WarehouseInventory,
    movement: {} as StockMovement,
  };
  const mockStatusHistory: RouterStatusHistory = {
    id: 'hist-1',
    routerId: mockRouter.id,
    fromStatus: 'RETURNED',
    toStatus: 'AVAILABLE',
    reason: 'Inspection passed',
    changedBy: 'admin-id',
    createdAt: new Date(),
  };
  const mockConditionHistory: RouterConditionHistory = {
    id: 'cond-1',
    routerId: mockRouter.id,
    fromCondition: 'SERVICEABLE',
    toCondition: 'DAMAGED',
    fromWarehouseId: mockWarehouse.id,
    toWarehouseId: null,
    externalLocation: null,
    reason: 'Dropped during inspection',
    changedBy: 'admin-id',
    createdAt: new Date(),
  };

  const mockRepositoryService = {
    transaction: vi.fn(async (cb: (tx: NodePgDatabase<typeof schema>) => Promise<unknown>) =>
      cb(mockExternalTx),
    ),
    routers: mockRoutersRepo,
    warehouses: mockWarehousesRepo,
    products: mockProductsRepo,
    inventory: mockInventoryRepo,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockProductsRepo.findByIdForUpdate.mockImplementation((id: string) =>
      mockProductsRepo.findById(id),
    );

    mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
    mockWarehousesRepo.findByIdForUpdate.mockResolvedValue(mockWarehouse);

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
    it.each(['DAMAGED', 'UNDER_REPAIR'] as const)(
      'rejects %s opening units when all stock already has usable serials',
      async (physicalCondition) => {
        mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
        mockProductsRepo.findById.mockResolvedValue(mockProduct);
        mockInventoryRepo.getStockForUpdate.mockResolvedValue({ quantity: 1 });
        mockRoutersRepo.countRegisteredUsableInWarehouse.mockResolvedValue(1);
        await expect(
          service.create(
            {
              serialNumber: 'NEW',
              productId: mockProduct.id,
              warehouseId: mockWarehouse.id,
              physicalCondition,
            },
            'admin-id',
          ),
        ).rejects.toThrow(ConflictException);
        expect(mockRoutersRepo.createRouter).not.toHaveBeenCalled();
        expect(mockInventoryRepo.recordMovementWithDelta).not.toHaveBeenCalled();
      },
    );
    it('registers an existing router without adding inventory stock (isNewReceipt=false)', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStockForUpdate.mockResolvedValue({ quantity: 5 });
      mockRoutersRepo.countRegisteredUsableInWarehouse.mockResolvedValue(2);
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

    it('rejects existing stock registration with ConflictException if warehouse has zero opening stock', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStockForUpdate.mockResolvedValue({ quantity: 0 });

      await expect(
        service.create(
          {
            serialNumber: 'SN-ZERO-STOCK',
            productId: mockProduct.id,
            warehouseId: mockWarehouse.id,
            isNewReceipt: false,
          },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects existing stock registration with ConflictException if registration capacity is exhausted', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStockForUpdate.mockResolvedValue({ quantity: 5 });
      mockRoutersRepo.countRegisteredUsableInWarehouse.mockResolvedValue(5); // all 5 units already registered

      await expect(
        service.create(
          {
            serialNumber: 'SN-CAPACITY-EXCEEDED',
            productId: mockProduct.id,
            warehouseId: mockWarehouse.id,
            isNewReceipt: false,
          },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('reconciles a damaged opening unit by recording ADJUSTMENT movement (-1) and condition history', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStockForUpdate.mockResolvedValue({ quantity: 5 });
      mockRoutersRepo.countRegisteredUsableInWarehouse.mockResolvedValue(2);
      mockInventoryRepo.getStock.mockResolvedValue({ quantity: 5 });
      mockRoutersRepo.createRouter.mockResolvedValue({
        ...mockRouter,
        physicalCondition: 'DAMAGED',
      });
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});

      await service.create(
        {
          serialNumber: 'SN-DAMAGED-OPENING',
          productId: mockProduct.id,
          warehouseId: mockWarehouse.id,
          isNewReceipt: false,
          physicalCondition: 'DAMAGED',
          notes: 'Box opened and found with broken antenna',
        },
        'admin-id',
      );

      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'ADJUSTMENT',
          quantity: 1,
        }),
        -1,
        expect.anything(),
      );
      expect(mockRoutersRepo.createConditionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCondition: 'SERVICEABLE',
          toCondition: 'DAMAGED',
        }),
        expect.anything(),
      );
    });

    it('reconciles an UNDER_REPAIR opening unit with ADJUSTMENT movement (-1), condition history and no custody assignment', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStockForUpdate.mockResolvedValue({ quantity: 3 });
      mockRoutersRepo.countRegisteredUsableInWarehouse.mockResolvedValue(1);
      mockRoutersRepo.createRouter.mockResolvedValue({
        ...mockRouter,
        physicalCondition: 'UNDER_REPAIR',
      });
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});

      await service.create(
        {
          serialNumber: 'SN-REPAIR-OPENING',
          productId: mockProduct.id,
          warehouseId: mockWarehouse.id,
          isNewReceipt: false,
          physicalCondition: 'UNDER_REPAIR',
          notes: 'Inspection found burned capacitor',
        },
        'admin-id',
      );

      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'ADJUSTMENT',
          quantity: 1,
          notes: expect.stringContaining(
            'Explicit reconciliation: opening stock unit registered as UNDER_REPAIR',
          ),
        }),
        -1,
        expect.anything(),
      );
      expect(mockRoutersRepo.createConditionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          fromCondition: 'SERVICEABLE',
          toCondition: 'UNDER_REPAIR',
        }),
        expect.anything(),
      );
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
    });

    it('maps a database unique constraint violation (code 23505) to ConflictException during concurrent retry', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(undefined);
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockRoutersRepo.createRouter.mockRejectedValueOnce(
        Object.assign(
          new Error(
            'duplicate key value violates unique constraint "routers_serial_number_unique"',
          ),
          { code: '23505' },
        ),
      );

      await expect(
        service.create(
          {
            serialNumber: 'SN-RACE-SERIAL',
            productId: mockProduct.id,
            warehouseId: mockWarehouse.id,
            isNewReceipt: true,
          },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects retrying an already registered serial without altering inventory stock or movements', async () => {
      mockRoutersRepo.findBySerialNumber.mockResolvedValue(mockRouter);

      await expect(
        service.create(
          {
            serialNumber: mockRouter.serialNumber,
            productId: mockProduct.id,
            warehouseId: mockWarehouse.id,
            isNewReceipt: false,
          },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockRoutersRepo.createRouter).not.toHaveBeenCalled();
      expect(mockInventoryRepo.recordMovementWithDelta).not.toHaveBeenCalled();
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
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
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue({ ...mockWarehouse, isActive: false });

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
    it('opens custody and adds stock only after an available repair is restored to serviceable', async () => {
      const repairing = {
        ...mockRouter,
        status: 'UNDER_REPAIR' as const,
        physicalCondition: 'UNDER_REPAIR' as const,
      };
      const available = { ...repairing, status: 'AVAILABLE' as const };
      const restored = { ...available, physicalCondition: 'SERVICEABLE' as const };
      mockRoutersRepo.findByIdForUpdate
        .mockResolvedValueOnce(repairing)
        .mockResolvedValueOnce(available);
      mockRoutersRepo.updateRouter.mockResolvedValueOnce(available).mockResolvedValueOnce(restored);
      mockRoutersRepo.findActiveAssignment
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAssignment);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      await service.transition(
        mockRouter.id,
        { status: 'AVAILABLE', reason: 'Returned from repair' },
        'admin-id',
      );
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
      expect(mockInventoryRepo.recordMovementWithDelta).not.toHaveBeenCalled();
      await service.updateCondition(
        mockRouter.id,
        { physicalCondition: 'SERVICEABLE', reason: 'Inspection passed' },
        'admin-id',
      );
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledTimes(1);
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledTimes(1);
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: mockWarehouse.id,
          productId: mockProduct.id,
          responsibleUserId: 'admin-id',
        }),
        1,
        expect.anything(),
      );
      expect(mockRoutersRepo.createStatusHistory).toHaveBeenCalledTimes(1);
      expect(mockRoutersRepo.createConditionHistory).toHaveBeenCalledTimes(1);
      expect(mockRoutersRepo.releaseActiveAssignment).not.toHaveBeenCalled();
    });
    it('does not restore stock or custody when repair is still unserviceable', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'UNDER_REPAIR',
        physicalCondition: 'UNDER_REPAIR',
      });
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        status: 'AVAILABLE',
        physicalCondition: 'UNDER_REPAIR',
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue(null);
      await service.transition(
        mockRouter.id,
        { status: 'AVAILABLE', reason: 'Inspection pending' },
        'admin-id',
      );
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
      expect(mockInventoryRepo.recordMovementWithDelta).not.toHaveBeenCalled();
    });
    it('rejects manual transition if reason is missing, empty, or whitespace-only', async () => {
      const assignedRouter = { ...mockRouter, status: 'ASSIGNED_TO_TECHNICIAN' as const };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(assignedRouter);

      // Missing reason
      await expect(
        service.transition(
          mockRouter.id,
          {
            status: 'RETURNED',
            targetWarehouseId: mockWarehouse.id,
          } as unknown as TransitionRouterDto,
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);

      // Empty string reason
      await expect(
        service.transition(
          mockRouter.id,
          { status: 'RETURNED', targetWarehouseId: mockWarehouse.id, reason: '' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);

      // Whitespace-only reason
      await expect(
        service.transition(
          mockRouter.id,
          { status: 'RETURNED', targetWarehouseId: mockWarehouse.id, reason: '   ' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockRoutersRepo.updateRouter).not.toHaveBeenCalled();
      expect(mockRoutersRepo.createStatusHistory).not.toHaveBeenCalled();
    });

    it('enforces whitelist and transitions ASSIGNED_TO_TECHNICIAN to RETURNED', async () => {
      const assignedRouter = { ...mockRouter, status: 'ASSIGNED_TO_TECHNICIAN' as const };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(assignedRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue({ ...assignedRouter, status: 'RETURNED' });
      mockRoutersRepo.createStatusHistory.mockResolvedValue({});

      const result = await service.transition(
        mockRouter.id,
        { status: 'RETURNED', targetWarehouseId: mockWarehouse.id, reason: 'Returned by tech' },
        'admin-id',
      );

      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalled();
      expect(mockRoutersRepo.createStatusHistory).toHaveBeenCalledWith(
        {
          routerId: mockRouter.id,
          fromStatus: 'ASSIGNED_TO_TECHNICIAN',
          toStatus: 'RETURNED',
          reason: 'Returned by tech',
          changedBy: 'admin-id',
        },
        expect.anything(),
      );
      expect(result.status).toBe('RETURNED');
    });

    it('rejects customer installation without changing technician custody', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN',
        physicalCondition: 'SERVICEABLE',
        warehouseId: null,
      });

      await expect(
        service.transition(
          mockRouter.id,
          { status: 'INSTALLED_AT_CUSTOMER', reason: 'Customer install completed' },
          'admin-id',
        ),
      ).rejects.toThrow('Customer installation is unavailable');

      expect(mockRoutersRepo.releaseActiveAssignment).not.toHaveBeenCalled();
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
      expect(mockRoutersRepo.updateRouter).not.toHaveBeenCalled();
      expect(mockRoutersRepo.createStatusHistory).not.toHaveBeenCalled();
    });

    it('rejects transition to INSTALLED_AT_CUSTOMER when router physicalCondition is not SERVICEABLE', async () => {
      const damagedTechRouter = {
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN' as const,
        physicalCondition: 'DAMAGED' as const,
      };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(damagedTechRouter);

      await expect(
        service.transition(
          mockRouter.id,
          { status: 'INSTALLED_AT_CUSTOMER', reason: 'Attempted damaged install' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
    });

    it('rejects transition to INSTALLED_AT_CUSTOMER when targetWarehouseId is provided', async () => {
      const assignedRouter = {
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN' as const,
        physicalCondition: 'SERVICEABLE' as const,
      };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(assignedRouter);

      await expect(
        service.transition(
          mockRouter.id,
          {
            status: 'INSTALLED_AT_CUSTOMER',
            targetWarehouseId: mockWarehouse.id,
            reason: 'Install attempt',
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
    });

    it('rejects transition to INSTALLED_AT_CUSTOMER when router lacks active technician custody', async () => {
      const assignedRouter = {
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN' as const,
        physicalCondition: 'SERVICEABLE' as const,
      };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(assignedRouter);
      mockRoutersRepo.findActiveAssignment.mockResolvedValue(null);

      await expect(
        service.transition(
          mockRouter.id,
          { status: 'INSTALLED_AT_CUSTOMER', reason: 'Customer install' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
    });

    it('transitions INSTALLED_AT_CUSTOMER to RETURNED: closes customer custody and requires targetWarehouseId', async () => {
      const installedRouter = {
        ...mockRouter,
        status: 'INSTALLED_AT_CUSTOMER' as const,
        warehouseId: null,
      };
      const customerCustody = {
        ...mockAssignment,
        holderType: 'CUSTOMER' as const,
        technicianId: null,
        warehouseId: null,
      };

      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(installedRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(customerCustody);
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...installedRouter,
        status: 'RETURNED',
        warehouseId: mockWarehouse.id,
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue(null);
      mockRoutersRepo.createStatusHistory.mockResolvedValue({});

      const result = await service.transition(
        mockRouter.id,
        {
          status: 'RETURNED',
          targetWarehouseId: mockWarehouse.id,
          reason: 'Customer cancellation return',
        },
        'admin-id',
      );

      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalled();
      expect(mockRoutersRepo.createStatusHistory).toHaveBeenCalledWith(
        {
          routerId: mockRouter.id,
          fromStatus: 'INSTALLED_AT_CUSTOMER',
          toStatus: 'RETURNED',
          reason: 'Customer cancellation return',
          changedBy: 'admin-id',
        },
        expect.anything(),
      );
      expect(mockRoutersRepo.updateRouter).toHaveBeenCalledWith(
        mockRouter.id,
        expect.objectContaining({
          status: 'RETURNED',
          warehouseId: mockWarehouse.id,
        }),
        expect.anything(),
      );
      expect(result.status).toBe('RETURNED');
    });

    it('rejects transition from INSTALLED_AT_CUSTOMER to RETURNED when targetWarehouseId is omitted', async () => {
      const installedRouter = {
        ...mockRouter,
        status: 'INSTALLED_AT_CUSTOMER' as const,
        warehouseId: null,
      };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(installedRouter);

      await expect(
        service.transition(
          mockRouter.id,
          { status: 'RETURNED', reason: 'Return from customer' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRoutersRepo.releaseActiveAssignment).not.toHaveBeenCalled();
    });

    it('rejects transition to RETURNED if target warehouse is deactivated', async () => {
      const assignedRouter = { ...mockRouter, status: 'ASSIGNED_TO_TECHNICIAN' as const };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(assignedRouter);
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue({ ...mockWarehouse, isActive: false });

      await expect(
        service.transition(
          mockRouter.id,
          {
            status: 'RETURNED',
            targetWarehouseId: mockWarehouse.id,
            reason: 'Return to warehouse',
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transition to AVAILABLE if target warehouse is deactivated', async () => {
      const returnedRouter = { ...mockRouter, status: 'RETURNED' as const };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(returnedRouter);
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue({ ...mockWarehouse, isActive: false });

      await expect(
        service.transition(
          mockRouter.id,
          {
            status: 'AVAILABLE',
            targetWarehouseId: mockWarehouse.id,
            reason: 'Inspected and available',
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects illegal transitions (AVAILABLE -> DAMAGED via transition) with 400 Bad Request even with a reason', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);

      await expect(
        service.transition(
          mockRouter.id,
          { status: 'DAMAGED', reason: 'Field failure' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRoutersRepo.createStatusHistory).not.toHaveBeenCalled();
    });

    it('rejects any transition from terminal status (LOST / DECOMMISSIONED)', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'DECOMMISSIONED' as const,
      });

      await expect(
        service.transition(
          mockRouter.id,
          { status: 'AVAILABLE', reason: 'Revival attempt' },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRoutersRepo.createStatusHistory).not.toHaveBeenCalled();
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

    it('A-to-B move decrements A, increments B and moves custody once', async () => {
      const warehouseBId = '88888888-8888-4888-8888-888888888888';
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'AVAILABLE',
        physicalCondition: 'SERVICEABLE',
        warehouseId: mockWarehouse.id,
      });
      mockWarehousesRepo.findById.mockResolvedValue({
        id: warehouseBId,
        name: 'Hub B',
        isActive: true,
      });
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.createAssignment.mockResolvedValue({
        ...mockAssignment,
        warehouseId: warehouseBId,
      });
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        warehouseId: warehouseBId,
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue({
        ...mockAssignment,
        warehouseId: warehouseBId,
      });

      const result = await service.updateCondition(
        mockRouter.id,
        {
          physicalCondition: 'SERVICEABLE',
          warehouseId: warehouseBId,
          reason: 'Relocating to Hub B',
        },
        'admin-id',
      );

      // Decrement A (-1)
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: mockWarehouse.id,
          movementType: 'TRANSFER_WAREHOUSE',
        }),
        -1,
        expect.anything(),
      );

      // Increment B (+1)
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: warehouseBId,
          movementType: 'TRANSFER_WAREHOUSE',
        }),
        1,
        expect.anything(),
      );

      // Released old custody on A, created new custody on B
      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalledTimes(1);
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: warehouseBId,
          holderType: 'WAREHOUSE',
        }),
        expect.anything(),
      );

      expect(result.warehouseId).toBe(warehouseBId);
      expect(result.currentHolderId).toBe(warehouseBId);
    });

    it('removes usable contribution and applicable custody when condition changes directly to UNDER_REPAIR', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'AVAILABLE',
        physicalCondition: 'SERVICEABLE',
        warehouseId: mockWarehouse.id,
      });
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        physicalCondition: 'UNDER_REPAIR',
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue(undefined);

      const result = await service.updateCondition(
        mockRouter.id,
        {
          physicalCondition: 'UNDER_REPAIR',
          reason: 'Port flapping defect discovered',
        },
        'admin-id',
      );

      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: mockWarehouse.id,
          movementType: 'ADJUSTMENT',
        }),
        -1,
        expect.anything(),
      );
      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalled();
      expect(result.physicalCondition).toBe('UNDER_REPAIR');
      expect(result.currentHolderId).toBeNull();
    });

    it('clears physical warehouse placement and retains auditable prior location when sent for external repair', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'AVAILABLE',
        physicalCondition: 'UNDER_REPAIR',
        warehouseId: mockWarehouse.id,
        externalLocation: null,
      });
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        physicalCondition: 'UNDER_REPAIR',
        warehouseId: null,
        externalLocation: 'Apex Router Repairs Inc.',
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue(undefined);

      const result = await service.updateCondition(
        mockRouter.id,
        {
          physicalCondition: 'UNDER_REPAIR',
          externalLocation: 'Apex Router Repairs Inc.',
          reason: 'Board-level soldering required',
        },
        'admin-id',
      );

      // Condition history recorded prior warehouse and new external location
      expect(mockRoutersRepo.createConditionHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          fromWarehouseId: mockWarehouse.id,
          toWarehouseId: null,
          externalLocation: 'Apex Router Repairs Inc.',
        }),
        expect.anything(),
      );

      // Router record has null warehouseId and externalLocation set
      expect(mockRoutersRepo.updateRouter).toHaveBeenCalledWith(
        mockRouter.id,
        expect.objectContaining({
          warehouseId: null,
          externalLocation: 'Apex Router Repairs Inc.',
        }),
        expect.anything(),
      );

      expect(result.warehouseId).toBeNull();
      expect(result.externalLocation).toBe('Apex Router Repairs Inc.');
    });

    it('restoring serviceability adds stock only when lifecycle is AVAILABLE and location is a warehouse', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'AVAILABLE',
        physicalCondition: 'UNDER_REPAIR',
        warehouseId: null,
        externalLocation: 'Apex Router Repairs Inc.',
      });
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});
      mockRoutersRepo.createAssignment.mockResolvedValue({
        ...mockAssignment,
        warehouseId: mockWarehouse.id,
      });
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        physicalCondition: 'SERVICEABLE',
        warehouseId: mockWarehouse.id,
        externalLocation: null,
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue({
        ...mockAssignment,
        warehouseId: mockWarehouse.id,
      });

      const result = await service.updateCondition(
        mockRouter.id,
        {
          physicalCondition: 'SERVICEABLE',
          warehouseId: mockWarehouse.id,
          reason: 'Returned from external repair QA passed',
        },
        'admin-id',
      );

      // Increments destination warehouse stock (+1)
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: mockWarehouse.id,
          movementType: 'ADJUSTMENT',
        }),
        1,
        expect.anything(),
      );
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: mockWarehouse.id,
          holderType: 'WAREHOUSE',
        }),
        expect.anything(),
      );
      expect(result.warehouseId).toBe(mockWarehouse.id);
      expect(result.physicalCondition).toBe('SERVICEABLE');
    });

    it('restoring serviceability does NOT add stock when lifecycle does not permit it (e.g. ASSIGNED_TO_TECHNICIAN)', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue({
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN',
        physicalCondition: 'DAMAGED',
        warehouseId: null,
      });
      mockRoutersRepo.createConditionHistory.mockResolvedValue({});
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN',
        physicalCondition: 'SERVICEABLE',
        warehouseId: null,
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue({
        ...mockAssignment,
        holderType: 'TECHNICIAN',
      });

      const result = await service.updateCondition(
        mockRouter.id,
        {
          physicalCondition: 'SERVICEABLE',
          reason: 'Field technician replaced faulty power adapter',
        },
        'admin-id',
      );

      // No stock delta applied because lifecycle is not AVAILABLE in warehouse
      expect(mockInventoryRepo.recordMovementWithDelta).not.toHaveBeenCalled();
      expect(mockRoutersRepo.createAssignment).not.toHaveBeenCalled();
      expect(result.status).toBe('ASSIGNED_TO_TECHNICIAN');
      expect(result.physicalCondition).toBe('SERVICEABLE');
    });

    it('rejects updateCondition if target warehouse is deactivated', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue({ ...mockWarehouse, isActive: false });

      await expect(
        service.updateCondition(
          mockRouter.id,
          {
            physicalCondition: 'SERVICEABLE',
            warehouseId: 'deactivated-wh-id',
            reason: 'Transfer to regional branch',
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transaction atomicity & caller-owned externalTx', () => {
    it('executes create entirely within externalTx when provided', async () => {
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
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue(mockRouter);
      mockInventoryRepo.recordMovementWithDelta.mockResolvedValueOnce(mockMovementResult);

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

    it('rolls back completely when an injected failure occurs during assign', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue(mockRouter);
      mockInventoryRepo.recordMovementWithDelta.mockRejectedValueOnce(
        new Error('Injected stock reduction failure'),
      );

      await expect(
        service.assign(mockRouter.id, { technicianId: 'tech-1' }, 'admin-id'),
      ).rejects.toThrow('Injected stock reduction failure');
    });

    it('executes transition entirely within externalTx when provided', async () => {
      const returnedRouter = { ...mockRouter, status: 'RETURNED' as const };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(returnedRouter);
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue(mockWarehouse);
      mockRoutersRepo.updateRouter.mockResolvedValue({ ...returnedRouter, status: 'AVAILABLE' });
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockInventoryRepo.recordMovementWithDelta.mockResolvedValueOnce(mockMovementResult);
      mockRoutersRepo.createStatusHistory.mockResolvedValue(mockStatusHistory);
      mockRoutersRepo.findActiveAssignment.mockResolvedValue(mockAssignment);

      await service.transition(
        mockRouter.id,
        {
          status: 'AVAILABLE',
          reason: 'Inspection passed',
          targetWarehouseId: mockWarehouse.id,
        },
        'admin-id',
        mockExternalTx,
      );

      expect(mockRepositoryService.transaction).not.toHaveBeenCalled();
      expect(mockRoutersRepo.findByIdForUpdate).toHaveBeenCalledWith(mockRouter.id, mockExternalTx);
      expect(mockWarehousesRepo.findByIdForUpdate).toHaveBeenCalledWith(
        mockWarehouse.id,
        mockExternalTx,
      );
      expect(mockRoutersRepo.createAssignment).toHaveBeenCalledWith(
        expect.anything(),
        mockExternalTx,
      );
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.anything(),
        1,
        mockExternalTx,
      );
      expect(mockRoutersRepo.updateRouter).toHaveBeenCalledWith(
        mockRouter.id,
        expect.anything(),
        mockExternalTx,
      );
      expect(mockRoutersRepo.createStatusHistory).toHaveBeenCalledWith(
        expect.anything(),
        mockExternalTx,
      );
    });

    it('rolls back completely when an injected failure occurs during transition', async () => {
      const returnedRouter = { ...mockRouter, status: 'RETURNED' as const };
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(returnedRouter);
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue(mockWarehouse);
      mockRoutersRepo.updateRouter.mockResolvedValue({ ...returnedRouter, status: 'AVAILABLE' });
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockInventoryRepo.recordMovementWithDelta.mockResolvedValueOnce(mockMovementResult);
      mockRoutersRepo.createStatusHistory.mockRejectedValueOnce(
        new Error('Injected status history audit failure'),
      );

      await expect(
        service.transition(
          mockRouter.id,
          {
            status: 'AVAILABLE',
            reason: 'Inspection passed',
            targetWarehouseId: mockWarehouse.id,
          },
          'admin-id',
        ),
      ).rejects.toThrow('Injected status history audit failure');
    });

    it('executes updateCondition entirely within externalTx when provided', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue(mockWarehouse);
      mockRoutersRepo.createConditionHistory.mockResolvedValue(mockConditionHistory);
      mockInventoryRepo.recordMovementWithDelta.mockResolvedValueOnce(mockMovementResult);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue({
        ...mockRouter,
        physicalCondition: 'DAMAGED',
      });
      mockRoutersRepo.findActiveAssignment.mockResolvedValue(null);

      await service.updateCondition(
        mockRouter.id,
        {
          physicalCondition: 'DAMAGED',
          reason: 'Dropped during inspection',
        },
        'admin-id',
        mockExternalTx,
      );

      expect(mockRepositoryService.transaction).not.toHaveBeenCalled();
      expect(mockRoutersRepo.findByIdForUpdate).toHaveBeenCalledWith(mockRouter.id, mockExternalTx);
      expect(mockRoutersRepo.createConditionHistory).toHaveBeenCalledWith(
        expect.anything(),
        mockExternalTx,
      );
      expect(mockInventoryRepo.recordMovementWithDelta).toHaveBeenCalledWith(
        expect.anything(),
        -1,
        mockExternalTx,
      );
      expect(mockRoutersRepo.releaseActiveAssignment).toHaveBeenCalledWith(
        mockRouter.id,
        expect.any(Date),
        mockExternalTx,
      );
    });

    it('rolls back completely when an injected failure occurs during updateCondition', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockWarehousesRepo.findByIdForUpdate.mockResolvedValue(mockWarehouse);
      mockRoutersRepo.createConditionHistory.mockRejectedValueOnce(
        new Error('Injected condition history audit failure'),
      );

      await expect(
        service.updateCondition(
          mockRouter.id,
          {
            physicalCondition: 'DAMAGED',
            reason: 'Dropped during inspection',
          },
          'admin-id',
        ),
      ).rejects.toThrow('Injected condition history audit failure');
    });

    it('rejects and aborts when inventory recordMovementWithDelta throws BadRequestException (insufficient stock)', async () => {
      mockRoutersRepo.findByIdForUpdate.mockResolvedValue(mockRouter);
      mockRoutersRepo.releaseActiveAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.createAssignment.mockResolvedValue(mockAssignment);
      mockRoutersRepo.updateRouter.mockResolvedValue(mockRouter);
      mockInventoryRepo.recordMovementWithDelta.mockRejectedValueOnce(
        new BadRequestException('Insufficient stock in warehouse: available 0, requested 1'),
      );

      await expect(
        service.assign(mockRouter.id, { technicianId: 'tech-1' }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
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

  describe('getStatusHistory', () => {
    it('returns formatted lifecycle status audit history for a valid router', async () => {
      mockRoutersRepo.findById.mockResolvedValue(mockRouter);
      const mockHistory = [
        {
          id: 'hist-1',
          routerId: mockRouter.id,
          fromStatus: 'AVAILABLE' as const,
          toStatus: 'ASSIGNED_TO_TECHNICIAN' as const,
          reason: 'Initial assignment to technician',
          changedBy: 'user-1',
          createdAt: new Date('2026-11-01T12:00:00.000Z'),
        },
      ];
      mockRoutersRepo.findStatusHistory.mockResolvedValue(mockHistory);

      const result = await service.getStatusHistory(mockRouter.id);

      expect(mockRoutersRepo.findById).toHaveBeenCalledWith(mockRouter.id);
      expect(mockRoutersRepo.findStatusHistory).toHaveBeenCalledWith(mockRouter.id);
      expect(result).toEqual([
        {
          id: 'hist-1',
          routerId: mockRouter.id,
          fromStatus: 'AVAILABLE',
          toStatus: 'ASSIGNED_TO_TECHNICIAN',
          reason: 'Initial assignment to technician',
          changedBy: 'user-1',
          createdAt: '2026-11-01T12:00:00.000Z',
        },
      ]);
    });

    it('throws NotFoundException when router does not exist', async () => {
      mockRoutersRepo.findById.mockResolvedValue(null);

      await expect(service.getStatusHistory('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(mockRoutersRepo.findStatusHistory).not.toHaveBeenCalled();
    });
  });
});
