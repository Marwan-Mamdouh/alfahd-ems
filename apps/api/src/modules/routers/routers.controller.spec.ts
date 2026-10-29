import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { RoutersController } from './routers.controller.js';
import { RoutersService } from './routers.service.js';
import type { JwtUser } from '../../auth/strategies/jwt.strategy.js';
import type {
  CreateRouterDto,
  AssignRouterDto,
  UpdateRouterConditionDto,
  TransitionRouterDto,
  RouterQueryDto,
} from './dto/index.js';
import type {
  RouterDto,
  RouterAssignmentDto,
  RouterConditionHistoryDto,
  RouterReportQueryDto,
} from '@alfahd/types';

describe('RoutersController', () => {
  let controller: RoutersController;

  const mockUser: JwtUser = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'admin@alfahd.local',
    tokenId: 'token-123',
    role: 'ADMIN' as any,
  };

  const mockRouter: RouterDto = {
    id: '22222222-2222-2222-2222-222222222222',
    serialNumber: 'SN-RT-001',
    productId: '33333333-3333-3333-3333-333333333333',
    status: 'AVAILABLE',
    physicalCondition: 'SERVICEABLE',
    warehouseId: '44444444-4444-4444-4444-444444444444',
    externalLocation: null,
    currentHolderType: 'WAREHOUSE',
    currentHolderId: '44444444-4444-4444-4444-444444444444',
    notes: 'Initial receipt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockAssignment: RouterAssignmentDto = {
    id: '55555555-5555-5555-5555-555555555555',
    routerId: mockRouter.id,
    holderType: 'TECHNICIAN',
    warehouseId: null,
    technicianId: '66666666-6666-6666-6666-666666666666',
    assignedBy: mockUser.userId,
    assignedAt: '2026-01-02T00:00:00.000Z',
    releasedAt: null,
    notes: 'Handed to tech',
  };

  const mockConditionHistory: RouterConditionHistoryDto = {
    id: '77777777-7777-7777-7777-777777777777',
    routerId: mockRouter.id,
    fromCondition: 'SERVICEABLE',
    toCondition: 'DAMAGED',
    fromWarehouseId: '44444444-4444-4444-4444-444444444444',
    toWarehouseId: '44444444-4444-4444-4444-444444444444',
    externalLocation: null,
    reason: 'Dropped on floor',
    changedBy: mockUser.userId,
    createdAt: '2026-01-03T00:00:00.000Z',
  };

  const mockRoutersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    assign: vi.fn(),
    transition: vi.fn(),
    updateCondition: vi.fn(),
    getAssignments: vi.fn(),
    getConditionHistory: vi.fn(),
    exportRouterReport: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutersController],
      providers: [
        {
          provide: RoutersService,
          useValue: mockRoutersService,
        },
      ],
    }).compile();

    controller = module.get<RoutersController>(RoutersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call routersService.create with dto and userId', async () => {
      const dto: CreateRouterDto = {
        serialNumber: 'SN-RT-001',
        productId: '33333333-3333-3333-3333-333333333333',
        warehouseId: '44444444-4444-4444-4444-444444444444',
        physicalCondition: 'SERVICEABLE',
        isNewReceipt: true,
      };
      mockRoutersService.create.mockResolvedValue(mockRouter);

      const result = await controller.create(dto, mockUser);

      expect(mockRoutersService.create).toHaveBeenCalledWith(dto, mockUser.userId);
      expect(result).toEqual(mockRouter);
    });
  });

  describe('findAll', () => {
    it('should call routersService.findAll with query', async () => {
      const query: RouterQueryDto = { page: 1, limit: 10, status: 'AVAILABLE' };
      mockRoutersService.findAll.mockResolvedValue({ items: [mockRouter], total: 1 });

      const result = await controller.findAll(query);

      expect(mockRoutersService.findAll).toHaveBeenCalledWith(query);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return router by UUID', async () => {
      mockRoutersService.findById.mockResolvedValue(mockRouter);

      const result = await controller.findById(mockRouter.id);

      expect(mockRoutersService.findById).toHaveBeenCalledWith(mockRouter.id);
      expect(result).toEqual(mockRouter);
    });
  });

  describe('assign', () => {
    it('should call routersService.assign with router id, dto and userId', async () => {
      const dto: AssignRouterDto = {
        technicianId: '66666666-6666-6666-6666-666666666666',
        notes: 'Handed to tech',
      };
      const assignedRouter = {
        ...mockRouter,
        status: 'ASSIGNED_TO_TECHNICIAN' as const,
        currentHolderType: 'TECHNICIAN' as const,
        currentHolderId: '66666666-6666-6666-6666-666666666666',
      };
      mockRoutersService.assign.mockResolvedValue(assignedRouter);

      const result = await controller.assign(mockRouter.id, dto, mockUser);

      expect(mockRoutersService.assign).toHaveBeenCalledWith(mockRouter.id, dto, mockUser.userId);
      expect(result.status).toBe('ASSIGNED_TO_TECHNICIAN');
    });
  });

  describe('transition', () => {
    it('should call routersService.transition with id, dto, and userId', async () => {
      const dto: TransitionRouterDto = {
        status: 'RETURNED',
        reason: 'Client moved',
      };
      const returnedRouter = { ...mockRouter, status: 'RETURNED' as const };
      mockRoutersService.transition.mockResolvedValue(returnedRouter);

      const result = await controller.transition(mockRouter.id, dto, mockUser);

      expect(mockRoutersService.transition).toHaveBeenCalledWith(
        mockRouter.id,
        dto,
        mockUser.userId,
      );
      expect(result.status).toBe('RETURNED');
    });
  });

  describe('updateCondition', () => {
    it('should call routersService.updateCondition with id, dto, and userId', async () => {
      const dto: UpdateRouterConditionDto = {
        physicalCondition: 'DAMAGED',
        reason: 'Broken antenna',
      };
      const damagedRouter = { ...mockRouter, physicalCondition: 'DAMAGED' as const };
      mockRoutersService.updateCondition.mockResolvedValue(damagedRouter);

      const result = await controller.updateCondition(mockRouter.id, dto, mockUser);

      expect(mockRoutersService.updateCondition).toHaveBeenCalledWith(
        mockRouter.id,
        dto,
        mockUser.userId,
      );
      expect(result.physicalCondition).toBe('DAMAGED');
    });
  });

  describe('getAssignments', () => {
    it('should call routersService.getAssignments', async () => {
      mockRoutersService.getAssignments.mockResolvedValue([mockAssignment]);

      const result = await controller.getAssignments(mockRouter.id);

      expect(mockRoutersService.getAssignments).toHaveBeenCalledWith(mockRouter.id);
      expect(result).toEqual([mockAssignment]);
    });
  });

  describe('getConditionHistory', () => {
    it('should call routersService.getConditionHistory', async () => {
      mockRoutersService.getConditionHistory.mockResolvedValue([mockConditionHistory]);

      const result = await controller.getConditionHistory(mockRouter.id);

      expect(mockRoutersService.getConditionHistory).toHaveBeenCalledWith(mockRouter.id);
      expect(result).toEqual([mockConditionHistory]);
    });
  });

  describe('exportReport', () => {
    it('should call routersService.exportRouterReport with dto and userId', async () => {
      const dto: RouterReportQueryDto = { warehouseId: '44444444-4444-4444-4444-444444444444' };
      mockRoutersService.exportRouterReport.mockResolvedValue({ jobId: 'job-xyz-123' });

      const result = await controller.exportReport(dto, mockUser);

      expect(mockRoutersService.exportRouterReport).toHaveBeenCalledWith(dto, mockUser.userId);
      expect(result.jobId).toBe('job-xyz-123');
    });
  });
});
