import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { Role, type EmployeeLookupDto } from '@alfahd/types';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';

describe('EmployeesController', () => {
  let controller: EmployeesController;
  let employeesServiceMock: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    lookup: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    uploadPhoto: ReturnType<typeof vi.fn>;
  };

  const mockLookupResult: EmployeeLookupDto[] = [
    {
      id: 'tech-1',
      name: 'Mahmoud Ahmed',
      role: Role.TECHNICIAN,
      status: 'ACTIVE',
      isEligible: true,
      assignedWarehouseId: 'warehouse-1',
    },
    {
      id: 'tech-2',
      name: 'Ali Hassan',
      role: Role.TECHNICIAN,
      status: 'ACTIVE',
      isEligible: true,
      assignedWarehouseId: 'warehouse-1',
    },
  ];

  beforeEach(async () => {
    employeesServiceMock = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      lookup: vi.fn().mockResolvedValue(mockLookupResult),
      update: vi.fn(),
      updateStatus: vi.fn(),
      uploadPhoto: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        {
          provide: EmployeesService,
          useValue: employeesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('lookup endpoint RBAC and routing', () => {
    it('grants access to both ADMIN and WAREHOUSE_STAFF for lookup', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.lookup);
      expect(roles).toEqual([Role.ADMIN, Role.WAREHOUSE_STAFF]);
    });

    it('keeps findAll restricted strictly to ADMIN only', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.findAll);
      expect(roles).toEqual([Role.ADMIN]);
    });

    it('delegates lookup parameters to employeesService.lookup', async () => {
      const query = {
        role: Role.TECHNICIAN,
        warehouseId: 'warehouse-1',
        limit: 25,
      };

      const result = await controller.lookup(query);

      expect(employeesServiceMock.lookup).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockLookupResult);
      expect(result).toHaveLength(2);
    });

    it('ensures lookup items contain zero PII fields (SEC-04)', async () => {
      const result = await controller.lookup({ role: Role.TECHNICIAN });

      for (const item of result) {
        const raw = item as unknown as Record<string, unknown>;
        expect(raw.email).toBeUndefined();
        expect(raw.phone).toBeUndefined();
        expect(raw.nationalId).toBeUndefined();
        expect(raw.hireDate).toBeUndefined();
        expect(raw.department).toBeUndefined();
        expect(raw.salary).toBeUndefined();
        expect(raw.profilePhotoKey).toBeUndefined();
      }
    });
  });
});
