import { faker } from '@faker-js/faker';
import type { Warehouse } from '../../src/modules/warehouses/warehouse.types.js';
import type { CreateWarehouseDto } from '../../src/modules/warehouses/dto/create-warehouse.dto.js';

export function makeWarehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    id: faker.string.uuid(),
    name: `${faker.location.city()} Central Hub`,
    address: faker.location.streetAddress({ useFullAddress: true }),
    latitude: faker.location.latitude({ max: 32, min: 29 }),
    longitude: faker.location.longitude({ max: 33, min: 30 }),
    geofenceRadiusMeters: faker.helpers.arrayElement([100, 150, 200, 300]),
    managerId: null,
    isActive: true,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeCreateWarehouseDto(
  overrides: Partial<CreateWarehouseDto> = {},
): CreateWarehouseDto {
  return {
    name: `${faker.location.city()} Distribution Hub ${faker.string.alphanumeric(4).toUpperCase()}`,
    address: faker.location.streetAddress({ useFullAddress: true }),
    latitude: faker.location.latitude({ max: 32, min: 29 }),
    longitude: faker.location.longitude({ max: 33, min: 30 }),
    geofenceRadiusMeters: faker.helpers.arrayElement([100, 150, 200, 300]),
    ...overrides,
  };
}
