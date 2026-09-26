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
  },
  routers: {
    root: 'routers',
    id: ':id',
  },
} as const;

export type AppRoutes = typeof routes;
