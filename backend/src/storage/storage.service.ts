import { randomUUID } from 'node:crypto';

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { StorageConfig } from '../config/storage.config';

export interface FeatureStorageKeys {
  readonly originalKey: string;
  readonly uploadKey: string;
}

export interface StorageObjectHead {
  readonly checksumSha256: string | null;
  readonly contentLength: number;
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly versionId: string | null;
}

export interface StoredObjectResult {
  readonly checksumSha256: string | null;
  readonly etag: string | null;
  readonly versionId: string | null;
}

@Injectable()
export class StorageService {
  private readonly config: StorageConfig;
  private readonly client: S3Client;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<StorageConfig>('storage');
    this.client = new S3Client({ region: this.config.region });
  }

  createFeatureKeys(input: {
    readonly featureKey: string;
    readonly organizationKey: string;
    readonly projectKey: string;
  }): FeatureStorageKeys {
    const token = randomUUID();
    const prefix = this.config.keyPrefix.replace(/^\/+|\/+$/g, '');
    const objectPrefix = [
      prefix,
      'organizations',
      this.safeSegment(input.organizationKey),
      'projects',
      this.safeSegment(input.projectKey),
      'features',
      this.safeSegment(input.featureKey),
      'objects',
      token,
    ].join('/');

    return {
      originalKey: `${objectPrefix}/original`,
      uploadKey: `${prefix}/staging/${randomUUID()}`,
    };
  }

  async createUpload(input: {
    readonly checksumSha256: string;
    readonly contentType: string;
    readonly key: string;
    readonly maxBytes: number;
  }) {
    this.requireBucket();
    const result = await createPresignedPost(this.client, {
      Bucket: this.config.bucket,
      Key: input.key,
      Expires: this.config.uploadTtlSeconds,
      Fields: {
        'Content-Type': input.contentType,
        'x-amz-checksum-algorithm': 'SHA256',
        'x-amz-checksum-sha256': input.checksumSha256,
      },
      Conditions: [
        ['content-length-range', 1, input.maxBytes],
        { 'Content-Type': input.contentType },
        { 'x-amz-checksum-algorithm': 'SHA256' },
        { 'x-amz-checksum-sha256': input.checksumSha256 },
      ],
    });

    return {
      ...result,
      expiresAt: new Date(Date.now() + this.config.uploadTtlSeconds * 1000),
    };
  }

  async headObject(key: string): Promise<StorageObjectHead> {
    this.requireBucket();
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.config.bucket,
        ChecksumMode: 'ENABLED',
        Key: key,
      }),
    );

    return {
      checksumSha256: response.ChecksumSHA256 ?? null,
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType ?? null,
      etag: response.ETag?.replaceAll('"', '') ?? null,
      versionId: response.VersionId ?? null,
    };
  }

  async getObjectBytes(key: string, versionId: string): Promise<Buffer> {
    this.requireBucket();
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        VersionId: versionId ?? undefined,
      }),
    );

    if (response.Body === undefined) {
      throw new ServiceUnavailableException('Stored file is unavailable');
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  async putObject(input: {
    readonly body: Buffer;
    readonly checksumSha256: string;
    readonly contentType: string;
    readonly key: string;
  }): Promise<StoredObjectResult> {
    this.requireBucket();
    const response = await this.client.send(
      new PutObjectCommand({
        Body: input.body,
        Bucket: this.config.bucket,
        ChecksumSHA256: input.checksumSha256,
        ContentLength: input.body.byteLength,
        ContentType: input.contentType,
        IfNoneMatch: '*',
        Key: input.key,
      }),
    );

    return {
      checksumSha256: response.ChecksumSHA256 ?? input.checksumSha256,
      etag: response.ETag?.replaceAll('"', '') ?? null,
      versionId: response.VersionId ?? null,
    };
  }

  async createAccessUrl(input: {
    readonly contentDisposition: string;
    readonly key: string;
    readonly versionId: string;
  }) {
    this.requireBucket();
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        ResponseCacheControl: 'no-store',
        ResponseContentDisposition: input.contentDisposition,
        VersionId: input.versionId ?? undefined,
      }),
      { expiresIn: this.config.downloadTtlSeconds },
    );

    return {
      expiresAt: new Date(Date.now() + this.config.downloadTtlSeconds * 1000),
      url,
    };
  }

  private requireBucket(): void {
    if (this.config.bucket === '') {
      throw new ServiceUnavailableException('S3 storage is not configured');
    }
  }

  private safeSegment(value: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error('Unsafe storage key segment');
    }

    return value;
  }
}
