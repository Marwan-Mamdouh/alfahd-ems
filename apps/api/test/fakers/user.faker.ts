import { faker } from '@faker-js/faker';
import { Role } from '@alfahd/types';

export interface FakeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  assignedWarehouseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    role: faker.helpers.arrayElement(Object.values(Role)),
    isActive: true,
    assignedWarehouseId: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}
