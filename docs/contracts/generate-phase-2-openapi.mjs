// Builds a review snapshot from explicitly curated controller/DTO observations.
// It is not generated from Nest metadata and does not implement or approve routes.
import { writeFileSync } from 'node:fs';

const uuid = { type: 'string', format: 'uuid' };
const text = { type: 'string' };
const integer = { type: 'integer' };
const boolean = { type: 'boolean' };
const role = { type: 'string', enum: ['ADMIN', 'WAREHOUSE_STAFF', 'CS', 'TECHNICIAN'] };
const department = { type: 'string', enum: ['TECHNICAL', 'CUSTOMER_SERVICE', 'WAREHOUSE', 'MANAGEMENT'] };
const userStatus = { type: 'string', enum: ['ACTIVE', 'ON_LEAVE', 'INACTIVE'] };
const routerStatus = { type: 'string', enum: ['AVAILABLE', 'ASSIGNED_TO_TECHNICIAN', 'INSTALLED_AT_CUSTOMER', 'RETURNED', 'DAMAGED', 'UNDER_REPAIR', 'LOST', 'DECOMMISSIONED'] };
const condition = { type: 'string', enum: ['SERVICEABLE', 'DAMAGED', 'UNDER_REPAIR'] };
const ipStatus = { type: 'string', enum: ['FREE', 'RESERVED'] };
const obj = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema) => ({ ...schema, nullable: true });
const date = { type: 'string', format: 'date-time' };
const strEnum = (...values) => ({ type: 'string', enum: values });
const positive = { type: 'integer', minimum: 1 };
const schemas = {
  Error: obj({ statusCode: integer, message: text, error: obj({ code: text, message: text, details: {} }, ['code', 'message']), path: text, timestamp: date }, ['statusCode', 'message', 'error', 'path', 'timestamp']),
  Employee: obj({ id: uuid, name: text, email: text, role, department: nullable(department), phone: nullable(text), nationalId: nullable(text), hireDate: nullable(text), status: userStatus, assignedWarehouseId: nullable(uuid), profilePhotoKey: nullable(text), createdAt: date, updatedAt: date }, ['id', 'name', 'email', 'role', 'department', 'status', 'createdAt']),
  Attendance: obj({ id: uuid, userId: uuid, workDate: text, checkInAt: date, checkInLat: { type: 'number' }, checkInLng: { type: 'number' }, checkInDistanceM: { type: 'number' }, checkOutAt: nullable(date), status: strEnum('ON_TIME', 'LATE'), hoursWorked: nullable({ type: 'number' }), overrideReason: nullable(text), overriddenBy: nullable(uuid), overriddenAt: nullable(date) }, ['id', 'workDate', 'checkInAt', 'checkInDistanceM', 'status']),
  Warehouse: obj({ id: uuid, name: text, address: text, latitude: { type: 'number' }, longitude: { type: 'number' }, geofenceRadiusMeters: integer, managerId: nullable(uuid), isActive: boolean, createdAt: date, updatedAt: date }, ['id', 'name', 'address', 'latitude', 'longitude', 'geofenceRadiusMeters', 'managerId', 'isActive', 'createdAt', 'updatedAt']),
  Product: obj({ id: uuid, name: text, sku: text, model: text, category: text, description: nullable(text), lowStockThreshold: integer, isSerialized: boolean, createdAt: date, updatedAt: date }, ['id', 'name', 'sku', 'model', 'category', 'description', 'lowStockThreshold', 'isSerialized', 'createdAt', 'updatedAt']),
  ProductWithStock: { allOf: [ref('Product'), obj({ totalStock: integer, isLowStock: boolean }, ['totalStock', 'isLowStock'])] },
  Inventory: obj({ id: uuid, warehouseId: uuid, productId: uuid, quantity: integer, updatedAt: date }, ['id', 'warehouseId', 'productId', 'quantity', 'updatedAt']),
  InventoryListItem: { allOf: [ref('Inventory'), obj({ product: obj({ id: uuid, name: text, sku: text, model: text, category: text, lowStockThreshold: integer }, ['id', 'name', 'sku', 'model', 'category', 'lowStockThreshold']), warehouse: obj({ id: uuid, name: text }, ['id', 'name']) }, ['product', 'warehouse'])] },
  Movement: obj({ id: uuid, warehouseId: uuid, productId: uuid, movementType: text, quantity: integer, supplierName: nullable(text), technicianId: nullable(uuid), responsibleUserId: uuid, notes: nullable(text), createdAt: date }, ['id', 'warehouseId', 'productId', 'movementType', 'quantity', 'supplierName', 'technicianId', 'responsibleUserId', 'notes', 'createdAt']),
  Router: obj({ id: uuid, serialNumber: text, productId: uuid, status: routerStatus, physicalCondition: condition, warehouseId: nullable(uuid), externalLocation: nullable(text), currentHolderType: nullable(text), currentHolderId: nullable(uuid), notes: nullable(text), createdAt: date, updatedAt: date }, ['id', 'serialNumber', 'productId', 'status', 'physicalCondition', 'warehouseId', 'externalLocation', 'currentHolderType', 'currentHolderId', 'notes', 'createdAt', 'updatedAt']),
  IpAddress: obj({ id: uuid, address: text, status: ipStatus, isArchived: boolean, customerId: nullable(uuid), notes: nullable(text), createdAt: date, updatedAt: date }, ['id', 'address', 'status', 'isArchived', 'customerId', 'notes', 'createdAt', 'updatedAt']),
  // Full router/IP history structures are provided by phase-2-openapi-fragments.md.
  RouterAssignment: obj({ id: uuid, routerId: uuid, holderType: strEnum('WAREHOUSE', 'TECHNICIAN', 'CUSTOMER'), warehouseId: nullable(uuid), technicianId: nullable(uuid), assignedAt: date, releasedAt: nullable(date), assignedBy: uuid, notes: nullable(text) }, ['id', 'routerId', 'holderType', 'warehouseId', 'technicianId', 'assignedAt', 'releasedAt', 'assignedBy', 'notes']),
  RouterConditionHistory: obj({ id: uuid, routerId: uuid, fromCondition: condition, toCondition: condition, fromWarehouseId: nullable(uuid), toWarehouseId: nullable(uuid), externalLocation: nullable(text), reason: text, changedBy: uuid, createdAt: date }, ['id', 'routerId', 'fromCondition', 'toCondition', 'fromWarehouseId', 'toWarehouseId', 'externalLocation', 'reason', 'changedBy', 'createdAt']),
  RouterStatusHistory: obj({ id: uuid, routerId: uuid, fromStatus: routerStatus, toStatus: routerStatus, reason: text, changedBy: uuid, createdAt: date }, ['id', 'routerId', 'fromStatus', 'toStatus', 'reason', 'changedBy', 'createdAt']),
  IpHistory: obj({ id: uuid, ipId: uuid, fromStatus: ipStatus, toStatus: ipStatus, action: strEnum('CREATE', 'RESERVE', 'RELEASE', 'ARCHIVE', 'UNARCHIVE', 'UPDATE_METADATA'), reason: nullable(text), metadataBefore: { type: 'object', nullable: true, additionalProperties: true }, metadataAfter: { type: 'object', nullable: true, additionalProperties: true }, actorId: uuid, createdAt: date }, ['id', 'ipId', 'fromStatus', 'toStatus', 'action', 'reason', 'actorId', 'createdAt']),
  Job: obj({ id: text, status: strEnum('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'), downloadUrl: nullable(text), error: nullable(text), inserted: integer, skipped: integer, errors: { type: 'array', items: obj({ row: integer, address: text, reason: text }, ['row', 'address', 'reason']) }, result: { type: 'object', nullable: true, description: 'IP import outcome; see IpImportResultDto.' } }, ['id', 'status']),
  JobId: obj({ jobId: text }, ['jobId']),
  PhotoUpload: obj({ profilePhotoKey: text, url: text }, ['profilePhotoKey', 'url']),
  StockMutation: obj({ inventory: ref('Inventory'), movement: ref('Movement') }, ['inventory', 'movement']),
  TransferResult: obj({ sourceInventory: ref('Inventory'), destInventory: ref('Inventory') }, ['sourceInventory', 'destInventory']),
};
const wrapped = (schema) => obj({ data: schema }, ['data']);
const page = (name) => wrapped(obj({ items: { type: 'array', items: ref(name) }, total: integer }, ['items', 'total']));
const results = {
  employeePage: obj({ data: { type: 'array', items: ref('Employee') }, meta: obj({ page: integer, pageSize: integer, total: integer }, ['page', 'pageSize', 'total']) }, ['data', 'meta']),
  ...Object.fromEntries(['Employee', 'Attendance', 'Warehouse', 'Product', 'ProductWithStock', 'Movement', 'Router', 'IpAddress', 'Job', 'JobId', 'PhotoUpload', 'StockMutation', 'TransferResult'].map((name) => [name, wrapped(ref(name))])),
  ...Object.fromEntries(['Warehouse', 'ProductWithStock', 'InventoryListItem', 'Movement', 'Router', 'IpAddress'].map((name) => [`${name}Page`, page(name)])),
  ...Object.fromEntries(['RouterAssignment', 'RouterConditionHistory', 'RouterStatusHistory', 'IpHistory'].map((name) => [`${name}Array`, wrapped({ type: 'array', items: ref(name) })])),
};
const employeeFields = { name: { ...text, maxLength: 255 }, email: { ...text, format: 'email' }, role, department, phone: { ...text, maxLength: 30 }, nationalId: { ...text, maxLength: 30 }, hireDate: text, assignedWarehouseId: uuid };
const warehouseFields = { name: { ...text, maxLength: 255 }, address: text, latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, geofenceRadiusMeters: { type: 'integer', minimum: 50, maximum: 2000 }, managerId: uuid };
const productFields = { name: { ...text, maxLength: 255 }, sku: { ...text, maxLength: 100 }, model: { ...text, maxLength: 255 }, category: { ...text, maxLength: 100 }, description: text, lowStockThreshold: { type: 'integer', minimum: 0 } };
const stockFields = { warehouseId: uuid, productId: uuid, quantity: positive, responsibleUserId: uuid, notes: text };
const request = {
  employeeCreate: obj(employeeFields, ['name', 'email', 'role']),
  employeeUpdate: obj({ name: employeeFields.name, department, phone: employeeFields.phone, assignedWarehouseId: uuid }),
  employeeStatus: obj({ status: userStatus, reason: text }, ['status', 'reason']),
  checkIn: obj({ lat: { type: 'number', minimum: -90, maximum: 90 }, lng: { type: 'number', minimum: -180, maximum: 180 } }, ['lat', 'lng']),
  override: obj({ checkInAt: text, checkOutAt: text, status: strEnum('ON_TIME', 'LATE'), overrideReason: text }, ['overrideReason']),
  warehouseCreate: obj(warehouseFields, ['name', 'address', 'latitude', 'longitude']), warehouseUpdate: obj(warehouseFields),
  productCreate: obj(productFields, ['name', 'sku', 'model', 'category']), productUpdate: obj(productFields),
  inbound: obj({ ...stockFields, supplierName: { ...text, maxLength: 255 } }, ['warehouseId', 'productId', 'quantity', 'supplierName']),
  outbound: obj({ ...stockFields, technicianId: uuid }, ['warehouseId', 'productId', 'quantity', 'technicianId']),
  transfer: obj({ fromWarehouseId: uuid, toWarehouseId: uuid, productId: uuid, quantity: positive, responsibleUserId: uuid, notes: text }, ['fromWarehouseId', 'toWarehouseId', 'productId', 'quantity']),
  adjust: obj({ warehouseId: uuid, productId: uuid, newQuantity: { type: 'integer', minimum: 0 }, notes: text, responsibleUserId: uuid }, ['warehouseId', 'productId', 'newQuantity', 'notes']),
  routerCreate: obj({ serialNumber: { ...text, maxLength: 100 }, productId: uuid, warehouseId: uuid, physicalCondition: condition, isNewReceipt: boolean, notes: text }, ['serialNumber', 'productId', 'warehouseId']),
  routerAssign: obj({ technicianId: uuid, notes: text }, ['technicianId']),
  routerTransition: obj({ status: routerStatus, reason: text, targetWarehouseId: uuid, notes: text }, ['status', 'reason']),
  routerCondition: obj({ physicalCondition: condition, reason: text, warehouseId: uuid, externalLocation: text }, ['physicalCondition', 'reason']),
  routerExport: obj({ warehouseId: uuid }), ipCreate: obj({ address: { ...text, format: 'ipv4' }, notes: text }, ['address']), ipUpdate: obj({ notes: text }),
  reason: obj({ reason: text }),
  file: obj({ file: { type: 'string', format: 'binary' } }, ['file']),
};
const q = (name, schema = text) => ({ name, in: 'query', required: false, schema });
const limit = q('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 });
const offset = q('offset', { type: 'integer', minimum: 0, default: 0 });
const pageNum = q('page', { type: 'integer', minimum: 1, default: 1 });
const queries = {
  employees: [q('role', role), q('department', department), q('status', userStatus), q('warehouse_id', uuid), q('q'), pageNum, q('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 })],
  report: [q('from'), q('to'), q('department', department), q('employee_id', uuid)],
  warehouses: [q('search'), limit, offset], products: [q('search'), q('category'), q('isLowStock', boolean), limit, offset],
  inventory: [q('warehouseId', uuid), q('productId', uuid), limit, offset],
  movements: [q('warehouseId', uuid), q('productId', uuid), q('movementType', strEnum('INBOUND_SUPPLIER', 'OUTBOUND_TECHNICIAN', 'RETURN_TECHNICIAN', 'TRANSFER_WAREHOUSE', 'ADJUSTMENT')), q('technicianId', uuid), limit, offset],
  routers: [q('status', routerStatus), q('physicalCondition', condition), q('warehouseId', uuid), q('productId', uuid), q('search'), pageNum, limit],
  ips: [q('status', ipStatus), q('isArchived', boolean), q('search'), pageNum, limit],
};
const A = ['ADMIN'], AW = ['ADMIN', 'WAREHOUSE_STAFF'], AWC = ['ADMIN', 'WAREHOUSE_STAFF', 'CS'], ALL = ['ADMIN', 'WAREHOUSE_STAFF', 'CS', 'TECHNICIAN'], AT = ['ADMIN', 'TECHNICIAN'];
// [method, path, roles, success, result, request, query, authorization note]
const ops = [
  ['get','/employees',A,200,'employeePage',null,'employees'], ['post','/employees',A,201,'Employee','employeeCreate'],
  ['get','/employees/{id}',null,200,'Employee',null,null,'ADMIN or employee themself'], ['patch','/employees/{id}',A,200,'Employee','employeeUpdate'], ['patch','/employees/{id}/status',A,200,'Employee','employeeStatus'], ['post','/employees/{id}/photo',A,200,'PhotoUpload','file'],
  ['post','/attendance/check-in',['TECHNICIAN'],201,'Attendance','checkIn'], ['post','/attendance/check-out',['TECHNICIAN'],200,'Attendance'], ['patch','/attendance/{id}',A,200,'Attendance','override'], ['get','/attendance/report',A,202,'JobId',null,'report'],
  ['get','/warehouses',AWC,200,'WarehousePage',null,'warehouses'], ['post','/warehouses',A,201,'Warehouse','warehouseCreate'], ['get','/warehouses/{id}',AWC,200,'Warehouse'], ['patch','/warehouses/{id}',A,200,'Warehouse','warehouseUpdate'], ['delete','/warehouses/{id}',A,204],
  ['get','/products',ALL,200,'ProductWithStockPage',null,'products'], ['post','/products',AW,201,'Product','productCreate'], ['get','/products/{id}',ALL,200,'ProductWithStock'], ['patch','/products/{id}',AW,200,'Product','productUpdate'], ['delete','/products/{id}',A,204,null,null,null,'Current guarded hard delete; do not expose as deactivation'],
  ['get','/inventory',AWC,200,'InventoryListItemPage',null,'inventory'], ['get','/inventory/warehouses/{warehouseId}',AWC,200,'InventoryListItemPage',null,'inventory'],
  ['post','/inventory/inbound',AW,201,'StockMutation','inbound'], ['post','/inventory/outbound',AW,201,'StockMutation','outbound'], ['post','/inventory/returns',AW,201,'StockMutation','outbound'], ['post','/inventory/transfer',AW,200,'TransferResult','transfer'], ['post','/inventory/adjust',A,200,'StockMutation','adjust'], ['get','/inventory/movements',AW,200,'MovementPage',null,'movements'], ['get','/inventory/movements/{id}',AW,200,'Movement'],
  ['get','/routers',ALL,200,'RouterPage',null,'routers'], ['post','/routers',AW,201,'Router','routerCreate'], ['get','/routers/{id}',ALL,200,'Router'], ['post','/routers/{id}/assign',AW,200,'Router','routerAssign'], ['patch','/routers/{id}/transition',AW,200,'Router','routerTransition'], ['patch','/routers/{id}/condition',AW,200,'Router','routerCondition'], ['get','/routers/{id}/assignments',AW,200,'RouterAssignmentArray'], ['get','/routers/{id}/condition-history',AW,200,'RouterConditionHistoryArray'], ['get','/routers/{id}/status-history',AW,200,'RouterStatusHistoryArray'], ['post','/routers/export',A,200,'JobId','routerExport'],
  ['get','/ip-addresses',AT,200,'IpAddressPage',null,'ips'], ['post','/ip-addresses',A,201,'IpAddress','ipCreate'], ['get','/ip-addresses/{id}',AT,200,'IpAddress'], ['patch','/ip-addresses/{id}',A,200,'IpAddress','ipUpdate'], ...['reserve','release','archive','unarchive'].map((action) => ['post',`/ip-addresses/{id}/${action}`,A,200,'IpAddress','reason']), ['get','/ip-addresses/{id}/history',A,200,'IpHistoryArray'], ['post','/ip-addresses/import',A,202,'JobId','file'], ['get','/ip-addresses/import/{id}',A,200,'Job',null,null,'ADMIN and job authorization'],
  ['get','/jobs/{id}',null,200,'Job',null,null,'Requester or ADMIN'], ['get','/jobs/{id}/download',null,200,'binary',null,null,'Requester or ADMIN; local reports only'],
];
const paths = {};
for (const [method, path, roles, status, result, body, query, note] of ops) {
  const isJob = path.startsWith('/jobs/') || path === '/ip-addresses/import/{id}';
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: isJob ? text : uuid }));
  if (query) parameters.push(...queries[query]);
  const responses = { [status]: status === 204 ? { description: 'No content' } : result === 'binary' ? { description: 'Authorized XLSX bytes', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } } } : { description: 'Successful response', content: { 'application/json': { schema: results[result] } } }, 401: { description: 'Unauthenticated', content: { 'application/json': { schema: ref('Error') } } }, 403: { description: 'Forbidden where applicable', content: { 'application/json': { schema: ref('Error') } } } };
  const error = (description) => ({ description, content: { 'application/json': { schema: ref('Error') } } });
  if (body || query || (parameters.length && !isJob)) responses[400] = error('Invalid input or domain validation failure');
  if (parameters.some((p) => p.in === 'path')) responses[404] = error('Resource or authorized job not found where applicable');
  if (['post', 'patch', 'delete'].includes(method) && body !== 'file') responses[409] = error('Conflict where applicable; see controller/service and wire catalog');
  const operation = { operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`, summary: `${method.toUpperCase()} ${path}`, security: [{ bearerAuth: [] }], ...(roles ? { 'x-roles': roles } : {}), ...(note ? { description: note } : {}), ...(parameters.length ? { parameters } : {}), ...(body ? { requestBody: { required: body !== 'reason' && body !== 'routerExport', content: { [body === 'file' ? 'multipart/form-data' : 'application/json']: { schema: request[body] } } } } : {}), responses };
  (paths[path] ??= {})[method] = operation;
}
const spec = { openapi: '3.0.3', info: { title: 'Phase 2 implemented API — review snapshot', version: '97bcd31', description: 'Source-based draft. Not a freeze or complete validation specification; see phase-2-wire-contracts.md and phase-2-openapi-fragments.md for semantics, errors, examples and exact history schemas. Future contracts excluded.' }, servers: [{ url: '/', description: 'API origin; browser access uses the /api rewrite' }], paths, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas } };
writeFileSync(new URL('./phase-2-openapi.json', import.meta.url), `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${ops.length} operations across ${Object.keys(paths).length} paths`);
