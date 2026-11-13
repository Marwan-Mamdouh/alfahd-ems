/**
 * Canonical registry of API routes for apps/web.
 *
 * All endpoints align exactly with apps/api NestJS controller routes:
 * - Hyphenated paths: `/ip-addresses`, `/check-in`, `/check-out`
 * - Exact singular/plural controller mappings: `/warehouses`, `/products`, `/inventory/movements`, `/routers`
 * - Report and async job endpoints: `/attendance/report`, `/jobs/:id`, `/jobs/:id/download`
 *
 * Fabricated endpoints (e.g. `/warehouses/:id/staff`, `/employees/:id/deactivate`)
 * have been strictly eliminated.
 */
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    me: "/auth/me",
    changePassword: "/auth/change-password",
  },

  users: {
    list: "/users",
    byId: (id: string) => `/users/${id}`,
    detail: (id: string) => `/users/${id}`,
  },

  employees: {
    list: "/employees",
    byId: (id: string) => `/employees/${id}`,
    detail: (id: string) => `/employees/${id}`,
    create: "/employees",
    update: (id: string) => `/employees/${id}`,
    updateStatus: (id: string) => `/employees/${id}/status`,
    status: (id: string) => `/employees/${id}/status`,
    lookup: "/employees/lookup",
    uploadPhoto: (id: string) => `/employees/${id}/photo`,
    photo: (id: string) => `/employees/${id}/photo`,
  },

  attendance: {
    checkIn: "/attendance/check-in",
    checkOut: "/attendance/check-out",
    override: (id: string) => `/attendance/${id}`,
    record: (id: string) => `/attendance/${id}`,
    byId: (id: string) => `/attendance/${id}`,
    detail: (id: string) => `/attendance/${id}`,
    report: "/attendance/report",
  },

  warehouses: {
    list: "/warehouses",
    create: "/warehouses",
    byId: (id: string) => `/warehouses/${id}`,
    detail: (id: string) => `/warehouses/${id}`,
    update: (id: string) => `/warehouses/${id}`,
    remove: (id: string) => `/warehouses/${id}`,
  },

  products: {
    list: "/products",
    create: "/products",
    byId: (id: string) => `/products/${id}`,
    detail: (id: string) => `/products/${id}`,
    update: (id: string) => `/products/${id}`,
    remove: (id: string) => `/products/${id}`,
  },

  inventory: {
    stock: "/inventory",
    balances: "/inventory",
    warehouseStock: (warehouseId: string) => `/inventory/warehouses/${warehouseId}`,
    inbound: "/inventory/inbound",
    outbound: "/inventory/outbound",
    returns: "/inventory/returns",
    transfer: "/inventory/transfer",
    adjust: "/inventory/adjust",
    movements: "/inventory/movements",
    movementById: (id: string) => `/inventory/movements/${id}`,
    movementDetail: (id: string) => `/inventory/movements/${id}`,
  },

  routers: {
    list: "/routers",
    create: "/routers",
    byId: (id: string) => `/routers/${id}`,
    detail: (id: string) => `/routers/${id}`,
    assign: (id: string) => `/routers/${id}/assign`,
    transition: (id: string) => `/routers/${id}/transition`,
    condition: (id: string) => `/routers/${id}/condition`,
    assignments: (id: string) => `/routers/${id}/assignments`,
    conditionHistory: (id: string) => `/routers/${id}/condition-history`,
    statusHistory: (id: string) => `/routers/${id}/status-history`,
    export: "/routers/export",
  },

  ipAddresses: {
    list: "/ip-addresses",
    create: "/ip-addresses",
    byId: (id: string) => `/ip-addresses/${id}`,
    detail: (id: string) => `/ip-addresses/${id}`,
    update: (id: string) => `/ip-addresses/${id}`,
    reserve: (id: string) => `/ip-addresses/${id}/reserve`,
    release: (id: string) => `/ip-addresses/${id}/release`,
    archive: (id: string) => `/ip-addresses/${id}/archive`,
    unarchive: (id: string) => `/ip-addresses/${id}/unarchive`,
    history: (id: string) => `/ip-addresses/${id}/history`,
    import: "/ip-addresses/import",
    importStatus: (id: string) => `/ip-addresses/import/${id}`,
  },

  jobs: {
    status: (id: string) => `/jobs/${id}`,
    download: (id: string) => `/jobs/${id}/download`,
  },

  settings: {
    users: "/users",
    user: (id: string) => `/users/${id}`,
    system: "/settings/system",
  },
} as const;
