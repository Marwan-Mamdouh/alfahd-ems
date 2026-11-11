import { Global, Module } from '@nestjs/common';
import { RepositoryService } from './repository.service.js';
import { ProductsRepository } from './repositories/products.repository.js';
import { WarehousesRepository } from './repositories/warehouses.repository.js';
import { InventoryRepository } from './repositories/inventory.repository.js';
import { RoutersRepository } from './repositories/routers.repository.js';
import { IpRepository } from './repositories/ip.repository.js';
import { UsersRepository } from './repositories/users.repository.js';

@Global()
@Module({
  providers: [
    RepositoryService,
    ProductsRepository,
    WarehousesRepository,
    InventoryRepository,
    RoutersRepository,
    IpRepository,
    UsersRepository,
  ],
  exports: [
    RepositoryService,
    ProductsRepository,
    WarehousesRepository,
    InventoryRepository,
    RoutersRepository,
    IpRepository,
    UsersRepository,
  ],
})
export class RepositoryModule {}
