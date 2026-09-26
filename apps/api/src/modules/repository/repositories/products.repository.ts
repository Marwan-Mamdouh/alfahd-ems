import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, ilike, or, and, count, sum, lte, type SQL } from 'drizzle-orm';
import * as schema from '../../../entities/schema.js';
import {
  products,
  type Product,
  type NewProduct,
  type ProductWithStock,
} from '../../../entities/inventory.entity.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';

export interface QueryProductsParams {
  search?: string;
  category?: string;
  isLowStock?: boolean;
  limit: number;
  offset: number;
}

interface ProductJoinedRow {
  product: Product;
  totalStock: number;
}

@Injectable()
export class ProductsRepository extends BaseRepository<
  Product,
  NewProduct,
  typeof products,
  typeof schema
> {
  constructor(@Inject(DRIZZLE) protected override readonly db: NodePgDatabase<typeof schema>) {
    super(db, products);
  }

  async findBySku(sku: string): Promise<Product | undefined> {
    const [record] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.sku, sku.trim().toUpperCase()))
      .limit(1);

    return record;
  }

  async findByIdWithStock(id: string): Promise<ProductWithStock | undefined> {
    const totalStockCol = sum(schema.warehouseInventory.quantity).mapWith(Number);

    const [record] = await this.db
      .select({
        product: schema.products,
        totalStock: totalStockCol,
      })
      .from(schema.products)
      .leftJoin(
        schema.warehouseInventory,
        eq(schema.products.id, schema.warehouseInventory.productId),
      )
      .where(eq(schema.products.id, id))
      .groupBy(schema.products.id)
      .limit(1);

    if (!record) return undefined;

    return {
      ...record.product,
      totalStock: record.totalStock,
      isLowStock: record.totalStock <= record.product.lowStockThreshold,
    };
  }

  async findManyWithStock(
    params: QueryProductsParams,
  ): Promise<{ items: ProductWithStock[]; total: number }> {
    const whereConditions: (SQL | undefined)[] = [];

    if (params.search) {
      whereConditions.push(
        or(
          ilike(schema.products.name, `%${params.search}%`),
          ilike(schema.products.sku, `%${params.search}%`),
          ilike(schema.products.model, `%${params.search}%`),
        ),
      );
    }

    if (params.category) {
      whereConditions.push(eq(schema.products.category, params.category));
    }

    const totalStockCol = sum(schema.warehouseInventory.quantity).mapWith(Number);

    const query = this.db
      .select({
        product: schema.products,
        totalStock: totalStockCol,
      })
      .from(schema.products)
      .leftJoin(
        schema.warehouseInventory,
        eq(schema.products.id, schema.warehouseInventory.productId),
      )
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .groupBy(schema.products.id)
      .having(
        params.isLowStock ? lte(totalStockCol, schema.products.lowStockThreshold) : undefined,
      );

    const rows: ProductJoinedRow[] = await query.limit(params.limit).offset(params.offset);

    const items: ProductWithStock[] = rows.map(({ product, totalStock }: ProductJoinedRow) => ({
      ...product,
      totalStock,
      isLowStock: totalStock <= product.lowStockThreshold,
    }));

    const [{ total }] = await this.db.select({ total: count() }).from(schema.products);

    return { items, total: Number(total) };
  }

  async updateProduct(id: string, updates: Partial<NewProduct>): Promise<Product | undefined> {
    const [updated] = await this.db
      .update(schema.products)
      .set(updates)
      .where(eq(schema.products.id, id))
      .returning();

    return updated;
  }

  async countProductStock(productId: string): Promise<number> {
    const [result] = await this.db
      .select({ total: sum(schema.warehouseInventory.quantity).mapWith(Number) })
      .from(schema.warehouseInventory)
      .where(eq(schema.warehouseInventory.productId, productId));

    return result?.total ?? 0;
  }

  async hasMovementHistory(productId: string): Promise<boolean> {
    const [movement] = await this.db
      .select({ id: schema.stockMovements.id })
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.productId, productId))
      .limit(1);

    return Boolean(movement);
  }

  async canDeleteProduct(id: string): Promise<{ canDelete: boolean; reason?: string }> {
    const currentStock = await this.countProductStock(id);
    if (currentStock > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete product with active inventory (${currentStock} units in stock)`,
      };
    }

    const hasHistory = await this.hasMovementHistory(id);
    if (hasHistory) {
      return {
        canDelete: false,
        reason: 'Cannot delete product with historical stock movement audit records',
      };
    }

    return { canDelete: true };
  }
}
