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

  employees: {
    list: "/employees",
    byId: (id: string) => `/employees/${id}`,
    create: "/employees",
    update: (id: string) => `/employees/${id}`,
    deactivate: (id: string) => `/employees/${id}/deactivate`,
  },

  attendance: {
    records: "/attendance",
    byEmployee: (id: string) => `/attendance/employee/${id}`,
    summary: "/attendance/summary",
    export: "/attendance/export",
  },

  warehouses: {
    list: "/warehouses",
    create: "/warehouses",
    byId: (id: string) => `/warehouses/${id}`,
    update: (id: string) => `/warehouses/${id}`,
    staff: (id: string) => `/warehouses/${id}/staff`,
    movements: (id: string) => `/warehouses/${id}/movements`,
  },

  inventory: {
    items: "/inventory/items",
    item: (id: string) => `/inventory/items/${id}`,
    inbound: "/inventory/inbound",
    outbound: "/inventory/outbound",
    returns: "/inventory/returns",
    itemMovements: (itemId: string) => `/inventory/items/${itemId}/movements`,
    lowStock: "/inventory/low-stock",
    export: "/inventory/export",
  },

  routers: {
    list: "/routers",
    create: "/routers",
    byId: (id: string) => `/routers/${id}`,
    update: (id: string) => `/routers/${id}`,
    transition: (id: string) => `/routers/${id}/transition`,
    history: (id: string) => `/routers/${id}/history`,
    export: "/routers/export",
  },

  ips: {
    list: "/ips",
    create: "/ips",
    byId: (id: string) => `/ips/${id}`,
    update: (id: string) => `/ips/${id}`,
    bulkImport: "/ips/import",
  },

  technicians: {
    list: "/technicians",
    byId: (id: string) => `/technicians/${id}`,
    tasks: (id: string) => `/technicians/${id}/tasks`,
    routers: (id: string) => `/technicians/${id}/routers`,
    performance: (id: string) => `/technicians/${id}/performance`,
  },

  tracking: {
    live: "/tracking/live",
  },

  customers: {
    list: "/customers",
    create: "/customers",
    byId: (id: string) => `/customers/${id}`,
    update: (id: string) => `/customers/${id}`,
    tickets: (id: string) => `/customers/${id}/tickets`,
  },

  tickets: {
    list: "/tickets",
    create: "/tickets",
    byId: (id: string) => `/tickets/${id}`,
    update: (id: string) => `/tickets/${id}`,
    unassigned: "/tickets/unassigned",
    suggestions: "/tickets/assignment-suggestions",
    confirmAssignment: "/tickets/confirm-assignment",
    assign: (id: string) => `/tickets/${id}/assign`,
    rate: (id: string) => `/tickets/${id}/rating`,
  },

  reports: {
    attendance: "/reports/attendance",
    inventory: "/reports/inventory",
    routers: "/reports/routers",
    technicians: "/reports/technicians",
    tickets: "/reports/tickets",
    customers: "/reports/customers",
  },

  settings: {
    users: "/users",
    user: (id: string) => `/users/${id}`,
    system: "/settings/system",
  },
} as const;
