import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.interface.js';
import { CloudinaryStorageService } from './cloudinary.service.js';
import { FakeStorageService } from './fake-storage.service.js';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV');
        const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
        const apiKey = config.get<string>('CLOUDINARY_API_KEY');
        const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');

        if (nodeEnv === 'test') {
          return new FakeStorageService();
        }

        // Never fall back to in-memory storage in production: photos and
        // reports would silently vanish on container restart.
        if (nodeEnv === 'production' && (!cloudName || !apiKey || !apiSecret)) {
          throw new Error(
            'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required when NODE_ENV=production — refusing to start without a durable storage backend',
          );
        }

        if (!cloudName) {
          // Development-only convenience: visible fake storage when Cloudinary
          // is not configured locally.
          return new FakeStorageService();
        }
        return new CloudinaryStorageService(config);
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
