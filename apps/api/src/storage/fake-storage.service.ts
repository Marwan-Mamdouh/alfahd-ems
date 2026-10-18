import { Injectable } from '@nestjs/common';
import { StorageService, StorageUploadResult, StorageUrlOptions } from './storage.interface.js';

@Injectable()
export class FakeStorageService extends StorageService {
  private readonly files = new Map<string, { buffer: Buffer; folder: string; mimeType: string }>();
  public uploadedFilesCount = 0;
  public deletedFilesCount = 0;

  async uploadFile(buffer: Buffer, folder: string, mimeType: string): Promise<StorageUploadResult> {
    const id = `fake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const publicId = `${folder}/${id}`;
    this.files.set(publicId, { buffer, folder, mimeType });
    this.uploadedFilesCount++;
    return {
      publicId,
      url: `https://fake-storage.local/${publicId}`,
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    this.files.delete(publicId);
    this.deletedFilesCount++;
  }

  getOptimizedUrl(publicId: string, options?: StorageUrlOptions): string {
    const params = new URLSearchParams();
    if (options?.width) params.set('w', options.width.toString());
    if (options?.quality) params.set('q', options.quality);
    const qs = params.toString();
    return `https://fake-storage.local/${publicId}${qs ? `?${qs}` : ''}`;
  }

  hasFile(publicId: string): boolean {
    return this.files.has(publicId);
  }

  getFile(publicId: string): { buffer: Buffer; folder: string; mimeType: string } | undefined {
    return this.files.get(publicId);
  }

  clear(): void {
    this.files.clear();
    this.uploadedFilesCount = 0;
    this.deletedFilesCount = 0;
  }
}
