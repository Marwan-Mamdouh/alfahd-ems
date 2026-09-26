import { Global, Module } from '@nestjs/common';
import { RepositoryService } from './repository.service.js';
import { ProductsRepository } from './repositories/products.repository.js';

@Global()
@Module({
  providers: [RepositoryService, ProductsRepository],
  exports: [RepositoryService, ProductsRepository],
})
export class RepositoryModule {}
