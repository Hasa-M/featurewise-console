import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { argon2id, verify } from 'argon2';
import { assertHarnessDatabase } from '../harness/environment';
import { seedOperator } from '../prisma/seed-operator';

jest.setTimeout(60_000);
assertHarnessDatabase(process.env.DATABASE_URL!);
const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function fixture() {
  const user = await seedOperator(prisma, {
    username: `reports.${randomUUID()}`,
    organizationName: 'Report tests',
    password: 'test-password',
  });
  const project = await prisma.project.create({
    data: { organizationId: user.organizationId, name: 'Reports' },
  });
  const feature = await prisma.feature.create({
    data: { projectId: project.id, title: 'Saved views', createdById: user.id },
  });
  const report = await prisma.reviewReport.create({
    data: {
      featureId: feature.id,
      savedById: user.id,
      content: '# Review',
      formatVersion: 'test/1',
      producedAt: new Date(),
    },
  });
  const finding = await prisma.reviewFinding.create({
    data: {
      reportId: report.id,
      position: 0,
      title: 'Missing behavior',
      description: 'The empty state is unspecified.',
      whyItMatters: 'Users cannot recover.',
      category: 'completeness',
      severity: 'medium',
      suggestedResolutions: ['Define it.'],
    },
  });
  return { user, project, feature, report, finding };
}

