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
  },
} as const;

export type AppRoutes = typeof routes;
