/** Review proposals for #67, not implemented endpoint contracts. No network code. */
import type {
  AssignRouterDto, AttendanceRecordDto, AttendanceStatus, CreateEmployeeDto, CreateIpDto,
  CreateRouterDto, Department, EmployeeDto, EmployeeQueryDto, IpAddressDto, IpHistoryDto, IpQueryDto,
  JobStatusResponseDto, OverrideAttendanceDto, Role, RouterAssignmentDto, RouterConditionHistoryDto,
  RouterDto, RouterQueryDto, RouterStatusHistoryDto,
  TransitionRouterDto, UpdateEmployeeDto, UpdateEmployeeStatusDto, UpdateRouterConditionDto,
  UserStatus,
} from '@alfahd/types';

export type Remote<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: () => void }
  | { kind: 'empty' }
  | { kind: 'ready'; value: T };
export type Page<T> = { items: readonly T[]; total: number; page: number; pageSize: number };
export type Mutation<T> = {
  pending: boolean;
  error: string | null;
  fieldErrors: Partial<Record<keyof T, string>>;
};
export type Job =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'polling'; job: JobStatusResponseDto }
  | { kind: 'complete'; job: JobStatusResponseDto }
  | { kind: 'error'; message: string };
export type ListProps<Row, Filter, Capabilities> = {
  data: Remote<Page<Row>>;
  filter: Filter;
  capabilities: Capabilities;
  onFilterChange: (filter: Filter) => void;
  onPageChange: (page: number) => void;
};
export type FormProps<Form> = {
  initial: Form;
  mutation: Mutation<Form>;
  onSubmit: (form: Form) => Promise<void>;
  onCancel: () => void;
};
export type Lookup = { id: string; name: string; status: UserStatus; warehouseId: string | null };

/** The presentation layer builds public image URLs from the proposed identifier. */
export type EmployeeRow = Omit<EmployeeDto, 'profilePhotoKey'> & {
  warehouseName: string | null;
  photoId: string | null;
};
export type EmployeePhotoProps = {
  photoId: string | null;
  canRetry: boolean;
  onRetry: () => void;
};
export type EmployeeFilter = EmployeeQueryDto;
export type EmployeeForm = CreateEmployeeDto | UpdateEmployeeDto;
export type EmployeeCapabilities = { create: boolean; edit: boolean; changeStatus: boolean; uploadPhoto: boolean };
export type EmployeeProps = ListProps<EmployeeRow, EmployeeFilter, EmployeeCapabilities> & {
  onCreate: (value: CreateEmployeeDto) => Promise<void>;
  onUpdate: (id: string, value: UpdateEmployeeDto) => Promise<void>;
  onStatus: (id: string, value: UpdateEmployeeStatusDto) => Promise<void>;
  onPhoto: (id: string, file: File) => Promise<void>;
};
export type EmployeeDetailProps = {
  employee: Remote<EmployeeRow>;
  photo: EmployeePhotoProps;
  attendance: EmployeeAttendanceHistoryProps;
};

/** Read endpoint/summary shape is a UI proposal, not an existing API. */
export type AttendanceRow = AttendanceRecordDto & { employeeName: string; userId: string };
export type AttendanceFilter = { from?: string; to?: string; employeeId?: string; department?: Department; status?: AttendanceStatus };
export type AttendanceTotals = { total: number; onTime: number; late: number };
/** total is the status-filtered count; totals exclude status but respect other filters. */
export type AttendancePage = { page: Page<AttendanceRow>; totals: AttendanceTotals };
export type AttendanceLoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: () => void }
  | { kind: 'ready'; value: AttendancePage };
export type AttendanceCapabilities = { view: boolean; override: boolean; export: boolean };
export type AttendanceProps = {
  data: AttendanceLoadState;
  filter: AttendanceFilter;
  capabilities: AttendanceCapabilities;
  onFilterChange: (filter: AttendanceFilter) => void;
  onPageChange: (page: number) => void;
  job: Job;
  onOverride: (id: string, value: OverrideAttendanceDto) => Promise<void>;
  onExport: () => Promise<void>;
};
/** Employee identity is fixed by the enclosing detail view, never by department. */
export type EmployeeAttendanceHistoryFilter = Pick<AttendanceFilter, 'from' | 'to' | 'status'>;
export type EmployeeAttendanceHistoryProps = {
  data: AttendanceLoadState;
  filter: EmployeeAttendanceHistoryFilter;
  capabilities: Pick<AttendanceCapabilities, 'view' | 'override'>;
  onFilterChange: (filter: EmployeeAttendanceHistoryFilter) => void;
  onPageChange: (page: number) => void;
  onOverride: (id: string, value: OverrideAttendanceDto) => Promise<void>;
};

