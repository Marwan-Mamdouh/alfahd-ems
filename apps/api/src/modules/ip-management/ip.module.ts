import { Module } from '@nestjs/common';
import { IpController } from './ip.controller.js';
import { IpService } from './ip.service.js';

@Module({
  controllers: [IpController],
  providers: [IpService],
  exports: [IpService],
})
export class IpModule {}
