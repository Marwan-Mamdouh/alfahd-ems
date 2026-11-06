import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import ExcelJS from 'exceljs';
import { Inject, Logger, OnApplicationShutdown } from '@nestjs/common';
import { aliasedTable, and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../database/database.module.js';
import {
  attendanceRecords,
  users,
  routers,
  products,
  warehouses,
  routerAssignments,
} from '../database/schema/index.js';
import { StorageService } from '../storage/storage.interface.js';
import { REPORT_STORAGE } from '../storage/local-report-storage.service.js';
import { calculateHoursWorked } from '../common/utils/attendance.utils.js';
import { formatLocalTimestamp } from '../common/services/clock.service.js';
import { sanitizeSpreadsheetCell } from '../common/utils/spreadsheet.utils.js';

@Processor('reports')
export class AttendanceReportWorker extends WorkerHost implements OnApplicationShutdown {
  private readonly logger = new Logger(AttendanceReportWorker.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(REPORT_STORAGE) private readonly storageService: StorageService,
  ) {
    super();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close(true);
    }
  }

  async process(
    job: Job,
  ): Promise<{ downloadUrl: string; totalRows: number; completedAt: string }> {
    if (job.data.type === 'ATTENDANCE_SUMMARY') {
      return this.processAttendance(job);
    }

    if (job.data.type === 'ROUTER_INVENTORY_REPORT') {
      return this.processRouterInventory(job);
    }

    throw new Error(`Unsupported report job type: ${job.data.type}`);
  }

  private async processAttendance(
    job: Job,
  ): Promise<{ downloadUrl: string; totalRows: number; completedAt: string }> {
    const { from, to, department, employee_id } = job.data.params;

    const conditions = [];
    if (from) conditions.push(gte(attendanceRecords.workDate, from));
    if (to) conditions.push(lte(attendanceRecords.workDate, to));
    if (employee_id) conditions.push(eq(attendanceRecords.userId, employee_id));
    if (department) conditions.push(eq(users.department, department));

    const rows = await this.db
      .select({
        record: attendanceRecords,
        user: users,
      })
      .from(attendanceRecords)
      .innerJoin(users, eq(attendanceRecords.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(attendanceRecords.workDate), asc(users.name), asc(attendanceRecords.checkInAt));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AlFahd EMS';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Attendance Report', {
      views: [{ rightToLeft: false }],
    });

    worksheet.columns = [
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Work Date', key: 'workDate', width: 15 },
      { header: 'Check-in Time', key: 'checkInAt', width: 22 },
      { header: 'Check-out Time', key: 'checkOutAt', width: 22 },
      { header: 'Hours Worked', key: 'hoursWorked', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Distance (m)', key: 'distance', width: 15 },
      { header: 'Override Notes', key: 'overrideReason', width: 35 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F497D' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const item of rows) {
      const hours = calculateHoursWorked(item.record.checkInAt, item.record.checkOutAt);
      const hoursWorked = hours === null ? '-' : hours.toFixed(2);

      worksheet.addRow({
        name: sanitizeSpreadsheetCell(item.user.name),
        email: sanitizeSpreadsheetCell(item.user.email),
        department: item.user.department ? sanitizeSpreadsheetCell(item.user.department) : '-',
        workDate: item.record.workDate,
        checkInAt: formatLocalTimestamp(item.record.checkInAt),
        checkOutAt: item.record.checkOutAt ? formatLocalTimestamp(item.record.checkOutAt) : '-',
        hoursWorked,
        status: item.record.status,
        distance: item.record.checkInDistanceM,
        overrideReason: item.record.overrideReason
          ? sanitizeSpreadsheetCell(item.record.overrideReason)
          : '-',
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const uploadResult = await this.storageService.uploadFile(
      buffer,
      'reports',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return {
      downloadUrl: uploadResult.url,
      totalRows: rows.length,
      completedAt: new Date().toISOString(),
    };
  }

  private async processRouterInventory(
    job: Job,
  ): Promise<{ downloadUrl: string; totalRows: number; completedAt: string }> {
    const { warehouseId } = job.data.params ?? {};

    // 1. Fetch Warehouses for the Warehouse Summary Sheet
    const warehouseConditions = [];
    if (warehouseId) {
      warehouseConditions.push(eq(warehouses.id, warehouseId));
    }

    const warehouseList = await this.db
      .select()
      .from(warehouses)
      .where(warehouseConditions.length > 0 ? and(...warehouseConditions) : undefined)
      .orderBy(asc(warehouses.name));

    // 2. Query Routers with Products, Physical Location, and Open Custody
    const routerConditions = [];
    if (warehouseId) {
      routerConditions.push(eq(routers.warehouseId, warehouseId));
    }

    const custodyWarehouse = aliasedTable(warehouses, 'custody_warehouse');
    const custodyTechnician = aliasedTable(users, 'custody_technician');

    const routerRows = await this.db
      .select({
        router: routers,
        product: products,
        physicalWarehouse: warehouses,
        custody: routerAssignments,
        custodyWarehouse,
        custodyTechnician,
      })
      .from(routers)
      .innerJoin(products, eq(routers.productId, products.id))
      .leftJoin(warehouses, eq(routers.warehouseId, warehouses.id))
      .leftJoin(
        routerAssignments,
        and(eq(routers.id, routerAssignments.routerId), isNull(routerAssignments.releasedAt)),
      )
      .leftJoin(custodyWarehouse, eq(routerAssignments.warehouseId, custodyWarehouse.id))
      .leftJoin(custodyTechnician, eq(routerAssignments.technicianId, custodyTechnician.id))
      .where(routerConditions.length > 0 ? and(...routerConditions) : undefined)
      .orderBy(asc(warehouses.name), asc(routers.serialNumber));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AlFahd EMS';
    workbook.created = new Date();

    // ─── Sheet 1: Warehouse Summary ─────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Warehouse Summary', {
      views: [{ rightToLeft: false }],
    });

    summarySheet.columns = [
      { header: 'Warehouse Name', key: 'warehouseName', width: 25 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Total Physical Devices', key: 'totalDevices', width: 22 },
      { header: 'Usable Stock (AVAILABLE + SERVICEABLE)', key: 'usableStock', width: 34 },
      { header: 'Condition: SERVICEABLE', key: 'serviceable', width: 24 },
      { header: 'Condition: DAMAGED', key: 'damaged', width: 22 },
      { header: 'Condition: UNDER_REPAIR', key: 'underRepairCondition', width: 26 },
      { header: 'Lifecycle: AVAILABLE', key: 'available', width: 22 },
      { header: 'Lifecycle: DAMAGED', key: 'damagedLifecycle', width: 22 },
      { header: 'Lifecycle: UNDER_REPAIR', key: 'underRepair', width: 24 },
      { header: 'Lifecycle: RETURNED', key: 'returned', width: 22 },
      { header: 'Lifecycle: ASSIGNED_TO_TECHNICIAN', key: 'assignedToTech', width: 32 },
      { header: 'Lifecycle: INSTALLED_AT_CUSTOMER', key: 'installedAtCustomer', width: 30 },
      { header: 'Lifecycle: DECOMMISSIONED', key: 'decommissioned', width: 26 },
      { header: 'Lifecycle: LOST', key: 'lost', width: 18 },
      { header: 'Custody: WAREHOUSE', key: 'custodyWarehouse', width: 22 },
      { header: 'Custody: TECHNICIAN', key: 'custodyTechnician', width: 22 },
      { header: 'Custody: NONE (Unassigned)', key: 'custodyNone', width: 26 },
    ];

    const summaryHeaderRow = summarySheet.getRow(1);
    summaryHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F497D' },
    };
    summaryHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    summaryHeaderRow.getCell(3).note =
      'Counts are distinct devices by physical location. Lifecycle, condition, custody and usable stock are independent dimensions and overlap; do not add across dimensions.';

    for (const w of warehouseList) {
      const warehouseRouters = routerRows.filter((r) => r.router.warehouseId === w.id);

      const totalDevices = warehouseRouters.length;
      const usableStock = warehouseRouters.filter(
        (r) => r.router.status === 'AVAILABLE' && r.router.physicalCondition === 'SERVICEABLE',
      ).length;

      const serviceable = warehouseRouters.filter(
        (r) => r.router.physicalCondition === 'SERVICEABLE',
      ).length;
      const damaged = warehouseRouters.filter(
        (r) => r.router.physicalCondition === 'DAMAGED',
      ).length;
      const underRepairCondition = warehouseRouters.filter(
        (r) => r.router.physicalCondition === 'UNDER_REPAIR',
      ).length;

      const available = warehouseRouters.filter((r) => r.router.status === 'AVAILABLE').length;
      const underRepair = warehouseRouters.filter((r) => r.router.status === 'UNDER_REPAIR').length;
      const returned = warehouseRouters.filter((r) => r.router.status === 'RETURNED').length;
      const assignedToTech = warehouseRouters.filter(
        (r) => r.router.status === 'ASSIGNED_TO_TECHNICIAN',
      ).length;
      const installedAtCustomer = warehouseRouters.filter(
        (r) => r.router.status === 'INSTALLED_AT_CUSTOMER',
      ).length;
      const decommissioned = warehouseRouters.filter(
        (r) => r.router.status === 'DECOMMISSIONED',
      ).length;
      const lost = warehouseRouters.filter((r) => r.router.status === 'LOST').length;

      const countWarehouseCustody = warehouseRouters.filter(
        (r) => r.custody?.holderType === 'WAREHOUSE',
      ).length;
      const countTechnicianCustody = warehouseRouters.filter(
        (r) => r.custody?.holderType === 'TECHNICIAN',
      ).length;
      const countCustodyNone = warehouseRouters.filter((r) => !r.custody).length;

      summarySheet.addRow({
        warehouseName: sanitizeSpreadsheetCell(w.name),
        status: w.isActive ? 'ACTIVE' : 'INACTIVE',
        totalDevices,
        usableStock,
        serviceable,
        damaged,
        underRepairCondition,
        available,
        damagedLifecycle: warehouseRouters.filter((r) => r.router.status === 'DAMAGED').length,
        underRepair,
        returned,
        assignedToTech,
        installedAtCustomer,
        decommissioned,
        lost,
        custodyWarehouse: countWarehouseCustody,
        custodyTechnician: countTechnicianCustody,
        custodyNone: countCustodyNone,
      });
    }

    // If external routers exist (warehouseId is null) and no specific warehouse filter was passed
    if (!warehouseId) {
      const externalRouters = routerRows.filter((r) => r.router.warehouseId === null);
      if (externalRouters.length > 0) {
        summarySheet.addRow({
          warehouseName: 'External / Off-Site Locations',
          status: '-',
          totalDevices: externalRouters.length,
          usableStock: 0, // External routers can never contribute to usable warehouse stock
          serviceable: externalRouters.filter((r) => r.router.physicalCondition === 'SERVICEABLE')
            .length,
          damaged: externalRouters.filter((r) => r.router.physicalCondition === 'DAMAGED').length,
          underRepairCondition: externalRouters.filter(
            (r) => r.router.physicalCondition === 'UNDER_REPAIR',
          ).length,
          available: externalRouters.filter((r) => r.router.status === 'AVAILABLE').length,
          damagedLifecycle: externalRouters.filter((r) => r.router.status === 'DAMAGED').length,
          underRepair: externalRouters.filter((r) => r.router.status === 'UNDER_REPAIR').length,
          returned: externalRouters.filter((r) => r.router.status === 'RETURNED').length,
          assignedToTech: externalRouters.filter(
            (r) => r.router.status === 'ASSIGNED_TO_TECHNICIAN',
          ).length,
          installedAtCustomer: externalRouters.filter(
            (r) => r.router.status === 'INSTALLED_AT_CUSTOMER',
          ).length,
          decommissioned: externalRouters.filter((r) => r.router.status === 'DECOMMISSIONED')
            .length,
          lost: externalRouters.filter((r) => r.router.status === 'LOST').length,
          custodyWarehouse: externalRouters.filter((r) => r.custody?.holderType === 'WAREHOUSE')
            .length,
          custodyTechnician: externalRouters.filter((r) => r.custody?.holderType === 'TECHNICIAN')
            .length,
          custodyNone: externalRouters.filter((r) => !r.custody).length,
        });
      }
    }

    // ─── Sheet 2: Router Inventory Details ──────────────────────────────────
    const detailsSheet = workbook.addWorksheet('Router Inventory Details', {
      views: [{ rightToLeft: false }],
    });

    detailsSheet.columns = [
      { header: 'Serial Number', key: 'serialNumber', width: 25 },
      { header: 'Product Name', key: 'productName', width: 25 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'Status', key: 'status', width: 25 },
      { header: 'Physical Condition', key: 'physicalCondition', width: 20 },
      { header: 'Usable Stock', key: 'usable', width: 18 },
      { header: 'Physical Location Type', key: 'physicalLocationType', width: 22 },
      { header: 'Physical Warehouse', key: 'warehouse', width: 25 },
      { header: 'External Location', key: 'externalLocation', width: 25 },
      { header: 'Current Custody Type', key: 'custodyType', width: 22 },
      { header: 'Current Custody Holder', key: 'custodyHolder', width: 32 },
      { header: 'Custody Assigned At', key: 'custodyAssignedAt', width: 22 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    const detailsHeaderRow = detailsSheet.getRow(1);
    detailsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailsHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F497D' },
    };
    detailsHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const item of routerRows) {
      const isUsable =
        item.router.status === 'AVAILABLE' &&
        item.router.physicalCondition === 'SERVICEABLE' &&
        item.router.warehouseId !== null;

      let custodyHolder = '-';
      if (item.custody) {
        if (item.custody.holderType === 'TECHNICIAN' && item.custodyTechnician) {
          custodyHolder = sanitizeSpreadsheetCell(
            `${item.custodyTechnician.name} (${item.custodyTechnician.email})`,
          );
        } else if (item.custody.holderType === 'WAREHOUSE' && item.custodyWarehouse) {
          custodyHolder = sanitizeSpreadsheetCell(item.custodyWarehouse.name);
        } else if (item.custody.holderType === 'CUSTOMER') {
          custodyHolder = 'CUSTOMER';
        } else {
          custodyHolder = sanitizeSpreadsheetCell(item.custody.holderType);
        }
      }

      const assignedAtFormatted = item.custody?.assignedAt
        ? formatLocalTimestamp(item.custody.assignedAt)
        : '-';

      detailsSheet.addRow({
        serialNumber: sanitizeSpreadsheetCell(item.router.serialNumber),
        productName: sanitizeSpreadsheetCell(item.product.name),
        sku: sanitizeSpreadsheetCell(item.product.sku),
        model: sanitizeSpreadsheetCell(item.product.model),
        status: item.router.status,
        physicalCondition: item.router.physicalCondition,
        usable: isUsable ? 'YES (+1)' : 'NO (0)',
        physicalLocationType: item.router.warehouseId ? 'WAREHOUSE' : 'EXTERNAL',
        warehouse: item.physicalWarehouse
          ? sanitizeSpreadsheetCell(item.physicalWarehouse.name)
          : '-',
        externalLocation: item.router.externalLocation
          ? sanitizeSpreadsheetCell(item.router.externalLocation)
          : '-',
        custodyType: item.custody ? item.custody.holderType : 'NONE',
        custodyHolder,
        custodyAssignedAt: assignedAtFormatted,
        notes: item.router.notes ? sanitizeSpreadsheetCell(item.router.notes) : '-',
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const uploadResult = await this.storageService.uploadFile(
      buffer,
      'reports',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return {
      downloadUrl: uploadResult.url,
      totalRows: routerRows.length,
      completedAt: new Date().toISOString(),
    };
  }
}
