import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, ilike, or, and, count, sum, lte, inArray, type SQL } from 'drizzle-orm';
import * as schema from '../../../database/schema/index.js';
import {
  products,
  type Product,
  type NewProduct,
  type ProductWithStock,
} from '../../../database/schema/index.js';
import { DRIZZLE } from '../../../database/database.module.js';
import { BaseRepository } from './base.repository.js';

export interface QueryProductsParams {
  search?: string;
  category?: string;
  isLowStock?: boolean;
  activeOnly?: boolean;
  isActive?: boolean;
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

  private getClient(tx?: NodePgDatabase<typeof schema>): NodePgDatabase<typeof schema> {
    return tx ?? this.db;
  }

  async findByIdForUpdate(
    id: string,
    tx: NodePgDatabase<typeof schema>,
  ): Promise<Product | undefined> {
    // NO KEY UPDATE serializes classification writers without conflicting with
    // foreign-key key-share locks taken by router and inventory writes.
    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.id, id))
      .for('no key update');
    return product;
  }

  async markSerialized(id: string, tx: NodePgDatabase<typeof schema>): Promise<void> {
    await tx.update(products).set({ isSerialized: true }).where(eq(products.id, id));
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

    if (params.activeOnly || params.isActive === true) {
      whereConditions.push(eq(schema.products.isActive, true));
    } else if (params.isActive === false) {
      whereConditions.push(eq(schema.products.isActive, false));
    }

    const totalStockCol = sum(schema.warehouseInventory.quantity).mapWith(Number);
    const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

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
      .where(whereClause)
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

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.products)
      .where(whereClause);

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

  async countProductStock(productId: string, tx?: NodePgDatabase<typeof schema>): Promise<number> {
    const client = this.getClient(tx);
    const [result] = await client
      .select({ total: sum(schema.warehouseInventory.quantity).mapWith(Number) })
      .from(schema.warehouseInventory)
      .where(eq(schema.warehouseInventory.productId, productId));

    return result?.total ?? 0;
  }

  async countActiveRouters(productId: string, tx?: NodePgDatabase<typeof schema>): Promise<number> {
    const client = this.getClient(tx);
    const [{ total }] = await client
      .select({ total: count() })
      .from(schema.routers)
      .where(
        and(
          eq(schema.routers.productId, productId),
          inArray(schema.routers.status, [
            'AVAILABLE',
            'ASSIGNED_TO_TECHNICIAN',
            'INSTALLED_AT_CUSTOMER',
            'UNDER_REPAIR',
          ]),
        ),
      );

    return Number(total);
  }

  async hasMovementHistory(productId: string): Promise<boolean> {
    const [movement] = await this.db
      .select({ id: schema.stockMovements.id })
      .from(schema.stockMovements)
      .where(eq(schema.stockMovements.productId, productId))
      .limit(1);

    return Boolean(movement);
  }

  async canDeleteProduct(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<{ canDelete: boolean; reason?: string }> {
    const currentStock = await this.countProductStock(id, tx);
    if (currentStock > 0) {
      return {
        canDelete: false,
        reason: `Cannot deactivate product holding active inventory (${currentStock} units in stock)`,
      };
    }

    const activeRouters = await this.countActiveRouters(id, tx);
    if (activeRouters > 0) {
      return {
        canDelete: false,
        reason: `Cannot deactivate product with active router hardware assets (${activeRouters} units active)`,
      };
    }

    return { canDelete: true };
  }

  async softDeactivate(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<Product | undefined> {
    const client = this.getClient(tx);
    const [updated] = await client
      .update(schema.products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();

    return updated;
  }

  async softReactivate(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<Product | undefined> {
    const client = this.getClient(tx);
    const [updated] = await client
      .update(schema.products)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();

    return updated;
  }
}
