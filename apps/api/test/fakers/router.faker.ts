import { faker } from '@faker-js/faker';
import type {
  Router,
  RouterAssignment,
  RouterConditionHistory,
} from '../../src/database/schema/index.js';
import type {
  CreateRouterDto,
  AssignRouterDto,
  UpdateRouterConditionDto,
  TransitionRouterDto,
} from '../../src/modules/routers/dto/index.js';

export function makeRouter(overrides: Partial<Router> = {}): Router {
  return {
    id: faker.string.uuid(),
    serialNumber: `SN-${faker.string.alphanumeric(8).toUpperCase()}`,
    productId: faker.string.uuid(),
    status: 'AVAILABLE',
    physicalCondition: 'SERVICEABLE',
    warehouseId: faker.string.uuid(),
    externalLocation: null,
    notes: faker.commerce.productDescription(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeRouterAssignment(overrides: Partial<RouterAssignment> = {}): RouterAssignment {
  return {
    id: faker.string.uuid(),
    routerId: faker.string.uuid(),
    holderType: 'TECHNICIAN',
    warehouseId: null,
    technicianId: faker.string.uuid(),
    assignedBy: faker.string.uuid(),
    assignedAt: faker.date.recent(),
    releasedAt: null,
    notes: 'Assignment for field installation',
    ...overrides,
  };
}

export function makeRouterConditionHistory(
  overrides: Partial<RouterConditionHistory> = {},
): RouterConditionHistory {
  return {
    id: faker.string.uuid(),
    routerId: faker.string.uuid(),
    fromCondition: 'SERVICEABLE',
    toCondition: 'DAMAGED',
    fromWarehouseId: faker.string.uuid(),
    toWarehouseId: null,
    externalLocation: null,
    changedBy: faker.string.uuid(),
    reason: 'Defect noticed during audit',
    createdAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeCreateRouterDto(overrides: Partial<CreateRouterDto> = {}): CreateRouterDto {
  return {
    serialNumber: `SN-${faker.string.alphanumeric(8).toUpperCase()}`,
    productId: faker.string.uuid(),
    warehouseId: faker.string.uuid(),
    physicalCondition: 'SERVICEABLE',
    isNewReceipt: true,
    notes: 'Initial inbound shipment',
    ...overrides,
  };
}

export function makeAssignRouterDto(overrides: Partial<AssignRouterDto> = {}): AssignRouterDto {
  return {
    technicianId: faker.string.uuid(),
    notes: 'Handover to tech',
    ...overrides,
  };
}

export function makeUpdateRouterConditionDto(
  overrides: Partial<UpdateRouterConditionDto> = {},
): UpdateRouterConditionDto {
  return {
    physicalCondition: 'DAMAGED',
    reason: 'Cracked casing during handling',
    ...overrides,
  };
}

export function makeTransitionRouterDto(
  overrides: Partial<TransitionRouterDto> = {},
): TransitionRouterDto {
  return {
    status: 'RETURNED',
    reason: 'Hardware test failure',
    ...overrides,
  };
}