export type WarehouseRow = { id: string; name: string; address: string; latitude: number; longitude: number; geofenceRadiusMeters: number; managerId: string | null; isActive: boolean };
export type WarehouseFilter = { search?: string };
export type WarehouseForm = { name: string; address: string; latitude: number; longitude: number; geofenceRadiusMeters?: number; managerId?: string };
export type WarehouseCapabilities = { create: boolean; edit: boolean; deactivate: boolean };
export type WarehouseProps = ListProps<WarehouseRow, WarehouseFilter, WarehouseCapabilities> & {
  onCreate: (value: WarehouseForm) => Promise<void>;
  onUpdate: (id: string, value: Partial<WarehouseForm>) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
};

export type ProductRow = { id: string; name: string; sku: string; model: string; category: string; description: string | null; lowStockThreshold: number; isSerialized: boolean; totalStock: number; isLowStock: boolean };
export type ProductFilter = { search?: string; category?: string; isLowStock?: boolean };
export type ProductForm = { name: string; sku: string; model: string; category: string; description?: string; lowStockThreshold?: number };
export type ProductCapabilities = { create: boolean; edit: boolean; deactivate: boolean };
export type ProductProps = ListProps<ProductRow, ProductFilter, ProductCapabilities> & {
  onCreate: (value: ProductForm) => Promise<void>;
  onUpdate: (id: string, value: Partial<ProductForm>) => Promise<void>;
  /** Future only; disabled until #81 is implemented and approved. */
  onDeactivate: (id: string) => Promise<void>;
};
export type MovementType = 'INBOUND_SUPPLIER' | 'OUTBOUND_TECHNICIAN' | 'RETURN_TECHNICIAN' | 'TRANSFER_WAREHOUSE' | 'ADJUSTMENT';
export type InventoryRow = { id: string; productId: string; warehouseId: string; quantity: number; productName: string; warehouseName: string };
export type InventoryFilter = { productId?: string; warehouseId?: string };
export type InventoryForm =
  | { kind: 'inbound'; warehouseId: string; productId: string; quantity: number; supplierName: string; notes?: string }
  | { kind: 'outbound' | 'return'; warehouseId: string; productId: string; quantity: number; technicianId: string; notes?: string }
  | { kind: 'transfer'; fromWarehouseId: string; toWarehouseId: string; productId: string; quantity: number; notes?: string }
  | { kind: 'adjust'; warehouseId: string; productId: string; newQuantity: number; notes: string };
export type InventoryCapabilities = { read: boolean; move: boolean; adjust: boolean; history: boolean };
export type InventoryProps = ListProps<InventoryRow, InventoryFilter, InventoryCapabilities> & { onMovement: (value: InventoryForm) => Promise<void> };
/** Wire dates are strings; labels are supplied by the container, not guaranteed by the API. */
export type StockMovementRow = {
  id: string; warehouseId: string; productId: string; movementType: MovementType; quantity: number;
  supplierName: string | null; technicianId: string | null; responsibleUserId: string;
  notes: string | null; createdAt: string;
};
export type MovementFilter = { warehouseId?: string; productId?: string; movementType?: MovementType; technicianId?: string };
export type MovementHistoryProps = ListProps<StockMovementRow, MovementFilter, { history: boolean }> & {
  selected: Remote<StockMovementRow> | null;
  onSelect: (id: string) => void;
  onCloseDetail: () => void;
};

export type RouterRow = RouterDto & { productName: string; warehouseName: string | null };
export type RouterFilter = RouterQueryDto;
export type RouterForm = CreateRouterDto;
export type RouterCapabilities = { create: boolean; assign: boolean; transition: boolean; condition: boolean; history: boolean; export: boolean };
export type RouterProps = ListProps<RouterRow, RouterFilter, RouterCapabilities> & {
  job: Job;
  onCreate: (value: CreateRouterDto) => Promise<void>;
  onAssign: (id: string, value: AssignRouterDto) => Promise<void>;
  onTransition: (id: string, value: TransitionRouterDto) => Promise<void>;
  onCondition: (id: string, value: UpdateRouterConditionDto) => Promise<void>;
  onExport: (warehouseId?: string) => Promise<void>;
};
/** Each audit endpoint loads independently and returns an unpaginated array. */
export type RouterAuditProps = {
  routerId: string;
  canView: boolean;
  assignments: Remote<readonly RouterAssignmentDto[]>;
  conditions: Remote<readonly RouterConditionHistoryDto[]>;
  statuses: Remote<readonly RouterStatusHistoryDto[]>;
};

export type IpRow = IpAddressDto;
export type IpFilter = IpQueryDto;
export type IpForm = CreateIpDto;
export type IpCapabilities = { read: boolean; create: boolean; edit: boolean; reserve: boolean; archive: boolean; history: boolean; import: boolean };
export type IpProps = ListProps<IpRow, IpFilter, IpCapabilities> & {
  job: Job;
  onCreate: (value: IpForm) => Promise<void>;
  onEdit: (id: string, notes: string) => Promise<void>;
  onAction: (id: string, action: 'reserve' | 'release' | 'archive' | 'unarchive', reason?: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
};
export type IpHistoryProps = { ipId: string; canView: boolean; data: Remote<readonly IpHistoryDto[]> };
export type CurrentRole = Role;
