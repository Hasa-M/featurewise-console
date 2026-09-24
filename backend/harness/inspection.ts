import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import { parsePublicKey } from '../src/common/public-identifiers';
import { artifacts } from './environment';
export const json = (value: unknown) =>
  JSON.stringify(
    value,
    (_key, item: unknown) =>
      typeof item === 'bigint' ? item.toString() : item,
    2,
  );
export function artifactDirectory(prefix: string) {
  const directory = join(
    artifacts,
    `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`,
  );
  mkdirSync(directory, { recursive: true });
  return directory;
}
export function saveJson(path: string, value: unknown) {
  writeFileSync(path, json(value), { flag: 'wx' });
}
export async function inspectFeature(app: INestApplication, key: string) {
  return app.get(PrismaService).feature.findUniqueOrThrow({
    where: { publicNumber: parsePublicKey('feature', key) },
    include: {
      storageObjects: true,
      reviewReports: {
        include: {
          sources: true,
          attachments: true,
          findings: {
            include: {
              evidence: true,
              reviews: {
                orderBy: [{ createdAt: 'desc' }, { publicNumber: 'desc' }],
              },
            },
          },
        },
      },
    },
  });
}
