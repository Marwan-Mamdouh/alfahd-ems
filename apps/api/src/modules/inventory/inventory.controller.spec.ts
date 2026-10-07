import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import type {
  InboundStockDto,
  OutboundStockDto,
  ReturnStockDto,
  TransferStockDto,
  AdjustStockDto,
  QueryInventoryDto,
  QueryStockMovementsDto,
} from './dto/index.js';

describe('InventoryController', () => {
  let controller: InventoryController;

  const mockWarehouseId = '11111111-1111-1111-1111-111111111111';
  const mockProductId = '33333333-3333-3333-3333-333333333333';
  const mockTechId = '44444444-4444-4444-4444-444444444444';
  const mockMovementId = '77777777-7777-7777-7777-777777777777';

  const mockInventoryService = {
    findAllStock: vi.fn(),
    receiveInbound: vi.fn(),
    issueOutbound: vi.fn(),
    receiveReturn: vi.fn(),
    transferStock: vi.fn(),
    adjustStock: vi.fn(),
    findMovements: vi.fn(),
    findMovementById: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to inventoryService.findAllStock', async () => {
      const query: QueryInventoryDto = { limit: 10, offset: 0 };
      mockInventoryService.findAllStock.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findAll(query);

      expect(mockInventoryService.findAllStock).toHaveBeenCalledWith(query);
      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('findWarehouseStock', () => {
    it('should delegate to inventoryService.findAllStock with warehouseId', async () => {
      const query: QueryInventoryDto = { limit: 10, offset: 0 };
      mockInventoryService.findAllStock.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findWarehouseStock(mockWarehouseId, query);

      expect(mockInventoryService.findAllStock).toHaveBeenCalledWith({
        ...query,
        warehouseId: mockWarehouseId,
      });
      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('receiveInbound', () => {
    it('should delegate to inventoryService.receiveInbound', async () => {
      const dto: InboundStockDto = {
        warehouseId: mockWarehouseId,
        productId: mockProductId,
        quantity: 50,
        supplierName: 'El-Sewedy',
      };
      const expected = { inventory: {}, movement: {} };
      mockInventoryService.receiveInbound.mockResolvedValue(expected);

      const result = await controller.receiveInbound(dto);

      expect(mockInventoryService.receiveInbound).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('issueOutbound', () => {
    it('should delegate to inventoryService.issueOutbound', async () => {
      const dto: OutboundStockDto = {
        warehouseId: mockWarehouseId,
        productId: mockProductId,
        technicianId: mockTechId,
        quantity: 10,
      };
      const expected = { inventory: {}, movement: {} };
      mockInventoryService.issueOutbound.mockResolvedValue(expected);

      const result = await controller.issueOutbound(dto);

      expect(mockInventoryService.issueOutbound).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('receiveReturn', () => {
    it('should delegate to inventoryService.receiveReturn', async () => {
      const dto: ReturnStockDto = {
        warehouseId: mockWarehouseId,
        productId: mockProductId,
        technicianId: mockTechId,
        quantity: 5,
      };
      const expected = { inventory: {}, movement: {} };
      mockInventoryService.receiveReturn.mockResolvedValue(expected);

      const result = await controller.receiveReturn(dto);

      expect(mockInventoryService.receiveReturn).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('transferStock', () => {
    it('should delegate to inventoryService.transferStock', async () => {
      const dto: TransferStockDto = {
        fromWarehouseId: mockWarehouseId,
        toWarehouseId: '22222222-2222-2222-2222-222222222222',
        productId: mockProductId,
        quantity: 20,
      };
      const expected = { sourceInventory: {}, destInventory: {} };
      mockInventoryService.transferStock.mockResolvedValue(expected);

      const result = await controller.transferStock(dto);

      expect(mockInventoryService.transferStock).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('adjustStock', () => {
    it('should delegate to inventoryService.adjustStock', async () => {
      const dto: AdjustStockDto = {
        warehouseId: mockWarehouseId,
        productId: mockProductId,
        newQuantity: 80,
        notes: 'Reconciliation',
      };
      const expected = { inventory: {}, movement: {} };
      mockInventoryService.adjustStock.mockResolvedValue(expected);

      const result = await controller.adjustStock(dto);

      expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findMovements', () => {
    it('should delegate to inventoryService.findMovements', async () => {
      const query: QueryStockMovementsDto = { limit: 10, offset: 0 };
      mockInventoryService.findMovements.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findMovements(query);

      expect(mockInventoryService.findMovements).toHaveBeenCalledWith(query);
      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  describe('findMovementById', () => {
    it('should delegate to inventoryService.findMovementById', async () => {
      const expected = { id: mockMovementId };
      mockInventoryService.findMovementById.mockResolvedValue(expected);

      const result = await controller.findMovementById(mockMovementId);

      expect(mockInventoryService.findMovementById).toHaveBeenCalledWith(mockMovementId);
      expect(result).toEqual(expected);
    });
  });
});
