import { Global, Module } from '@nestjs/common';
import { RepositoryService } from './repository.service.js';
import { ProductsRepository } from './repositories/products.repository.js';
import { WarehousesRepository } from './repositories/warehouses.repository.js';

@Global()
@Module({
  providers: [RepositoryService, ProductsRepository, WarehousesRepository],
  exports: [RepositoryService, ProductsRepository, WarehousesRepository],
})
export class RepositoryModule {}
