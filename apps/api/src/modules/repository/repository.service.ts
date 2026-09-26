import { Injectable } from '@nestjs/common';
import { ProductsRepository } from './repositories/products.repository.js';

@Injectable()
export class RepositoryService {
  constructor(public readonly products: ProductsRepository) {}
}
