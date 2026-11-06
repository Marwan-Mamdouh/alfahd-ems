import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StorageService } from './storage.interface.js';

export const LOCAL_REPORT_PREFIX = 'local-report:';
export const REPORT_STORAGE = Symbol('REPORT_STORAGE');

@Injectable()
export class LocalReportStorageService extends StorageService {
  constructor(private readonly config: ConfigService) {
    super();
  }

  private path(key: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.xlsx$/i.test(key)) {
      throw new NotFoundException('Report not found');
    }
    return join(this.config.getOrThrow<string>('REPORT_STORAGE_DIR'), key);
  }

  async uploadFile(buffer: Buffer, folder: string, mimeType: string) {
    if (
      folder !== 'reports' ||
      mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      throw new Error('Local report storage only accepts Excel reports');
    }
    const key = `${randomUUID()}.xlsx`;
    await mkdir(this.config.getOrThrow<string>('REPORT_STORAGE_DIR'), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(this.path(key), buffer, { flag: 'wx', mode: 0o600 });
    return { publicId: key, url: `${LOCAL_REPORT_PREFIX}${key}` };
  }

  async readReport(key: string): Promise<Buffer> {
    try {
      return await readFile(this.path(key));
    } catch {
      throw new NotFoundException('Report not found');
    }
  }
  async deleteFile(publicId: string): Promise<void> {
    await unlink(this.path(publicId));
  }
  getOptimizedUrl(): string {
    throw new Error('Local reports require authenticated job access');
  }
}
