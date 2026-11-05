import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Role, type JobStatusResponseDto } from '@alfahd/types';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';

/**
 * Generic failure text returned to clients. Raw `job.failedReason` is never
 * exposed: a worker crash can carry DB connection strings, table/column names,
 * or Cloudinary internals (information disclosure).
 */
export const GENERIC_JOB_ERROR = 'Report generation failed';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('reports') private readonly reportsQueue: Queue,
    @Optional() @InjectQueue('ip-imports') private readonly ipImportsQueue?: Queue,
  ) {}

  async getJobStatus(jobId: string, currentUser?: JwtUser): Promise<JobStatusResponseDto> {
    let job = await this.reportsQueue.getJob(jobId);
    if (!job && this.ipImportsQueue) {
      job = await this.ipImportsQueue.getJob(jobId);
    }
    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (currentUser && currentUser.role !== Role.ADMIN) {
      const requestedBy = job.data?.requestedBy;
      if (!requestedBy || requestedBy !== currentUser.userId) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }
    }

    const state = await job.getState();
    let status: JobStatusResponseDto['status'];

    switch (state) {
      case 'active':
        status = 'RUNNING';
        break;
      case 'completed':
        status = 'COMPLETED';
        break;
      case 'failed':
        status = 'FAILED';
        break;
      default:
        status = 'QUEUED';
        break;
    }

    const failedReason: string | null = job.failedReason ?? null;
    if (status === 'FAILED' && failedReason) {
      // Full detail stays server-side for operators.
      this.logger.error(`Job ${jobId} failed: ${failedReason}`);
    }

    const rv = job.returnvalue;

    const response: JobStatusResponseDto = {
      id: String(job.id),
      status,
      downloadUrl: rv?.downloadUrl ?? null,
      error: status === 'FAILED' ? GENERIC_JOB_ERROR : null,
    };

    if (rv && (rv.inserted !== undefined || rv.skipped !== undefined)) {
      response.inserted = rv.inserted ?? 0;
      response.skipped = rv.skipped ?? 0;
      response.errors = rv.errors ?? [];
      response.result = rv;
    }

    return response;
  }
}
