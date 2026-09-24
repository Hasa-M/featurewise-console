import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  readonly bucket: string;
  readonly downloadTtlSeconds: number;
  readonly keyPrefix: string;
  readonly region: string;
  readonly uploadTtlSeconds: number;
}
function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
export const storageConfig = registerAs(
  'storage',
  (): StorageConfig => ({
    bucket: process.env.S3_BUCKET?.trim() ?? '',
    downloadTtlSeconds: positiveInteger(
      process.env.S3_DOWNLOAD_TTL_SECONDS,
      300,
    ),
    keyPrefix: process.env.S3_KEY_PREFIX?.trim() || 'dev',
    region: process.env.AWS_REGION?.trim() || 'eu-south-1',
    uploadTtlSeconds: positiveInteger(process.env.S3_UPLOAD_TTL_SECONDS, 900),
  }),
);
