import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import ExcelJS from 'exceljs';
import { Inject, Logger, OnApplicationShutdown } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../database/database.module.js';
import { attendanceRecords, users } from '../database/schema/index.js';
import { StorageService } from '../storage/storage.interface.js';

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

    const rows = await this.db
      .select({
        record: attendanceRecords,
        user: users,
      })
      .from(attendanceRecords)
      .innerJoin(users, eq(attendanceRecords.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const filteredRows = department ? rows.filter((r) => r.user.department === department) : rows;

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

    for (const item of filteredRows) {
      const checkInDate = new Date(item.record.checkInAt);
      const checkOutDate = item.record.checkOutAt ? new Date(item.record.checkOutAt) : null;
      let hoursWorked = '-';
      if (checkOutDate) {
        const ms = checkOutDate.getTime() - checkInDate.getTime();
        hoursWorked = (ms / (1000 * 60 * 60)).toFixed(2);
      }

      worksheet.addRow({
        name: item.user.name,
        email: item.user.email,
        department: item.user.department ?? '-',
        workDate: item.record.workDate,
        checkInAt: checkInDate.toISOString(),
        checkOutAt: checkOutDate ? checkOutDate.toISOString() : '-',
        hoursWorked,
        status: item.record.status,
        distance: item.record.checkInDistanceM,
        overrideReason: item.record.overrideReason ?? '-',
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
      totalRows: filteredRows.length,
      completedAt: new Date().toISOString(),
    };
  }
}
