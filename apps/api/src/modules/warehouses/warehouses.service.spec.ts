import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WarehousesService } from './warehouses.service.js';
import { RepositoryService } from '../repository/repository.service.js';
import type { Warehouse } from '../../entities/warehouses.entity.js';
import type { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehousesDto } from './dto/index.js';

describe('WarehousesService', () => {
  let service: WarehousesService;

  const mockWarehouse: Warehouse = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Cairo Main Hub',
    address: 'Building 14, Ring Road, Cairo',
    latitude: 30.0444,
    longitude: 31.2357,
    geofenceRadiusMeters: 150,
    managerId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockWarehousesRepo = {
    findByName: vi.fn(),
    findById: vi.fn(),
    findManyWithPagination: vi.fn(),
    create: vi.fn(),
    updateWarehouse: vi.fn(),
    deleteById: vi.fn(),
    countActiveInventory: vi.fn(),
    countAssignedStaff: vi.fn(),
    canDeleteWarehouse: vi.fn(),
  };

  const mockRepositoryService = {
    warehouses: mockWarehousesRepo,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWarehouse', () => {
    const dto: CreateWarehouseDto = {
      name: 'Cairo Main Hub',
      address: 'Building 14, Ring Road, Cairo',
      latitude: 30.0444,
      longitude: 31.2357,
      geofenceRadiusMeters: 150,
    };

    it('should create a warehouse successfully when name is unique', async () => {
      mockWarehousesRepo.findByName.mockResolvedValue(undefined);
      mockWarehousesRepo.create.mockResolvedValue(mockWarehouse);

      const result = await service.createWarehouse(dto);

      expect(mockWarehousesRepo.findByName).toHaveBeenCalledWith('Cairo Main Hub');
      expect(mockWarehousesRepo.create).toHaveBeenCalledWith({
        name: 'Cairo Main Hub',
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geofenceRadiusMeters: 150,
        managerId: null,
      });
      expect(result).toEqual(mockWarehouse);
    });

    it('should throw ConflictException if warehouse name already exists', async () => {
      mockWarehousesRepo.findByName.mockResolvedValue(mockWarehouse);

      await expect(service.createWarehouse(dto)).rejects.toThrow(ConflictException);
      expect(mockWarehousesRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated warehouses', async () => {
      const query: QueryWarehousesDto = { limit: 10, offset: 0, search: 'Cairo' };
      const expected = { items: [mockWarehouse], total: 1 };
      mockWarehousesRepo.findManyWithPagination.mockResolvedValue(expected);

      const result = await service.findAll(query);

      expect(mockWarehousesRepo.findManyWithPagination).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('findById', () => {
    it('should return warehouse when found', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);

      const result = await service.findById(mockWarehouse.id);

      expect(mockWarehousesRepo.findById).toHaveBeenCalledWith(mockWarehouse.id);
      expect(result).toEqual(mockWarehouse);
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateWarehouseDto = { name: 'Alex Hub', geofenceRadiusMeters: 200 };

    it('should update warehouse successfully', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockWarehousesRepo.findByName.mockResolvedValue(undefined);
      mockWarehousesRepo.updateWarehouse.mockResolvedValue({ ...mockWarehouse, ...updateDto });

      const result = await service.update(mockWarehouse.id, updateDto);

      expect(mockWarehousesRepo.findById).toHaveBeenCalledWith(mockWarehouse.id);
      expect(mockWarehousesRepo.updateWarehouse).toHaveBeenCalledWith(mockWarehouse.id, {
        name: 'Alex Hub',
        geofenceRadiusMeters: 200,
      });
      expect(result.name).toBe('Alex Hub');
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(null);

      await expect(service.update('missing-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if updated name is taken by another warehouse', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockWarehousesRepo.findByName.mockResolvedValue({
        ...mockWarehouse,
        id: 'different-uuid-2222',
        name: 'Alex Hub',
      });

      await expect(service.update(mockWarehouse.id, updateDto)).rejects.toThrow(ConflictException);
      expect(mockWarehousesRepo.updateWarehouse).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete warehouse when no active inventory and no staff assigned', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockWarehousesRepo.canDeleteWarehouse.mockResolvedValue({ canDelete: true });
      mockWarehousesRepo.deleteById.mockResolvedValue(undefined);

      await expect(service.remove(mockWarehouse.id)).resolves.not.toThrow();

      expect(mockWarehousesRepo.findById).toHaveBeenCalledWith(mockWarehouse.id);
      expect(mockWarehousesRepo.canDeleteWarehouse).toHaveBeenCalledWith(mockWarehouse.id);
      expect(mockWarehousesRepo.deleteById).toHaveBeenCalledWith(mockWarehouse.id);
    });

    it('should throw NotFoundException if warehouse to delete is not found', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
      expect(mockWarehousesRepo.deleteById).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if warehouse holds inventory or assigned staff', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockWarehousesRepo.canDeleteWarehouse.mockResolvedValue({
        canDelete: false,
        reason: 'Cannot delete warehouse holding active inventory (50 units in stock)',
      });

      await expect(service.remove(mockWarehouse.id)).rejects.toThrow(ConflictException);
      expect(mockWarehousesRepo.deleteById).not.toHaveBeenCalled();
    });
  });
});
