import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/configure-application';
import { setupOpenApi } from '../src/openapi';
import { StorageService } from '../src/storage/storage.service';
import { assertHarnessDatabase, assertHarnessMode } from './environment';

export async function createHarnessApplication() {
  assertHarnessDatabase(process.env.DATABASE_URL ?? '');
  assertHarnessMode();
  const storage = {}; // No storage method is available: cloud calls fail closed.
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();
  const app = module.createNestApplication({ logger: ['error', 'warn'] });
  configureApplication(app);
  const document = setupOpenApi(app);
  await app.init();
  return { app, document };
}
