import type { PrismaClient } from '@prisma/client';
import { seedOperator } from '../prisma/seed-operator';
import { formatPublicKey } from '../src/common/public-identifiers';
import type { HarnessSettings } from './environment';

export async function seedFixtures(
  prisma: PrismaClient,
  settings: HarnessSettings,
) {
  const workspaces = [];
  for (const [username, name, count] of [
    ['harness.operator', 'Harness workspace', 2],
    ['harness.other', 'Other organization', 1],
    ['harness.empty', 'Empty organization', 0],
  ] as const) {
    const user = await seedOperator(prisma, {
      username,
      organizationName: name,
      password: settings.operatorPassword,
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    // Existing projects and user edits are retained. Only fill missing initial slots.
    const projects = await prisma.project.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'asc' },
    });
    while (projects.length < count) {
      projects.push(
        await prisma.project.create({
          data: {
            organizationId: organization.id,
            name: `Project ${projects.length + 1}`,
          },
        }),
      );
    }
    const containers = [];
    for (const project of projects) {
      let feature = await prisma.feature.findFirst({
        where: { projectId: project.id },
      });
      feature ??= await prisma.feature.create({
        data: {
          projectId: project.id,
          createdById: user.id,
          title: 'Saved views',
        },
      });
      if (
        !(await prisma.reviewReport.findFirst({
          where: { featureId: feature.id },
        }))
      ) {
        await prisma.reviewReport.create({
          data: {
            featureId: feature.id,
            savedById: user.id,
            content: 'Fixture review produced outside the backend.',
            formatVersion: 'fixture/1',
            producedAt: new Date('2026-09-01T12:00:00Z'),
            findings: {
              create: {
                position: 0,
                title: 'Missing empty-state behavior',
                description: 'Define what appears with no saved views.',
                whyItMatters: 'Users need a clear next action.',
                category: 'completeness',
                severity: 'medium',
                suggestedResolutions: ['Show a create action.'],
              },
            },
          },
        });
      }
      containers.push({
        projectKey: formatPublicKey('project', project.publicNumber),
        featureKey: formatPublicKey('feature', feature.publicNumber),
      });
    }
    workspaces.push({
      username,
      organizationKey: formatPublicKey(
        'organization',
        organization.publicNumber,
      ),
      projects: containers,
    });
  }
  return { workspaces };
}
