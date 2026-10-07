import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { RepositoryService } from '../repository/repository.service.js';
import type { WarehouseInventory, StockMovement } from '../../entities/inventory.entity.js';
import type {
  InboundStockDto,
  OutboundStockDto,
  ReturnStockDto,
  TransferStockDto,
  AdjustStockDto,
  QueryInventoryDto,
  QueryStockMovementsDto,
} from './dto/index.js';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockWarehouseId = '11111111-1111-1111-1111-111111111111';
  const mockDestWarehouseId = '22222222-2222-2222-2222-222222222222';
  const mockProductId = '33333333-3333-3333-3333-333333333333';
  const mockTechId = '44444444-4444-4444-4444-444444444444';
  const mockUserId = '55555555-5555-5555-5555-555555555555';

  const mockWarehouse = {
    id: mockWarehouseId,
    name: 'Cairo Main Hub',
  };

  const mockDestWarehouse = {
    id: mockDestWarehouseId,
    name: 'Alexandria Branch',
  };

  const mockProduct = {
    id: mockProductId,
    name: 'Drop Cable 1-Core',
    sku: 'CAB-DROP-1C',
    lowStockThreshold: 10,
  };

  const mockInventory: WarehouseInventory = {
    id: '66666666-6666-6666-6666-666666666666',
    warehouseId: mockWarehouseId,
    productId: mockProductId,
    quantity: 100,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockStockMovement: StockMovement = {
    id: '77777777-7777-7777-7777-777777777777',
    warehouseId: mockWarehouseId,
    productId: mockProductId,
    movementType: 'INBOUND_SUPPLIER',
    quantity: 50,
    supplierName: 'El-Sewedy',
    technicianId: null,
    responsibleUserId: mockUserId,
    notes: 'Initial delivery',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockInventoryRepo = {
    getStock: vi.fn(),
    findManyInventory: vi.fn(),
    recordMovementInTransaction: vi.fn(),
    executeTransferInTransaction: vi.fn(),
    findManyMovements: vi.fn(),
    findMovementById: vi.fn(),
  };

  const mockWarehousesRepo = {
    findById: vi.fn(),
  };

  const mockProductsRepo = {
    findById: vi.fn(),
  };

  const mockRepositoryService = {
    inventory: mockInventoryRepo,
    warehouses: mockWarehousesRepo,
    products: mockProductsRepo,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('receiveInbound', () => {
    const dto: InboundStockDto = {
      warehouseId: mockWarehouseId,
      productId: mockProductId,
      quantity: 50,
      supplierName: 'El-Sewedy Electric',
      responsibleUserId: mockUserId,
      notes: 'Morning shipment',
    };

    it('should successfully receive inbound stock and log movement', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStock.mockResolvedValue(mockInventory); // current: 100
      mockInventoryRepo.recordMovementInTransaction.mockResolvedValue({
        inventory: { ...mockInventory, quantity: 150 },
        movement: mockStockMovement,
      });

      const result = await service.receiveInbound(dto);

      expect(mockWarehousesRepo.findById).toHaveBeenCalledWith(mockWarehouseId);
      expect(mockProductsRepo.findById).toHaveBeenCalledWith(mockProductId);
      expect(mockInventoryRepo.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouseId: mockWarehouseId,
          productId: mockProductId,
          movementType: 'INBOUND_SUPPLIER',
          quantity: 50,
          supplierName: 'El-Sewedy Electric',
        }),
        150, // newQuantity = 100 + 50
      );
      expect(result.inventory.quantity).toBe(150);
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(null);

      await expect(service.receiveInbound(dto)).rejects.toThrow(NotFoundException);
      expect(mockInventoryRepo.recordMovementInTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(null);

      await expect(service.receiveInbound(dto)).rejects.toThrow(NotFoundException);
      expect(mockInventoryRepo.recordMovementInTransaction).not.toHaveBeenCalled();
    });
  });

  describe('issueOutbound', () => {
    const dto: OutboundStockDto = {
      warehouseId: mockWarehouseId,
      productId: mockProductId,
      technicianId: mockTechId,
      quantity: 30,
      responsibleUserId: mockUserId,
    };

    it('should issue outbound stock when sufficient stock exists', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStock.mockResolvedValue(mockInventory); // current: 100
      mockInventoryRepo.recordMovementInTransaction.mockResolvedValue({
        inventory: { ...mockInventory, quantity: 70 },
        movement: { ...mockStockMovement, movementType: 'OUTBOUND_TECHNICIAN' },
      });

      const result = await service.issueOutbound(dto);

      expect(mockInventoryRepo.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'OUTBOUND_TECHNICIAN',
          quantity: 30,
          technicianId: mockTechId,
        }),
        70, // 100 - 30
      );
      expect(result.inventory.quantity).toBe(70);
    });

    it('should throw BadRequestException if available stock is insufficient', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStock.mockResolvedValue({ ...mockInventory, quantity: 20 });

      await expect(service.issueOutbound({ ...dto, quantity: 50 })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockInventoryRepo.recordMovementInTransaction).not.toHaveBeenCalled();
    });
  });

  describe('receiveReturn', () => {
    const dto: ReturnStockDto = {
      warehouseId: mockWarehouseId,
      productId: mockProductId,
      technicianId: mockTechId,
      quantity: 10,
      responsibleUserId: mockUserId,
    };

    it('should receive returned stock from technician', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStock.mockResolvedValue(mockInventory); // 100
      mockInventoryRepo.recordMovementInTransaction.mockResolvedValue({
        inventory: { ...mockInventory, quantity: 110 },
        movement: { ...mockStockMovement, movementType: 'RETURN_TECHNICIAN' },
      });

      const result = await service.receiveReturn(dto);

      expect(mockInventoryRepo.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'RETURN_TECHNICIAN',
          quantity: 10,
        }),
        110,
      );
      expect(result.inventory.quantity).toBe(110);
    });
  });

  describe('transferStock', () => {
    const dto: TransferStockDto = {
      fromWarehouseId: mockWarehouseId,
      toWarehouseId: mockDestWarehouseId,
      productId: mockProductId,
      quantity: 40,
      responsibleUserId: mockUserId,
    };

    it('should transfer stock between two warehouses atomically', async () => {
      mockWarehousesRepo.findById
        .mockResolvedValueOnce(mockWarehouse)
        .mockResolvedValueOnce(mockDestWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStock
        .mockResolvedValueOnce({ ...mockInventory, quantity: 100 }) // source: 100
        .mockResolvedValueOnce({ ...mockInventory, quantity: 10 }); // dest: 10
      mockInventoryRepo.executeTransferInTransaction.mockResolvedValue({
        sourceInventory: { ...mockInventory, quantity: 60 },
        destInventory: { ...mockInventory, quantity: 50 },
      });

      const result = await service.transferStock(dto);

      expect(mockInventoryRepo.executeTransferInTransaction).toHaveBeenCalledWith(
        mockWarehouseId,
        mockDestWarehouseId,
        mockProductId,
        40,
        60, // source: 100 - 40
        50, // dest: 10 + 40
        expect.objectContaining({ movementType: 'TRANSFER_WAREHOUSE' }),
        expect.objectContaining({ movementType: 'TRANSFER_WAREHOUSE' }),
      );
      expect(result.sourceInventory.quantity).toBe(60);
      expect(result.destInventory.quantity).toBe(50);
    });

    it('should throw BadRequestException if transferring to the same warehouse', async () => {
      await expect(
        service.transferStock({
          ...dto,
          fromWarehouseId: mockWarehouseId,
          toWarehouseId: mockWarehouseId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if source warehouse has insufficient stock', async () => {
      mockWarehousesRepo.findById
        .mockResolvedValueOnce(mockWarehouse)
        .mockResolvedValueOnce(mockDestWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStock.mockResolvedValueOnce({ ...mockInventory, quantity: 15 }); // only 15 available

      await expect(service.transferStock(dto)).rejects.toThrow(BadRequestException);
      expect(mockInventoryRepo.executeTransferInTransaction).not.toHaveBeenCalled();
    });
  });

  describe('adjustStock', () => {
    const dto: AdjustStockDto = {
      warehouseId: mockWarehouseId,
      productId: mockProductId,
      newQuantity: 95,
      notes: 'Damaged 5 units during inspection',
      responsibleUserId: mockUserId,
    };

    it('should adjust physical stock with justification notes', async () => {
      mockWarehousesRepo.findById.mockResolvedValue(mockWarehouse);
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockInventoryRepo.getStock.mockResolvedValue(mockInventory); // 100
      mockInventoryRepo.recordMovementInTransaction.mockResolvedValue({
        inventory: { ...mockInventory, quantity: 95 },
        movement: { ...mockStockMovement, movementType: 'ADJUSTMENT' },
      });

      const result = await service.adjustStock(dto);

      expect(mockInventoryRepo.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'ADJUSTMENT',
          quantity: -5, // delta = 95 - 100
          notes: 'Damaged 5 units during inspection',
        }),
        95,
      );
      expect(result.inventory.quantity).toBe(95);
    });
  });

  describe('findAllStock', () => {
    it('should return paginated stock levels', async () => {
      const query: QueryInventoryDto = { limit: 10, offset: 0 };
      const expected = { items: [mockInventory as never], total: 1 };
      mockInventoryRepo.findManyInventory.mockResolvedValue(expected);

      const result = await service.findAllStock(query);

      expect(mockInventoryRepo.findManyInventory).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('findMovements', () => {
    it('should return paginated movements audit trail', async () => {
      const query: QueryStockMovementsDto = { limit: 10, offset: 0 };
      const expected = { items: [mockStockMovement], total: 1 };
      mockInventoryRepo.findManyMovements.mockResolvedValue(expected);

      const result = await service.findMovements(query);

      expect(mockInventoryRepo.findManyMovements).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('findMovementById', () => {
    it('should return movement by id', async () => {
      mockInventoryRepo.findMovementById.mockResolvedValue(mockStockMovement);

      const result = await service.findMovementById(mockStockMovement.id);

      expect(mockInventoryRepo.findMovementById).toHaveBeenCalledWith(mockStockMovement.id);
      expect(result).toEqual(mockStockMovement);
    });

    it('should throw NotFoundException if movement does not exist', async () => {
      mockInventoryRepo.findMovementById.mockResolvedValue(null);

      await expect(service.findMovementById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
