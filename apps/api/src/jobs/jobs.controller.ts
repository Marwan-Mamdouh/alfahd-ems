import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { JobsService } from './jobs.service.js';
import type { JobStatusResponseDto } from '@alfahd/types';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('jobs')
@ApiBearerAuth()
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

  @Get(':id/download')
  @ApiOperation({ summary: 'Download an authorized locally stored report' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOkResponse({
    description: 'Excel report bytes',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiNotFoundResponse({ description: 'Report not found or not accessible' })
  async download(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.jobsService.downloadLocalReport(id, req.user);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}
