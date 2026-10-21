import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import ExcelJS from 'exceljs';
import { Inject, Logger, OnApplicationShutdown } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../database/database.module.js';
import { attendanceRecords, users } from '../database/schema/index.js';
import { StorageService } from '../storage/storage.interface.js';
import { calculateHoursWorked } from '../common/utils/attendance.utils.js';
import { formatLocalTimestamp } from '../common/services/clock.service.js';
import { sanitizeSpreadsheetCell } from '../common/utils/spreadsheet.utils.js';

@Processor('reports')
export class AttendanceReportWorker extends WorkerHost implements OnApplicationShutdown {
  private readonly logger = new Logger(AttendanceReportWorker.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storageService: StorageService,
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
    if (job.data.type !== 'ATTENDANCE_SUMMARY') {
      return { downloadUrl: '', totalRows: 0, completedAt: new Date().toISOString() };
    }

    const { from, to, department, employee_id } = job.data.params;

    const conditions = [];
    if (from) conditions.push(gte(attendanceRecords.workDate, from));
    if (to) conditions.push(lte(attendanceRecords.workDate, to));
    if (employee_id) conditions.push(eq(attendanceRecords.userId, employee_id));
    // Department filter belongs in SQL: filtering in Node.js would load every
    // attendance record of the date range across the network first.
    if (department) conditions.push(eq(users.department, department));

    const rows = await this.db
      .select({
        record: attendanceRecords,
        user: users,
      })
      .from(attendanceRecords)
      .innerJoin(users, eq(attendanceRecords.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      // Deterministic report ordering: PostgreSQL otherwise returns rows in
      // physical block order, shuffling large multi-month reports arbitrarily.
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

      // Every dynamic user-supplied string is sanitized against formula
      // injection (CWE-1236) before it reaches an Excel cell. Placeholders are
      // applied *after* sanitization so a null value renders as a literal "-"
      // instead of being turned into `''-` by the apostrophe prefix.
      worksheet.addRow({
        name: sanitizeSpreadsheetCell(item.user.name),
        email: sanitizeSpreadsheetCell(item.user.email),
        department: item.user.department ? sanitizeSpreadsheetCell(item.user.department) : '-',
        workDate: item.record.workDate,
        // Cairo wall-clock times, not UTC ISO: staff read shift hours directly
        // instead of mentally subtracting 2–3h from a `Z` timestamp.
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
}
