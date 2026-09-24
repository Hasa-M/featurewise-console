import { NotFoundException } from '@nestjs/common';
import type { CurrentUserContext } from '../auth/current-user-context';
import type { PrismaService } from '../database/prisma.service';
import type { WorkspaceService } from '../workspace/workspace.service';
import { FeaturesService } from './features.service';
const currentUser: CurrentUserContext = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  organizationKey: 'ORG-12',
  userId: '00000000-0000-4000-8000-000000000003',
  userKey: 'USR-7',
  username: 'operator',
};

describe('feature boundaries', () => {
  it('constrains nested lookup to the resolved project and current organization', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const getProjectRecord = jest
      .fn()
      .mockResolvedValue({ id: 'second-project' });
    const service = new FeaturesService(
      { feature: { findFirst } } as unknown as PrismaService,
      { getProjectRecord } as unknown as WorkspaceService,
    );
    await expect(
      service.getProjectFeature(currentUser, 205, 7),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publicNumber: 7,
          deletedAt: null,
          projectId: 'second-project',
          project: { organizationId: currentUser.organizationId },
        },
      }),
    );
  });
  it('soft deletes after an organization-scoped lookup', async () => {
    const update = jest.fn();
    const findFirst = jest.fn().mockResolvedValue({ id: 'feature' });
    const service = new FeaturesService(
      { feature: { findFirst, update } } as unknown as PrismaService,
      {} as WorkspaceService,
    );
    await service.deleteFeature(currentUser, 7);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publicNumber: 7,
          projectId: undefined,
          project: { organizationId: currentUser.organizationId },
          deletedAt: null,
        },
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'feature' },
      data: { deletedAt: expect.any(Date) as unknown },
    });
  });
});
