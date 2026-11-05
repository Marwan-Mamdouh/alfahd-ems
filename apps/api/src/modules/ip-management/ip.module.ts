import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IpController } from './ip.controller.js';
import { IpService } from './ip.service.js';
import { IpImportWorker } from './ip-import.worker.js';
import { JobsModule } from '../../jobs/jobs.module.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ip-imports',
    }),
    JobsModule,
  ],
  controllers: [IpController],
  providers: [IpService, IpImportWorker],
  exports: [IpService],
})
export class IpModule {}
