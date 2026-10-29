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
    countPhysicallyLocatedRouters: ReturnType<typeof vi.fn<AnyFn>>;
    softDeactivate: ReturnType<typeof vi.fn<AnyFn>>;
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
  routers: {
    findBySerialNumber: ReturnType<typeof vi.fn<AnyFn>>;
    findById: ReturnType<typeof vi.fn<AnyFn>>;
    createRouter: ReturnType<typeof vi.fn<AnyFn>>;
    updateRouter: ReturnType<typeof vi.fn<AnyFn>>;
    createAssignment: ReturnType<typeof vi.fn<AnyFn>>;
    findActiveAssignment: ReturnType<typeof vi.fn<AnyFn>>;
    releaseActiveAssignment: ReturnType<typeof vi.fn<AnyFn>>;
    findAssignmentsByRouter: ReturnType<typeof vi.fn<AnyFn>>;
    createConditionHistory: ReturnType<typeof vi.fn<AnyFn>>;
    findConditionHistory: ReturnType<typeof vi.fn<AnyFn>>;
    findManyWithPagination: ReturnType<typeof vi.fn<AnyFn>>;
    getWarehouseRouterCounts: ReturnType<typeof vi.fn<AnyFn>>;
  };
  ip: {
    findByAddress: ReturnType<typeof vi.fn<AnyFn>>;
    findById: ReturnType<typeof vi.fn<AnyFn>>;
    createIp: ReturnType<typeof vi.fn<AnyFn>>;
    updateIp: ReturnType<typeof vi.fn<AnyFn>>;
    createHistory: ReturnType<typeof vi.fn<AnyFn>>;
    findHistoryByIp: ReturnType<typeof vi.fn<AnyFn>>;
    findManyWithPagination: ReturnType<typeof vi.fn<AnyFn>>;
  };
  transaction: ReturnType<typeof vi.fn<AnyFn>>;
}

export function createMockRepositoryService(): MockRepositoryService {
  return {
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb({})),
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
      countPhysicallyLocatedRouters: vi.fn(),
      softDeactivate: vi.fn(),
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
    routers: {
      findBySerialNumber: vi.fn(),
      findById: vi.fn(),
      createRouter: vi.fn(),
      updateRouter: vi.fn(),
      createAssignment: vi.fn(),
      findActiveAssignment: vi.fn(),
      releaseActiveAssignment: vi.fn(),
      findAssignmentsByRouter: vi.fn(),
      createConditionHistory: vi.fn(),
      findConditionHistory: vi.fn(),
      findManyWithPagination: vi.fn(),
      getWarehouseRouterCounts: vi.fn(),
    },
    ip: {
      findByAddress: vi.fn(),
      findById: vi.fn(),
      createIp: vi.fn(),
      updateIp: vi.fn(),
      createHistory: vi.fn(),
      findHistoryByIp: vi.fn(),
      findManyWithPagination: vi.fn(),
    },
  };
}
