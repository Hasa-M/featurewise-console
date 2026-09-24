import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual<typeof import('@aws-sdk/client-s3')>(
    '@aws-sdk/client-s3',
  ),
  S3Client: jest.fn(),
}));
jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

describe('private immutable S3 adapter (SDK substituted; no cloud)', () => {
  const send = jest.fn<
    Promise<unknown>,
    [GetObjectCommand | HeadObjectCommand | PutObjectCommand]
  >();
  const service = (bucket = 'private-test-bucket') =>
    new StorageService(
      new ConfigService({
        storage: {
          bucket,
          region: 'eu-south-1',
          keyPrefix: 'test',
          uploadTtlSeconds: 900,
          downloadTtlSeconds: 300,
        },
      }),
    );
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(S3Client)
      .mockImplementation(() => ({ send }) as unknown as S3Client);
  });
  it('generates distinct keys under feature ownership and rejects unsafe segments', () => {
    const adapter = service();
    const input = {
      organizationKey: 'ORG-1',
      projectKey: 'PRJ-2',
      featureKey: 'FEAT-3',
    };
    const one = adapter.createFeatureKeys(input);
    const two = adapter.createFeatureKeys(input);
    expect(one.originalKey).toContain(
      '/organizations/ORG-1/projects/PRJ-2/features/FEAT-3/objects/',
    );
    expect(one.originalKey).not.toBe(two.originalKey);
    expect(one.uploadKey).not.toBe(two.uploadKey);
    expect(() =>
      adapter.createFeatureKeys({ ...input, featureKey: '../other' }),
    ).toThrow();
  });
  it('writes with checksum and create-only semantics and retains the exact version', async () => {
    send.mockResolvedValue({
      VersionId: 'v1',
      ETag: '"etag"',
      ChecksumSHA256: 'checksum',
    });
    const result = await service().putObject({
      body: Buffer.from('bytes'),
      checksumSha256: 'checksum',
      contentType: 'text/plain',
      key: 'immutable/original',
    });
    expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    const command = send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      IfNoneMatch: '*',
      ChecksumSHA256: 'checksum',
      ContentLength: 5,
      Key: 'immutable/original',
    });
    expect(result).toEqual({
      versionId: 'v1',
      etag: 'etag',
      checksumSha256: 'checksum',
    });
  });
  it('reads and signs exact versions with private short-lived access', async () => {
    send.mockResolvedValue({
      Body: {
        transformToByteArray: () => Promise.resolve(Buffer.from('bytes')),
      },
    });
    expect(await service().getObjectBytes('original', 'v1')).toEqual(
      Buffer.from('bytes'),
    );
    expect(send.mock.calls[0][0].input).toMatchObject({
      Key: 'original',
      VersionId: 'v1',
    });
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://example.invalid/signed');
    await service().createAccessUrl({
      key: 'original',
      versionId: 'v1',
      contentDisposition: 'attachment',
    });
    const command = jest.mocked(getSignedUrl).mock
      .calls[0][1] as GetObjectCommand;
    expect(command.input).toMatchObject({
      VersionId: 'v1',
      ResponseCacheControl: 'no-store',
      ResponseContentDisposition: 'attachment',
    });
    expect(jest.mocked(getSignedUrl).mock.calls[0][2]).toEqual({
      expiresIn: 300,
    });
  });
  it('preserves head metadata and constrains signed uploads by size, type and checksum', async () => {
    send.mockResolvedValue({
      VersionId: 'upload-v1',
      ContentLength: 5,
      ContentType: 'text/plain',
      ChecksumSHA256: 'checksum',
    });
    expect(await service().headObject('staging')).toMatchObject({
      versionId: 'upload-v1',
      contentLength: 5,
      checksumSha256: 'checksum',
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    jest
      .mocked(createPresignedPost)
      .mockResolvedValue({ url: 'https://example.invalid', fields: {} });
    await service().createUpload({
      key: 'staging',
      contentType: 'text/plain',
      checksumSha256: 'checksum',
      maxBytes: 100,
    });
    expect(jest.mocked(createPresignedPost).mock.calls[0][1]).toMatchObject({
      Expires: 900,
      Conditions: expect.arrayContaining([
        ['content-length-range', 1, 100],
        { 'x-amz-checksum-sha256': 'checksum' },
      ]) as unknown,
    });
  });
  it('allows construction without S3 configuration and fails storage access before network calls', async () => {
    const adapter = service('');
    await expect(adapter.getObjectBytes('original', 'v1')).rejects.toThrow(
      'S3 storage is not configured',
    );
    expect(send).not.toHaveBeenCalled();
  });
});
