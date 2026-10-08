import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { WarehousesController } from './warehouses.controller.js';
import { WarehousesService } from './warehouses.service.js';
import type { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehousesDto } from './dto/index.js';
import type { Warehouse } from '../../entities/warehouses.entity.js';

describe('WarehousesController', () => {
  let controller: WarehousesController;

  const mockWarehouse: Warehouse = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Cairo Main Hub',
    address: 'Building 14, Ring Road, Cairo',
    latitude: 30.0444,
    longitude: 31.2357,
    geofenceRadiusMeters: 150,
    managerId: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockWarehousesService = {
    createWarehouse: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarehousesController],
      providers: [
        {
          provide: WarehousesService,
          useValue: mockWarehousesService,
        },
      ],
    }).compile();

    controller = module.get<WarehousesController>(WarehousesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call warehousesService.createWarehouse with dto', async () => {
      const dto: CreateWarehouseDto = {
        name: 'Cairo Main Hub',
        address: 'Building 14, Ring Road, Cairo',
        latitude: 30.0444,
        longitude: 31.2357,
        geofenceRadiusMeters: 150,
      };
      mockWarehousesService.createWarehouse.mockResolvedValue(mockWarehouse);

      const result = await controller.create(dto);

      expect(mockWarehousesService.createWarehouse).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockWarehouse);
    });
  });

  describe('findAll', () => {
    it('should call warehousesService.findAll with query params', async () => {
      const query: QueryWarehousesDto = { limit: 10, offset: 0, search: 'Cairo' };
      mockWarehousesService.findAll.mockResolvedValue({ items: [mockWarehouse], total: 1 });

      const result = await controller.findAll(query);

      expect(mockWarehousesService.findAll).toHaveBeenCalledWith(query);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single warehouse by UUID', async () => {
      mockWarehousesService.findById.mockResolvedValue(mockWarehouse);

      const result = await controller.findOne(mockWarehouse.id);

      expect(mockWarehousesService.findById).toHaveBeenCalledWith(mockWarehouse.id);
      expect(result).toEqual(mockWarehouse);
    });
  });

  describe('update', () => {
    it('should call warehousesService.update with id and dto', async () => {
      const updateDto: UpdateWarehouseDto = { name: 'Updated Hub' };
      mockWarehousesService.update.mockResolvedValue({ ...mockWarehouse, ...updateDto });

      const result = await controller.update(mockWarehouse.id, updateDto);

      expect(mockWarehousesService.update).toHaveBeenCalledWith(mockWarehouse.id, updateDto);
      expect(result.name).toBe('Updated Hub');
    });
  });

  describe('remove', () => {
    it('should call warehousesService.remove with id', async () => {
      mockWarehousesService.remove.mockResolvedValue(undefined);

      await controller.remove(mockWarehouse.id);

      expect(mockWarehousesService.remove).toHaveBeenCalledWith(mockWarehouse.id);
    });
  });
});
