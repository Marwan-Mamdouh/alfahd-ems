import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'reports',
      defaultJobOptions: {
        removeOnComplete: { age: 7 * 24 * 60 * 60 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    }),
    BullModule.registerQueue({
      name: 'ip-imports',
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
