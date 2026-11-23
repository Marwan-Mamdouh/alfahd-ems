/** Review proposals for #67, not implemented endpoint contracts. No network code. */
import type {
  AssignRouterDto, AttendanceListItemDto, AttendanceStatus, CreateEmployeeDto, CreateIpDto,
  CreateRouterDto, Department, EmployeeDto, EmployeeQueryDto, IpAddressDto, IpHistoryDto, IpQueryDto,
  JobStatusResponseDto, OverrideAttendanceDto, Role, RouterAssignmentDto, RouterConditionHistoryDto,
  RouterDto, RouterQueryDto, RouterStatusHistoryDto,
  TransitionRouterDto, UpdateEmployeeDto, UpdateEmployeeStatusDto, UpdateRouterConditionDto,
  EmployeeLookupDto,
} from '@alfahd/types';

export type Remote<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; retry: () => void }
  | { kind: 'empty' }
  | { kind: 'ready'; value: T };
export type Page<T> = { items: readonly T[]; total: number; page: number; pageSize: number };
type KeysOfUnion<T> = T extends unknown ? keyof T : never;
export type Mutation<T> = {
  pending: boolean;
  error: string | null;
  fieldErrors: Partial<Record<KeysOfUnion<T>, string>>;
  conflict?: string | null;
};
export type ActionState = { pending: boolean; error: string | null; conflict?: string | null };
/** The container owns authorization and transport; never expose a URL as the download action. */
export type ReportDownload = {
  /** The only job ID is job.id on the enclosing completed report. */
  jobId?: never;
  canDownload: boolean;
  action: ActionState;
  onDownload: (jobId: string) => Promise<void>;
};
type JobView = Omit<JobStatusResponseDto, 'downloadUrl'> & { downloadUrl?: never };
export type Job =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'polling'; job: JobView }
  | { kind: 'complete'; job: JobView }
  | { kind: 'error'; message: string };
/** Download is available only on completion; the presenter passes job.id to the container. */
export type ReportJob =
  | { kind: 'idle'; download?: never }
  | { kind: 'submitting'; download?: never }
  | { kind: 'polling'; job: JobView; download?: never }
  | { kind: 'complete'; job: JobView & { status: 'COMPLETED' }; download: ReportDownload }
  | { kind: 'error'; message: string; download?: never };
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
export type Lookup = EmployeeLookupDto;

/** The backend-owned container supplies a resolved public URL, or null. */
export type EmployeeRow = Omit<EmployeeDto, 'profilePhotoKey'> & {
  warehouseName: string | null;
  photoUrl: string | null;
};
export type EmployeePhotoProps = {
  photoUrl: string | null;
};
/** Creation has already succeeded; retry only uploads to this saved employee. */
export type CreatedEmployeePhotoRetry = {
  employeeId: string;
  action: ActionState;
  onRetryUpload: (employeeId: string, file: File) => Promise<void>;
};
export type EmployeeFilter = EmployeeQueryDto;
export type EmployeeForm = CreateEmployeeDto | UpdateEmployeeDto;
export type EmployeeCapabilities = { create: boolean; edit: boolean; changeStatus: boolean; uploadPhoto: boolean };
export type EmployeeProps = ListProps<EmployeeRow, EmployeeFilter, EmployeeCapabilities> & {
  actions: { create: Mutation<CreateEmployeeDto>; update: Mutation<UpdateEmployeeDto>; status: Mutation<UpdateEmployeeStatusDto>; photo: ActionState };
  createdPhotoRetry: CreatedEmployeePhotoRetry | null;
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

export type AttendanceRow = AttendanceListItemDto;
export type AttendanceFilter = { from?: string; to?: string; employeeId?: string; department?: Department; status?: AttendanceStatus };
export type AttendanceTotals = { total: number; onTime: number; late: number };
/** Both page.total and card totals include all selected filters, before pagination. */
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
  job: ReportJob;
  override: Mutation<OverrideAttendanceDto>;
  exportAction: ActionState;
  onOverride: (id: string, value: OverrideAttendanceDto) => Promise<void>;
  onExport: () => Promise<void>;
};
/** Employee identity is fixed by the enclosing detail view, never by department. */
export type EmployeeAttendanceHistoryFilter = Pick<AttendanceFilter, 'from' | 'to' | 'status'>;
export type EmployeeAttendanceHistoryProps = {
  data: AttendanceLoadState;
  filter: EmployeeAttendanceHistoryFilter;
  capabilities: Pick<AttendanceCapabilities, 'view' | 'override'>;
  override: Mutation<OverrideAttendanceDto>;
  onFilterChange: (filter: EmployeeAttendanceHistoryFilter) => void;
  onPageChange: (page: number) => void;
  onOverride: (id: string, value: OverrideAttendanceDto) => Promise<void>;
};

