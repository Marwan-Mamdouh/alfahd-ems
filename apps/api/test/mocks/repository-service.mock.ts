import { vi } from 'vitest';

type AnyFn = (...args: any[]) => any;

export interface MockRepositoryService {
  products: {
    findBySku: ReturnType<typeof vi.fn<AnyFn>>;
    findById: ReturnType<typeof vi.fn<AnyFn>>;
    findByIdWithStock: ReturnType<typeof vi.fn<AnyFn>>;
    findManyWithStock: ReturnType<typeof vi.fn<AnyFn>>;
    create: ReturnType<typeof vi.fn<AnyFn>>;
    updateProduct: ReturnType<typeof vi.fn<AnyFn>>;
    canDeleteProduct: ReturnType<typeof vi.fn<AnyFn>>;
    deleteById: ReturnType<typeof vi.fn<AnyFn>>;
  };
  warehouses: {
    findByName: ReturnType<typeof vi.fn<AnyFn>>;
    findById: ReturnType<typeof vi.fn<AnyFn>>;
    findManyWithPagination: ReturnType<typeof vi.fn<AnyFn>>;
    create: ReturnType<typeof vi.fn<AnyFn>>;
    updateWarehouse: ReturnType<typeof vi.fn<AnyFn>>;
    canDeleteWarehouse: ReturnType<typeof vi.fn<AnyFn>>;
    deleteById: ReturnType<typeof vi.fn<AnyFn>>;
  };
  inventory: {
    getStock: ReturnType<typeof vi.fn<AnyFn>>;
    recordMovementInTransaction: ReturnType<typeof vi.fn<AnyFn>>;
    executeTransferInTransaction: ReturnType<typeof vi.fn<AnyFn>>;
    findManyInventory: ReturnType<typeof vi.fn<AnyFn>>;
    findManyMovements: ReturnType<typeof vi.fn<AnyFn>>;
    findMovementById: ReturnType<typeof vi.fn<AnyFn>>;
  };
}

export function createMockRepositoryService(): MockRepositoryService {
  return {
    products: {
      findBySku: vi.fn(),
      findById: vi.fn(),
      findByIdWithStock: vi.fn(),
      findManyWithStock: vi.fn(),
      create: vi.fn(),
      updateProduct: vi.fn(),
      canDeleteProduct: vi.fn(),
      deleteById: vi.fn(),
    },
    warehouses: {
      findByName: vi.fn(),
      findById: vi.fn(),
      findManyWithPagination: vi.fn(),
      create: vi.fn(),
      updateWarehouse: vi.fn(),
      canDeleteWarehouse: vi.fn(),
      deleteById: vi.fn(),
    },
    inventory: {
      getStock: vi.fn(),
      recordMovementInTransaction: vi.fn(),
      executeTransferInTransaction: vi.fn(),
      findManyInventory: vi.fn(),
      findManyMovements: vi.fn(),
      findMovementById: vi.fn(),
    },
  };
}
