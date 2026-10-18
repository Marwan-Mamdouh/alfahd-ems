import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Role, type JobStatusResponseDto } from '@alfahd/types';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';

@Injectable()
export class JobsService {
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

    return {
      id: String(job.id),
      status,
      downloadUrl: job.returnvalue?.downloadUrl ?? null,
      error: job.failedReason ?? null,
    };
  }
}
