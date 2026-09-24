import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { storageConfig } from './config/storage.config';
import { DatabaseModule } from './database/database.module';
import { FeaturesModule } from './features/features.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      expandVariables: true,
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, storageConfig],
    }),
    AuthModule,
    DatabaseModule,
    FeaturesModule,
    HealthModule,
    WorkspaceModule,
    StorageModule,
  ],
})
export class AppModule {}
