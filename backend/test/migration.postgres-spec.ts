import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { artifacts, assertHarnessDatabase } from '../harness/environment';
import { exportRetiredDerivatives } from '../scripts/export-retired-derivatives';

jest.setTimeout(120_000);
assertHarnessDatabase(process.env.DATABASE_URL!);
const database = `console_migration_${Date.now()}`;
if (!/^console_migration_[0-9]+$/.test(database))
  throw new Error('Invalid test database');
const psql = (sql: string, db = database) =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'featurewise-console-harness-postgres-1',
      'psql',
      '-U',
      'featurewise_harness',
      '-d',
      db,
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    {
      input: sql,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

it('migrates old data only after verified export, preserving account and exact original references', async () => {
  psql(`CREATE DATABASE ${database}`, 'featurewise_harness');
  const migrations = resolve(__dirname, '../prisma/migrations');
  const names = readdirSync(migrations)
    .filter((name) => /^\d/.test(name))
    .sort();
  for (const name of names.slice(0, -1))
    psql(readFileSync(resolve(migrations, name, 'migration.sql'), 'utf8'));
  psql(`
    INSERT INTO organization (organization_id, name, updated_at) VALUES ('11111111-1111-4111-8111-111111111111', 'Preserve me', now());
    INSERT INTO "user" (user_id, organization_id, username, password_hash, updated_at) VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'preserved.operator', 'unchanged-hash', now());
    INSERT INTO project (project_id, organization_id, name, updated_at) VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Original project', now());
    INSERT INTO feature (feature_id, project_id, title, created_by, updated_at) VALUES ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'Original feature', '22222222-2222-4222-8222-222222222222', now());
    INSERT INTO context_artifact (context_artifact_id, feature_id, updated_at) VALUES ('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', now());
    INSERT INTO storage_object (context_artifact_id, created_by, status, upload_key, upload_version_id, s3_key, s3_version_id, asset_type, mime_type, size_bytes, original_filename, checksum_sha256, prepared_s3_key, prepared_s3_version_id, prepared_mime_type, prepared_size_bytes, prepared_checksum_sha256, preparation_version, upload_expires_at, confirmed_at, ready_at, first_used_at, updated_at)
    VALUES ('55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', 'ready', 'legacy/staging', 'upload-version', 'legacy/original', 'original-version', 'file', 'text/plain', 5, 'source.txt', 'original-checksum', 'legacy/prepared', 'prepared-version', 'text/plain', 5, 'prepared-checksum', 'prepare/1', now(), now(), now(), now(), now());
  `);
  const migration = readFileSync(
    resolve(migrations, names.at(-1)!, 'migration.sql'),
    'utf8',
  );
  expect(() => psql(migration)).toThrow();
  expect(psql('SELECT prepared_s3_key FROM storage_object').trim()).toBe(
    'legacy/prepared',
  );
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg(url.toString()) });
  try {
    const inventory = await exportRetiredDerivatives(
      prisma,
      resolve(artifacts, 'migration-inventories'),
    );
    expect(inventory.count).toBe(1);
    expect(JSON.parse(readFileSync(inventory.path, 'utf8'))).toMatchObject({
      inventory: [
        {
          prepared_s3_key: 'legacy/prepared',
          prepared_s3_version_id: 'prepared-version',
        },
      ],
    });
    psql(
      "UPDATE storage_object SET prepared_s3_key = NULL, prepared_s3_version_id = 'new-prepared-version', confirmed_at = NULL",
    );
    expect(() => psql(migration)).toThrow();
    await exportRetiredDerivatives(
      prisma,
      resolve(artifacts, 'migration-inventories'),
    );
    psql(migration);
    expect(
      await prisma.user.findUnique({
        where: { username: 'preserved.operator' },
      }),
    ).toMatchObject({ passwordHash: 'unchanged-hash' });
    const original = await prisma.storageObject.findFirstOrThrow();
    expect(original).toMatchObject({
      featureId: '44444444-4444-4444-8444-444444444444',
      s3Key: 'legacy/original',
      s3VersionId: 'original-version',
      uploadVersionId: 'upload-version',
      checksumSha256: 'original-checksum',
      status: 'ready',
      confirmedAt: null,
    });
    expect(original.firstUsedAt).not.toBeNull();
    await prisma.project.create({
      data: {
        organizationId: '11111111-1111-4111-8111-111111111111',
        name: 'Second project',
      },
    });
    expect(await prisma.project.count()).toBe(2);
    expect(await prisma.reviewReport.count()).toBe(0);
    expect(
      psql(
        "SELECT count(*) FROM information_schema.tables WHERE table_name IN ('analysis_run','context_artifact','project_context','llm_call_log','project_repository_connection')",
      ).trim(),
    ).toBe('0');
  } finally {
    await prisma.$disconnect();
  }
});
