export interface StorageUploadResult {
  publicId: string;
  url: string;
}

export interface StorageUrlOptions {
  width?: number;
  quality?: string;
  format?: string;
}

export abstract class StorageService {
  abstract uploadFile(
    buffer: Buffer,
    folder: string,
    mimeType: string,
  ): Promise<StorageUploadResult>;

  abstract deleteFile(publicId: string): Promise<void>;

  abstract getOptimizedUrl(publicId: string, options?: StorageUrlOptions): string;
}

export const STORAGE_SERVICE = StorageService;
