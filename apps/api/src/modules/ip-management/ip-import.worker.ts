import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import type { IpImportResultDto } from '@alfahd/types';
import { IpService } from './ip.service.js';

export interface IpImportJobData {
  type: 'IP_CSV_IMPORT';
  csvContent: string;
  requestedBy: string;
}

@Processor('ip-imports')
@Injectable()
export class IpImportWorker extends WorkerHost implements OnApplicationShutdown {
  private readonly logger = new Logger(IpImportWorker.name);

  constructor(private readonly ipService: IpService) {
    super();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close(true);
    }
  }

  async process(job: Job<IpImportJobData>): Promise<IpImportResultDto> {
    if (job.data.type !== 'IP_CSV_IMPORT') {
      throw new Error(`Unsupported import job type: ${job.data.type}`);
    }

    this.logger.log(`Starting IP CSV import job ${job.id}`);
    const result = await this.ipService.processImportJob(
      job.data.csvContent,
      job.data.requestedBy,
      String(job.id),
    );
    this.logger.log(
      `Finished IP CSV import job ${job.id}: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors.length} errors`,
    );

    return result;
  }
}
