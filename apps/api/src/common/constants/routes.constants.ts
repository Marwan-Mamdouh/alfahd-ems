export const routes = {
  products: {
    root: 'products',
    id: ':id',
  },
  warehouses: {
    root: 'warehouses',
    id: ':id',
  },
  inventory: {
    root: 'inventory',
    id: ':id',
    inbound: 'inbound',
    outbound: 'outbound',
    returns: 'returns',
    transfer: 'transfer',
    adjust: 'adjust',
    movements: 'movements',
    movementId: 'movements/:id',
    warehouseStock: 'warehouses/:warehouseId',
  },
  routers: {
    root: 'routers',
    id: ':id',
    export: 'export',
    assign: ':id/assign',
    transition: ':id/transition',
    condition: ':id/condition',
    assignments: ':id/assignments',
    conditionHistory: ':id/condition-history',
  },
  ip: {
    root: 'ip-addresses',
    id: ':id',
    reserve: ':id/reserve',
    release: ':id/release',
    archive: ':id/archive',
    unarchive: ':id/unarchive',
    history: ':id/history',
    import: 'import',
  },
} as const;

export type AppRoutes = typeof routes;
