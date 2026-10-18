import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { JobsService } from './jobs.service.js';
import type { JobStatusResponseDto } from '@alfahd/types';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get(':id')
  getJobStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
  ): Promise<JobStatusResponseDto> {
    return this.jobsService.getJobStatus(id, req.user);
  }
}
