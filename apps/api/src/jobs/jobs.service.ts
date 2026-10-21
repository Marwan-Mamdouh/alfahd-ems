import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  constructor(@InjectQueue('reports') private readonly reportsQueue: Queue) {}

  async getJobStatus(jobId: string, currentUser?: JwtUser): Promise<JobStatusResponseDto> {
    const job = await this.reportsQueue.getJob(jobId);
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
      this.logger.error(`Report job ${jobId} failed: ${failedReason}`);
    }

    return {
      id: String(job.id),
      status,
      downloadUrl: job.returnvalue?.downloadUrl ?? null,
      error: status === 'FAILED' ? GENERIC_JOB_ERROR : null,
    };
  }
}
