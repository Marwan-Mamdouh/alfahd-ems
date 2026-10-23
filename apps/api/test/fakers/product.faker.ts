import { faker } from '@faker-js/faker';
import type { Product, ProductWithStock } from '../../src/database/schema/index.js';
import type { CreateProductDto } from '../../src/modules/products/dto/create-product.dto.js';

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    sku: faker.string.alphanumeric(8).toUpperCase(),
    model: faker.string.alphanumeric(6).toUpperCase(),
    category: faker.helpers.arrayElement(['Routers', 'Cables', 'Optics', 'Switches', 'Tools']),
    description: faker.commerce.productDescription(),
    lowStockThreshold: faker.number.int({ min: 5, max: 20 }),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeProductWithStock(overrides: Partial<ProductWithStock> = {}): ProductWithStock {
  const base = makeProduct(overrides);
  const totalStock = overrides.totalStock ?? faker.number.int({ min: 0, max: 500 });
  return {
    ...base,
    totalStock,
    isLowStock: overrides.isLowStock ?? totalStock <= base.lowStockThreshold,
  };
}

export function makeCreateProductDto(overrides: Partial<CreateProductDto> = {}): CreateProductDto {
  return {
    name: faker.commerce.productName(),
    sku: faker.string.alphanumeric(8).toUpperCase(),
    model: faker.string.alphanumeric(6).toUpperCase(),
    category: faker.helpers.arrayElement(['Routers', 'Cables', 'Optics', 'Switches', 'Tools']),
    description: faker.commerce.productDescription(),
    lowStockThreshold: faker.number.int({ min: 5, max: 20 }),
    ...overrides,
  };
}
