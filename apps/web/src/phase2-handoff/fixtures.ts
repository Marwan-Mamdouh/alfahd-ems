/** Synthetic fixtures only; no real users, provider URLs or API implementations. */
import type { AttendanceCapabilities, AttendanceLoadState, AttendanceRow, EmployeeAttendanceHistoryProps, EmployeeCapabilities, EmployeePhotoProps, EmployeeRow, InventoryForm, InventoryRow, IpCapabilities, IpHistoryProps, IpRow, Job, Lookup, MovementHistoryProps, Mutation, Page, ProductRow, Remote, RouterAuditProps, RouterRow, WarehouseRow } from './interfaces';

const employeeId = '11111111-1111-4111-8111-111111111111';
const warehouseId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';
const date = '2026-11-08T09:00:00.000Z';

export const employee = { id: employeeId, name: 'Example Employee', email: 'employee@example.invalid', role: 'TECHNICIAN', department: 'TECHNICAL', status: 'ACTIVE', assignedWarehouseId: warehouseId, warehouseName: 'Example warehouse', photoId: null, createdAt: date } satisfies EmployeeRow;
export const attendance = { id: '44444444-4444-4444-8444-444444444444', userId: employeeId, employeeName: 'Example Employee', workDate: '2026-11-08', checkInAt: date, checkInDistanceM: 10, status: 'ON_TIME', checkOutAt: null, hoursWorked: null } satisfies AttendanceRow;
export const warehouse = { id: warehouseId, name: 'Example warehouse', address: 'Example address', latitude: 30, longitude: 31, geofenceRadiusMeters: 150, managerId: null, isActive: true } satisfies WarehouseRow;
export const product = { id: productId, name: 'Example cable', sku: 'EX-CABLE', model: 'EX-1', category: 'ACCESSORY', description: null, lowStockThreshold: 10, isSerialized: false, totalStock: 12, isLowStock: false } satisfies ProductRow;
export const inventory = { id: '55555555-5555-4555-8555-555555555555', warehouseId, productId, quantity: 12, productName: product.name, warehouseName: warehouse.name } satisfies InventoryRow;
export const router = { id: '66666666-6666-4666-8666-666666666666', serialNumber: 'EX-ROUTER-001', productId: '88888888-8888-4888-8888-888888888888', status: 'AVAILABLE', physicalCondition: 'SERVICEABLE', warehouseId, externalLocation: null, currentHolderType: 'WAREHOUSE', currentHolderId: warehouseId, notes: null, createdAt: date, updatedAt: date, productName: 'Example router SKU', warehouseName: warehouse.name } satisfies RouterRow;
export const ip = { id: '77777777-7777-4777-8777-777777777777', address: '192.0.2.1', status: 'FREE', isArchived: false, customerId: null, notes: null, createdAt: date, updatedAt: date } satisfies IpRow;
export const pendingJob = { kind: 'polling', job: { id: 'example-job', status: 'RUNNING', downloadUrl: null, error: null } } satisfies Job;
export const formError = { pending: false, error: null, fieldErrors: { notes: 'Enter a justification.' } } satisfies Mutation<{ notes: string }>;
export const loadingEmployees = { kind: 'loading' } satisfies Remote<Page<EmployeeRow>>;
export const emptyEmployees = { kind: 'empty' } satisfies Remote<Page<EmployeeRow>>;
export const failedEmployees = { kind: 'error', message: 'Unable to load employees', retry: () => {} } satisfies Remote<Page<EmployeeRow>>;
export const readyEmployees = { kind: 'ready', value: { items: [employee], total: 1, page: 1, pageSize: 20 } } satisfies Remote<Page<EmployeeRow>>;
export const adminEmployees = { create: true, edit: true, changeStatus: true, uploadPhoto: true } satisfies EmployeeCapabilities;
export const adminAttendance = { view: true, override: true, export: true } satisfies AttendanceCapabilities;
export const contextualAttendance = { kind: 'ready', value: { page: { items: [], total: 0, page: 1, pageSize: 20 }, totals: { total: 80, onTime: 80, late: 0 } } } satisfies AttendanceLoadState;
export const emptyAttendance = { kind: 'ready', value: { page: { items: [], total: 0, page: 1, pageSize: 20 }, totals: { total: 0, onTime: 0, late: 0 } } } satisfies AttendanceLoadState;
export const photoUnavailable = { photoId: 'synthetic-photo-id', canRetry: true, onRetry: () => {} } satisfies EmployeePhotoProps;
export const employeeAttendanceHistory = { data: contextualAttendance, filter: { status: 'LATE' }, capabilities: { view: true, override: true }, onFilterChange: () => {}, onPageChange: () => {}, onOverride: async () => {} } satisfies EmployeeAttendanceHistoryProps;
export const technicianIp = { read: true, create: false, edit: false, reserve: false, archive: false, history: false, import: false } satisfies IpCapabilities;
export const adjustment = { kind: 'adjust', warehouseId, productId, newQuantity: 12, notes: 'Physical count' } satisfies InventoryForm;
export const technicianChoice = { id: employeeId, name: 'Example Employee', status: 'ACTIVE', warehouseId } satisfies Lookup;
export const completedImport = { kind: 'complete', job: { id: 'example-import', status: 'COMPLETED', downloadUrl: null, error: null, inserted: 1, skipped: 0, errors: [], result: { total: 1, inserted: 1, skipped: 0, errors: [] } } } satisfies Job;
export const movementHistory = { data: { kind: 'ready', value: { items: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', warehouseId, productId, movementType: 'INBOUND_SUPPLIER', quantity: 2, supplierName: 'Example supplier', technicianId: null, responsibleUserId: employeeId, notes: null, createdAt: date }], total: 1, page: 1, pageSize: 20 } }, filter: {}, capabilities: { history: true }, selected: null, onFilterChange: () => {}, onPageChange: () => {}, onSelect: () => {}, onCloseDetail: () => {} } satisfies MovementHistoryProps;
export const routerAudit = { routerId: router.id, canView: true, assignments: { kind: 'ready', value: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', routerId: router.id, holderType: 'WAREHOUSE', warehouseId, technicianId: null, assignedAt: date, releasedAt: null, assignedBy: employeeId, notes: null }] }, conditions: { kind: 'empty' }, statuses: { kind: 'error', message: 'Unable to load status history', retry: () => {} } } satisfies RouterAuditProps;
export const ipHistory = { ipId: ip.id, canView: true, data: { kind: 'ready', value: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ipId: ip.id, fromStatus: 'FREE', toStatus: 'RESERVED', action: 'RESERVE', reason: null, actorId: employeeId, createdAt: date }] } } satisfies IpHistoryProps;
