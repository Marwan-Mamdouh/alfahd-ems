import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { RepositoryService } from '../repository/repository.service.js';
import type { Product, ProductWithStock } from '../../entities/inventory.entity.js';
import type { CreateProductDto, UpdateProductDto, QueryProductsDto } from './dto/index.js';

describe('ProductsService (TDD Unit Tests)', () => {
  let service: ProductsService;

  const mockProduct: Product = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Drop Cable 1-Core',
    sku: 'CAB-DROP-1C',
    model: 'DC-1C-100M',
    category: 'Cables',
    description: 'Outdoor FTTH drop cable 100m',
    lowStockThreshold: 10,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockProductWithStock: ProductWithStock = {
    ...mockProduct,
    totalStock: 5,
    isLowStock: true,
  };

  const mockProductsRepo = {
    findBySku: vi.fn(),
    findById: vi.fn(),
    findByIdWithStock: vi.fn(),
    findManyWithStock: vi.fn(),
    create: vi.fn(),
    updateProduct: vi.fn(),
    deleteById: vi.fn(),
    countProductStock: vi.fn(),
    hasMovementHistory: vi.fn(),
    canDeleteProduct: vi.fn(),
  };

  const mockRepositoryService = {
    products: mockProductsRepo,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('createProduct', () => {
    const dto: CreateProductDto = {
      name: 'Drop Cable 1-Core',
      sku: 'CAB-DROP-1C',
      model: 'DC-1C-100M',
      category: 'Cables',
      description: 'Outdoor FTTH drop cable 100m',
      lowStockThreshold: 10,
    };

    it('should successfully create a new product when SKU is unique', async () => {
      mockProductsRepo.findBySku.mockResolvedValue(undefined);
      mockProductsRepo.create.mockResolvedValue(mockProduct);

      const result = await service.createProduct(dto);

      expect(mockProductsRepo.findBySku).toHaveBeenCalledWith('CAB-DROP-1C');
      expect(mockProductsRepo.create).toHaveBeenCalledWith({
        name: dto.name,
        sku: 'CAB-DROP-1C',
        model: dto.model,
        category: dto.category,
        description: dto.description,
        lowStockThreshold: 10,
      });
      expect(result).toEqual(mockProduct);
    });

    it('should throw ConflictException if SKU already exists', async () => {
      mockProductsRepo.findBySku.mockResolvedValue(mockProduct);

      await expect(service.createProduct(dto)).rejects.toThrow(ConflictException);
      expect(mockProductsRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated products with aggregate stock', async () => {
      const query: QueryProductsDto = { limit: 10, offset: 0, search: 'Cable' };
      const expectedResult = { items: [mockProductWithStock], total: 1 };
      mockProductsRepo.findManyWithStock.mockResolvedValue(expectedResult);

      const result = await service.findAll(query);

      expect(mockProductsRepo.findManyWithStock).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findById', () => {
    it('should return product with stock when found', async () => {
      mockProductsRepo.findByIdWithStock.mockResolvedValue(mockProductWithStock);

      const result = await service.findById(mockProduct.id);

      expect(mockProductsRepo.findByIdWithStock).toHaveBeenCalledWith(mockProduct.id);
      expect(result).toEqual(mockProductWithStock);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockProductsRepo.findByIdWithStock.mockResolvedValue(undefined);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateProductDto = { name: 'Updated Name', sku: 'NEW-SKU' };

    it('should update product successfully', async () => {
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockProductsRepo.findBySku.mockResolvedValue(undefined);
      mockProductsRepo.updateProduct.mockResolvedValue({ ...mockProduct, ...updateDto });

      const result = await service.update(mockProduct.id, updateDto);

      expect(mockProductsRepo.findById).toHaveBeenCalledWith(mockProduct.id);
      expect(mockProductsRepo.updateProduct).toHaveBeenCalledWith(mockProduct.id, {
        name: 'Updated Name',
        sku: 'NEW-SKU',
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if product to update is not found', async () => {
      mockProductsRepo.findById.mockResolvedValue(null);

      await expect(service.update('missing-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if updated SKU is taken by another product', async () => {
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockProductsRepo.findBySku.mockResolvedValue({
        ...mockProduct,
        id: 'different-uuid-2222',
        sku: 'NEW-SKU',
      });

      await expect(service.update(mockProduct.id, updateDto)).rejects.toThrow(ConflictException);
      expect(mockProductsRepo.updateProduct).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete product when no stock and no movement history exist', async () => {
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockProductsRepo.canDeleteProduct.mockResolvedValue({ canDelete: true });
      mockProductsRepo.deleteById.mockResolvedValue(undefined);

      await expect(service.remove(mockProduct.id)).resolves.not.toThrow();

      expect(mockProductsRepo.findById).toHaveBeenCalledWith(mockProduct.id);
      expect(mockProductsRepo.canDeleteProduct).toHaveBeenCalledWith(mockProduct.id);
      expect(mockProductsRepo.deleteById).toHaveBeenCalledWith(mockProduct.id);
    });

    it('should throw NotFoundException if product to delete does not exist', async () => {
      mockProductsRepo.findById.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
      expect(mockProductsRepo.deleteById).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if product has stock or movement history', async () => {
      mockProductsRepo.findById.mockResolvedValue(mockProduct);
      mockProductsRepo.canDeleteProduct.mockResolvedValue({
        canDelete: false,
        reason: 'Cannot delete product with active inventory (10 units in stock)',
      });

      await expect(service.remove(mockProduct.id)).rejects.toThrow(ConflictException);
      expect(mockProductsRepo.deleteById).not.toHaveBeenCalled();
    });
  });
});
