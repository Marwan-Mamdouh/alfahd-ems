import { faker } from '@faker-js/faker';
import type { IpAddress, IpHistory } from '../../src/database/schema/index.js';
import type { CreateIpDto, UpdateIpDto } from '../../src/modules/ip-management/dto/index.js';

export function makeIpAddress(overrides: Partial<IpAddress> = {}): IpAddress {
  return {
    id: faker.string.uuid(),
    address: faker.internet.ipv4(),
    status: 'FREE',
    isArchived: false,
    customerId: null,
    notes: 'Static allocation pool',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeIpHistory(overrides: Partial<IpHistory> = {}): IpHistory {
  return {
    id: faker.string.uuid(),
    ipId: faker.string.uuid(),
    fromStatus: 'FREE',
    toStatus: 'RESERVED',
    action: 'RESERVE',
    reason: 'Manual reservation',
    actorId: faker.string.uuid(),
    createdAt: faker.date.recent(),
    ...overrides,
  };
}

export function makeCreateIpDto(overrides: Partial<CreateIpDto> = {}): CreateIpDto {
  return {
    address: faker.internet.ipv4(),
    notes: 'Primary pool address',
    ...overrides,
  };
}

export function makeUpdateIpDto(overrides: Partial<UpdateIpDto> = {}): UpdateIpDto {
  return {
    notes: 'Updated allocation note',
    ...overrides,
  };
}
