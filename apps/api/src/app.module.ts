import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { createPinoConfig } from './common/logger/logger.config.js';
import { envSchema } from './config/env.validation.js';
import { RedisModule, buildRedisConnectionOptions } from './redis/redis.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EmailModule } from './email/email.module.js';
import { UsersModule } from './users/users.module.js';
import { StorageModule } from './storage/storage.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { RepositoryModule } from './modules/repository/repository.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { WarehousesModule } from './modules/warehouses/warehouses.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createPinoConfig({
          NODE_ENV: configService.get<string>('NODE_ENV'),
        }),
    }),
    DatabaseModule,
    RepositoryModule,
    ProductsModule,
    WarehousesModule,
    InventoryModule,
    EmailModule,
    RedisModule,
    StorageModule,
    AuthModule,
    UsersModule,
    EmployeesModule,
    AttendanceModule,
    JobsModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: buildRedisConnectionOptions(configService),
      }),
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
