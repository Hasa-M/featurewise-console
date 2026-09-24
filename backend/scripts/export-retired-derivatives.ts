import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/** SQL-only inventory. No storage adapter, credentials, or cloud calls. */
export const inventorySql = `SELECT COALESCE(jsonb_agg(
  to_jsonb(s) || jsonb_build_object('feature_id', c.feature_id)
  ORDER BY s.storage_object_id), '[]'::jsonb) AS inventory
  FROM storage_object s JOIN context_artifact c USING (context_artifact_id)
  WHERE s.prepared_s3_key IS NOT NULL OR s.prepared_s3_version_id IS NOT NULL
    OR s.prepared_mime_type IS NOT NULL OR s.prepared_size_bytes IS NOT NULL
    OR s.prepared_checksum_sha256 IS NOT NULL OR s.preparation_version IS NOT NULL`;

export async function exportRetiredDerivatives(
  prisma: PrismaClient,
  directory: string,
) {
  mkdirSync(directory, { recursive: true });
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('LOCK TABLE storage_object IN SHARE MODE');
    const [row] =
      await tx.$queryRawUnsafe<{ inventory: unknown[] }[]>(inventorySql);
    const content = JSON.stringify(
      { version: 1, inventory: row.inventory },
      null,
      2,
    );
    const sha256 = createHash('sha256').update(content).digest('hex');
    const path = resolve(
      directory,
      `retired-derivatives-${Date.now()}-${sha256.slice(0, 12)}.json`,
    );
    writeFileSync(path, content, { flag: 'wx', mode: 0o600 });
    if (
      createHash('sha256').update(readFileSync(path)).digest('hex') !== sha256
    ) {
      throw new Error('Inventory read-back verification failed');
    }
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS _console_refocus_inventory (
      singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
      inventory JSONB NOT NULL, sha256 TEXT NOT NULL, local_path TEXT NOT NULL
    )`);
    await tx.$executeRaw`INSERT INTO _console_refocus_inventory (singleton, inventory, sha256, local_path)
      VALUES (TRUE, ${JSON.stringify(row.inventory)}::jsonb, ${sha256}, ${path})
      ON CONFLICT (singleton) DO UPDATE SET inventory = EXCLUDED.inventory,
      sha256 = EXCLUDED.sha256, local_path = EXCLUDED.local_path`;
    return { path, sha256, count: row.inventory.length };
  });
}

if (require.main === module) {
  // Deliberately do not load .env or infer a target database.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL explicitly for inventory export');
  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  exportRetiredDerivatives(
    prisma,
    resolve(__dirname, '../../.harness/retired-derivatives'),
  )
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error('Inventory export failed; migration must not proceed.');
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