describe('review persistence invariants', () => {
  it('seeds only an organization and operator, using Argon2id; reruns and concurrency preserve edits', async () => {
    const username = `seed.${randomUUID()}`;
    const input = {
      username,
      organizationName: 'Initial',
      password: 'initial-password',
    };
    const [one, two] = await Promise.all([
      seedOperator(prisma, input),
      seedOperator(prisma, input),
    ]);
    expect(one.id).toBe(two.id);
    expect(one.passwordHash).toContain('$argon2id$');
    expect(
      await verify(one.passwordHash, input.password, { type: argon2id }),
    ).toBe(true);
    expect(
      await prisma.project.count({
        where: { organizationId: one.organizationId },
      }),
    ).toBe(0);
    await prisma.organization.update({
      where: { id: one.organizationId },
      data: { name: 'User edit' },
    });
    await prisma.user.update({
      where: { id: one.id },
      data: { isActive: false },
    });
    const rerun = await seedOperator(prisma, {
      ...input,
      password: 'different',
    });
    expect(rerun.passwordHash).toBe(one.passwordHash);
    expect(rerun.isActive).toBe(false);
    expect(
      (
        await prisma.organization.findUniqueOrThrow({
          where: { id: one.organizationId },
        })
      ).name,
    ).toBe('User edit');
    expect(
      await prisma.reviewReport.count({ where: { savedById: one.id } }),
    ).toBe(0);
  });

  it('allows zero findings and stores production/save dates without execution configuration', async () => {
    const { feature, user } = await fixture();
    const report = await prisma.reviewReport.create({
      data: {
        featureId: feature.id,
        savedById: user.id,
        content: 'No findings',
        formatVersion: 'test/1',
        producedAt: new Date('2026-01-01'),
      },
      include: { findings: true },
    });
    expect(report.findings).toEqual([]);
    expect(report.savedAt.getTime()).toBeGreaterThan(
      report.producedAt.getTime(),
    );
    await expect(
      prisma.reviewReport.update({
        where: { id: report.id },
        data: { content: 'Changed' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.reviewReport.delete({ where: { id: report.id } }),
    ).rejects.toThrow();
  });

  it('keeps assertions immutable and decisions append-only, with deterministic latest disposition', async () => {
    const { finding, user } = await fixture();
    const createdAt = new Date();
    const first = await prisma.findingReview.create({
      data: {
        findingId: finding.id,
        decision: 'accepted',
        reason: 'Relevant',
        createdById: user.id,
        createdAt,
      },
    });
    const last = await prisma.findingReview.create({
      data: {
        findingId: finding.id,
        decision: 'resolved',
        reason: 'Implemented',
        createdById: user.id,
        createdAt,
      },
    });
    const latest = await prisma.findingReview.findFirst({
      where: { findingId: finding.id },
      orderBy: [{ createdAt: 'desc' }, { publicNumber: 'desc' }],
    });
    expect(latest?.id).toBe(last.id);
    await expect(
      prisma.findingReview.update({
        where: { id: first.id },
        data: { decision: 'dismissed' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.findingReview.delete({ where: { id: first.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.reviewFinding.update({
        where: { id: finding.id },
        data: { title: 'Changed' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.reviewFinding.delete({ where: { id: finding.id } }),
    ).rejects.toThrow();
    expect(
      await prisma.reviewFinding.findUnique({ where: { id: finding.id } }),
    ).toEqual(finding);
    const foreign = await fixture();
    await expect(
      prisma.findingReview.create({
        data: {
          findingId: finding.id,
          decision: 'deferred',
          createdById: foreign.user.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.reviewReport.create({
        data: {
          featureId: foreign.feature.id,
          savedById: user.id,
          content: 'Cross organization',
          formatVersion: 'test/1',
          producedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('binds evidence to its exact report and stores only references for MCP', async () => {
    const { report, finding } = await fixture();
    const source = await prisma.reportSource.create({
      data: {
        reportId: report.id,
        kind: 'local_code',
        title: 'Views',
        relativePath: 'src/views.ts',
        excerpt: 'return [];',
        revision: 'local revision',
      },
    });
    const evidence = await prisma.findingEvidence.create({
      data: {
        reportId: report.id,
        findingId: finding.id,
        sourceId: source.id,
        locator: 'L12',
      },
    });
    await expect(
      prisma.reportSource.update({
        where: { id: source.id },
        data: { excerpt: 'changed' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.findingEvidence.delete({ where: { id: evidence.id } }),
    ).rejects.toThrow();
    const other = await fixture();
    await expect(
      prisma.findingEvidence.create({
        data: {
          reportId: report.id,
          findingId: finding.id,
          sourceId: (
            await prisma.reportSource.create({
              data: {
                reportId: other.report.id,
                kind: 'reference',
                title: 'Other',
                reference: 'doc:other',
              },
            })
          ).id,
        },
      }),
    ).rejects.toThrow();
    const mcp = await prisma.reportSource.create({
      data: {
        reportId: report.id,
        kind: 'mcp',
        title: 'Issue',
        reference: 'mcp://issues/123',
      },
    });
    await expect(
      prisma.reportSource.create({
        data: {
          reportId: report.id,
          kind: 'mcp',
          title: 'Issue',
          reference: 'mcp://issues/123',
          excerpt: 'Copied content',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.findingEvidence.create({
        data: {
          reportId: report.id,
          findingId: finding.id,
          sourceId: mcp.id,
          excerpt: 'Copied content',
        },
      }),
    ).rejects.toThrow();
    for (const relativePath of [
      '/etc/passwd',
      '../secret',
      'src/../../secret',
      'C:/secret',
      'C:\\secret',
      '\\server\\secret',
      'src\\views.ts',
    ]) {
      await expect(
        prisma.reportSource.create({
          data: {
            reportId: report.id,
            kind: 'local_code',
            title: 'Invalid path',
            relativePath,
            excerpt: 'x',
          },
        }),
      ).rejects.toThrow();
    }
    expect(
      await prisma.findingReview.count({
        where: { findingId: other.finding.id },
      }),
    ).toBe(0);
  });

  it('retains original references, restricts attachments to the same feature, and never rewrites first use', async () => {
    const { feature, report, user } = await fixture();
    const token = randomUUID();
    const original = await prisma.storageObject.create({
      data: {
        featureId: feature.id,
        createdById: user.id,
        assetType: 'file',
        status: 'ready',
        uploadKey: `${token}/staging`,
        uploadVersionId: 'upload-v1',
        s3Key: `${token}/original`,
        s3VersionId: 'original-v1',
        mimeType: 'text/plain',
        sizeBytes: 5n,
        originalFilename: 'source.txt',
        checksumSha256: 'test-checksum',
        uploadExpiresAt: new Date(),
        confirmedAt: new Date(),
      },
    });
    const attachment = await prisma.reportAttachment.create({
      data: {
        reportId: report.id,
        featureId: feature.id,
        storageObjectId: original.id,
      },
    });
    const retained = await prisma.storageObject.findUniqueOrThrow({
      where: { id: original.id },
    });
    expect(retained.firstUsedAt).not.toBeNull();
    expect(retained.s3Key).toBe(original.s3Key);
    expect(retained.s3VersionId).toBe('original-v1');
    const other = await fixture();
    await expect(
      prisma.reportAttachment.create({
        data: {
          reportId: other.report.id,
          featureId: other.feature.id,
          storageObjectId: original.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.reportAttachment.create({
        data: {
          reportId: other.report.id,
          featureId: feature.id,
          storageObjectId: original.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.storageObject.update({
        where: { id: original.id },
        data: { s3VersionId: 'v2' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.storageObject.update({
        where: { id: original.id },
        data: { firstUsedAt: null },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.storageObject.delete({ where: { id: original.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.reportAttachment.delete({ where: { id: attachment.id } }),
    ).rejects.toThrow();
    expect(
      (
        await prisma.storageObject.findUniqueOrThrow({
          where: { id: original.id },
        })
      ).firstUsedAt,
    ).toEqual(retained.firstUsedAt);
    const source = await prisma.reportSource.create({
      data: {
        reportId: report.id,
        kind: 'attachment',
        title: 'Original',
        attachmentId: attachment.id,
      },
    });
    expect(source.attachmentId).toBe(attachment.id);
    await expect(
      prisma.reportSource.create({
        data: {
          reportId: other.report.id,
          kind: 'attachment',
          title: 'Cross report',
          attachmentId: attachment.id,
        },
      }),
    ).rejects.toThrow();
  });
});
