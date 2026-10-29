import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index.js';
import { DRIZZLE } from '../../database/database.module.js';
import { ProductsRepository } from './repositories/products.repository.js';
import { WarehousesRepository } from './repositories/warehouses.repository.js';
import { InventoryRepository } from './repositories/inventory.repository.js';
import { RoutersRepository } from './repositories/routers.repository.js';
import { IpRepository } from './repositories/ip.repository.js';

@Injectable()
export class RepositoryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    public readonly products: ProductsRepository,
    public readonly warehouses: WarehousesRepository,
    public readonly inventory: InventoryRepository,
    public readonly routers: RoutersRepository,
    public readonly ip: IpRepository,
  ) {}

  async transaction<T>(callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>): Promise<T> {
    return this.db.transaction(callback);
  }
}