export type WarehouseRow = { id: string; name: string; address: string; latitude: number; longitude: number; geofenceRadiusMeters: number; managerId: string | null; isActive: boolean };
export type WarehouseFilter = { search?: string };
export type WarehouseForm = { name: string; address: string; latitude: number; longitude: number; geofenceRadiusMeters?: number; managerId?: string };
export type WarehouseCapabilities = { create: boolean; edit: boolean; deactivate: boolean };
/** The container filters active ADMIN/WAREHOUSE_STAFF; technician isEligible is unrelated. */
export type ManagerOption = { id: string; name: string; role: 'ADMIN' | 'WAREHOUSE_STAFF'; status: 'ACTIVE' };
export type ManagerSelector = {
  options: Remote<readonly ManagerOption[]>;
  search: string;
  onSearchChange: (search: string) => void;
  /** Separate from new choices; omit managerId from an unrelated update to retain it. */
  currentOnly: { id: string; name: string | null; reason: 'inactive' | 'unresolved' } | null;
};
export type WarehouseProps = ListProps<WarehouseRow, WarehouseFilter, WarehouseCapabilities> & {
  managers: ManagerSelector;
  actions: { create: Mutation<WarehouseForm>; update: Mutation<WarehouseForm>; deactivate: ActionState };
  onCreate: (value: WarehouseForm) => Promise<void>;
  onUpdate: (id: string, value: Partial<WarehouseForm>) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
};

export type ProductRow = { id: string; name: string; sku: string; model: string; category: string; description: string | null; lowStockThreshold: number; isSerialized: boolean; isActive: boolean; totalStock: number; isLowStock: boolean };
export type ProductFilter = { search?: string; category?: string; isLowStock?: boolean; activeOnly?: boolean; isActive?: boolean };
export type ProductForm = { name: string; sku: string; model: string; category: string; description?: string; lowStockThreshold?: number };
export type ProductCapabilities = { create: boolean; edit: boolean; deactivate: boolean; reactivate: boolean };
export type ProductProps = ListProps<ProductRow, ProductFilter, ProductCapabilities> & {
  actions: { create: Mutation<ProductForm>; update: Mutation<ProductForm>; deactivate: ActionState };
  onCreate: (value: ProductForm) => Promise<void>;
  onUpdate: (id: string, value: Partial<ProductForm>) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
  reactivation: { pending: boolean; error: string | null };
  onReactivate: (id: string) => Promise<void>;
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
export type InventoryProps = ListProps<InventoryRow, InventoryFilter, InventoryCapabilities> & { movement: Mutation<InventoryForm>; onMovement: (value: InventoryForm) => Promise<void> };
/** Names are supplied by authorized history data, including inactive people. Null means unresolved:
 * display "Name unavailable", never infer a name or perform a presenter lookup. */
export type HistoricalPerson = { id: string; name: string | null };
/** Wire dates are strings; labels are supplied by the container, not guaranteed by the API. */
export type StockMovementRow = {
  id: string; warehouseId: string; productId: string; movementType: MovementType; quantity: number;
  supplierName: string | null;
  notes: string | null; createdAt: string;
  technician: HistoricalPerson | null; responsibleUser: HistoricalPerson;
  technicianId?: never; responsibleUserId?: never;
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
  job: ReportJob;
  actions: { create: Mutation<CreateRouterDto>; assign: Mutation<AssignRouterDto>; transition: Mutation<TransitionRouterDto>; condition: Mutation<UpdateRouterConditionDto>; export: ActionState };
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
  assignments: Remote<readonly (Omit<RouterAssignmentDto, 'technicianId' | 'assignedBy'> & { technician: HistoricalPerson | null; assignedByPerson: HistoricalPerson; technicianId?: never; assignedBy?: never })[]>;
  conditions: Remote<readonly (Omit<RouterConditionHistoryDto, 'changedBy'> & { actor: HistoricalPerson; changedBy?: never })[]>;
  statuses: Remote<readonly (Omit<RouterStatusHistoryDto, 'changedBy'> & { actor: HistoricalPerson; changedBy?: never })[]>;
};

export type IpRow = IpAddressDto;
export type IpFilter = IpQueryDto;
export type IpForm = CreateIpDto;
export type IpCapabilities = { read: boolean; create: boolean; edit: boolean; reserve: boolean; archive: boolean; history: boolean; import: boolean };
export type IpProps = ListProps<IpRow, IpFilter, IpCapabilities> & {
  job: Job;
  actions: { create: Mutation<IpForm>; edit: Mutation<{ notes: string }>; reserve: ActionState; release: ActionState; archive: ActionState; unarchive: ActionState; import: ActionState };
  onCreate: (value: IpForm) => Promise<void>;
  onEdit: (id: string, notes: string) => Promise<void>;
  onAction: (id: string, action: 'reserve' | 'release' | 'archive' | 'unarchive', reason?: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
};
export type IpHistoryProps = { ipId: string; canView: boolean; data: Remote<readonly IpHistoryDto[]> };
export type CurrentRole = Role;
