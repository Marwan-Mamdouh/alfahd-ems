import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import type { CreateProductDto, UpdateProductDto, QueryProductsDto } from './dto/index.js';
import type { Product, ProductWithStock } from '../../entities/inventory.entity.js';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProduct: Product = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Drop Cable 1-Core',
    sku: 'CAB-DROP-1C',
    model: 'DC-1C-100M',
    category: 'Cables',
    description: 'Outdoor FTTH drop cable 100m',
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockProductWithStock: ProductWithStock = {
    ...mockProduct,
    totalStock: 50,
    isLowStock: false,
  };

  const mockProductsService = {
    createProduct: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call productsService.createProduct with dto', async () => {
      const dto: CreateProductDto = {
        name: 'Fast Connector SC/UPC',
        sku: 'CON-SC-UPC',
        model: 'SC-UPC-01',
        category: 'Connectors',
        lowStockThreshold: 20,
      };
      mockProductsService.createProduct.mockResolvedValue(mockProduct);

      const result = await controller.create(dto);

      expect(mockProductsService.createProduct).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findAll', () => {
    it('should call productsService.findAll with query params', async () => {
      const query: QueryProductsDto = { limit: 10, offset: 0, category: 'Cables' };
      mockProductsService.findAll.mockResolvedValue({ items: [mockProductWithStock], total: 1 });

      const result = await controller.findAll(query);

      expect(mockProductsService.findAll).toHaveBeenCalledWith(query);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single product by UUID', async () => {
      mockProductsService.findById.mockResolvedValue(mockProductWithStock);

      const result = await controller.findOne(mockProduct.id);

      expect(mockProductsService.findById).toHaveBeenCalledWith(mockProduct.id);
      expect(result).toEqual(mockProductWithStock);
    });
  });

  describe('update', () => {
    it('should call productsService.update with id and dto', async () => {
      const updateDto: UpdateProductDto = { name: 'Updated Cable' };
      mockProductsService.update.mockResolvedValue({ ...mockProduct, ...updateDto });

      const result = await controller.update(mockProduct.id, updateDto);

      expect(mockProductsService.update).toHaveBeenCalledWith(mockProduct.id, updateDto);
      expect(result.name).toBe('Updated Cable');
    });
  });

  describe('remove', () => {
    it('should call productsService.remove with id', async () => {
      mockProductsService.remove.mockResolvedValue(undefined);

      await controller.remove(mockProduct.id);

      expect(mockProductsService.remove).toHaveBeenCalledWith(mockProduct.id);
    });
  });
});
