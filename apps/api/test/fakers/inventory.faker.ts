import { faker } from '@faker-js/faker';
import type { WarehouseInventory, StockMovement } from '../../src/entities/inventory.entity.js';
import type { InboundStockDto } from '../../src/modules/inventory/dto/inbound-stock.dto.js';
import type { OutboundStockDto } from '../../src/modules/inventory/dto/outbound-stock.dto.js';
import type { TransferStockDto } from '../../src/modules/inventory/dto/transfer-stock.dto.js';

export function makeWarehouseInventory(
  overrides: Partial<WarehouseInventory> = {},
): WarehouseInventory {
  return {
    id: faker.string.uuid(),
    warehouseId: faker.string.uuid(),
    productId: faker.string.uuid(),
    quantity: faker.number.int({ min: 10, max: 200 }),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeStockMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: faker.string.uuid(),
    warehouseId: faker.string.uuid(),
    productId: faker.string.uuid(),
    movementType: 'INBOUND_SUPPLIER',
    quantity: faker.number.int({ min: 1, max: 50 }),
    technicianId: null,
    supplierName: faker.company.name(),
    responsibleUserId: faker.string.uuid(),
    notes: faker.lorem.sentence(),
    createdAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeInboundStockDto(overrides: Partial<InboundStockDto> = {}): InboundStockDto {
  return {
    warehouseId: faker.string.uuid(),
    productId: faker.string.uuid(),
    quantity: faker.number.int({ min: 1, max: 100 }),
    supplierName: faker.company.name(),
    notes: faker.lorem.sentence(),
    ...overrides,
  };
}

export function makeOutboundStockDto(overrides: Partial<OutboundStockDto> = {}): OutboundStockDto {
  return {
    warehouseId: faker.string.uuid(),
    productId: faker.string.uuid(),
    technicianId: faker.string.uuid(),
    quantity: faker.number.int({ min: 1, max: 20 }),
    notes: faker.lorem.sentence(),
    ...overrides,
  };
}

export function makeTransferStockDto(overrides: Partial<TransferStockDto> = {}): TransferStockDto {
  return {
    fromWarehouseId: faker.string.uuid(),
    toWarehouseId: faker.string.uuid(),
    productId: faker.string.uuid(),
    quantity: faker.number.int({ min: 1, max: 30 }),
    notes: faker.lorem.sentence(),
    ...overrides,
  };
}
