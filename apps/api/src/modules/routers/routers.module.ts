import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RoutersController } from './routers.controller.js';
import { RoutersService } from './routers.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'reports',
    }),
  ],
  controllers: [RoutersController],
  providers: [RoutersService],
  exports: [RoutersService],
})
export class RoutersModule {}
