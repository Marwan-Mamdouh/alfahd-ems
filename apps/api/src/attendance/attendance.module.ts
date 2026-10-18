import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceReportWorker } from './attendance.worker.js';
import { ClockService } from '../common/services/clock.service.js';

const workerProviders = process.env.NODE_ENV === 'test' ? [] : [AttendanceReportWorker];

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    BullModule.registerQueue({
      name: 'reports',
    }),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, ClockService, ...workerProviders],
  exports: [AttendanceService, ClockService],
})
export class AttendanceModule {}
