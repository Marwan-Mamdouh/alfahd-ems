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
        if (nodeEnv === 'test' || !cloudName) {
          return new FakeStorageService();
        }
        return new CloudinaryStorageService(config);
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
