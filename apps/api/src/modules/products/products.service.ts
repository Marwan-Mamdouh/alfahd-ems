import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { RepositoryService } from '../repository/repository.service.js';
import type { Product, ProductWithStock } from '../../entities/inventory.entity.js';
import type { CreateProductDto, UpdateProductDto, QueryProductsDto } from './dto/index.js';

@Injectable()
export class ProductsService {
  constructor(private readonly repo: RepositoryService) {}

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const normalizedSku = dto.sku.trim().toUpperCase();

    const existing = await this.repo.products.findBySku(normalizedSku);
    if (existing) {
      throw new ConflictException(`Product with SKU "${normalizedSku}" already exists`);
    }

    return this.repo.products.create({
      name: dto.name.trim(),
      sku: normalizedSku,
      model: dto.model.trim(),
      category: dto.category.trim(),
      description: dto.description ? dto.description.trim() : null,
      lowStockThreshold: dto.lowStockThreshold ?? 10,
    });
  }

  async findAll(query: QueryProductsDto): Promise<{ items: ProductWithStock[]; total: number }> {
    return this.repo.products.findManyWithStock({
      search: query.search,
      category: query.category,
      isLowStock: query.isLowStock,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async findById(id: string): Promise<ProductWithStock> {
    const product = await this.repo.products.findByIdWithStock(id);
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" was not found`);
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.repo.products.findById(id);
    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" was not found`);
    }

    const updates: Partial<Product> = {};

    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.model !== undefined) updates.model = dto.model.trim();
    if (dto.category !== undefined) updates.category = dto.category.trim();
    if (dto.description !== undefined) {
      updates.description = dto.description ? dto.description.trim() : null;
    }
    if (dto.lowStockThreshold !== undefined) {
      if (dto.lowStockThreshold < 0) {
        throw new BadRequestException('Low stock threshold cannot be negative');
      }
      updates.lowStockThreshold = dto.lowStockThreshold;
    }

    if (dto.sku !== undefined) {
      const normalizedSku = dto.sku.trim().toUpperCase();
      if (normalizedSku !== existing.sku) {
        const skuConflict = await this.repo.products.findBySku(normalizedSku);
        if (skuConflict && skuConflict.id !== id) {
          throw new ConflictException(
            `SKU "${normalizedSku}" is already in use by another product`,
          );
        }
        updates.sku = normalizedSku;
      }
    }

    const updated = await this.repo.products.updateProduct(id, updates);
    if (!updated) {
      throw new NotFoundException(`Product with ID "${id}" was not found`);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.products.findById(id);
    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" was not found`);
    }

    const { canDelete, reason } = await this.repo.products.canDeleteProduct(id);
    if (!canDelete) {
      throw new ConflictException(
        reason ?? 'Cannot delete product due to existing inventory or transaction history',
      );
    }

    await this.repo.products.deleteById(id);
  }
}
