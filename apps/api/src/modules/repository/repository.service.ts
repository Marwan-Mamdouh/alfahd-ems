import { Injectable } from '@nestjs/common';
import { ProductsRepository } from './repositories/products.repository.js';
import { WarehousesRepository } from './repositories/warehouses.repository.js';
import { InventoryRepository } from './repositories/inventory.repository.js';

@Injectable()
export class RepositoryService {
  constructor(
    public readonly products: ProductsRepository,
    public readonly warehouses: WarehousesRepository,
    public readonly inventory: InventoryRepository,
  ) {}
}
