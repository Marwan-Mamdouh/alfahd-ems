import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { StorageService, StorageUploadResult, StorageUrlOptions } from './storage.interface.js';

@Injectable()
export class CloudinaryStorageService extends StorageService {
  constructor(private readonly configService: ConfigService) {
    super();
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadFile(
    buffer: Buffer,
    folder: string,
    _mimeType: string,
  ): Promise<StorageUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            return reject(error ?? new Error('Cloudinary upload returned empty response'));
          }
          resolve({
            publicId: result.public_id,
            url: result.secure_url ?? result.url,
          });
        },
      );
      uploadStream.end(buffer);
    });
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  }

  getOptimizedUrl(publicId: string, options?: StorageUrlOptions): string {
    return cloudinary.url(publicId, {
      secure: true,
      fetch_format: options?.format ?? 'auto',
      quality: options?.quality ?? 'auto',
      width: options?.width,
      crop: options?.width ? 'scale' : undefined,
    });
  }
}
