import { NotFoundException } from '@nestjs/common';
import type { CurrentUserContext } from '../auth/current-user-context';
import type { PrismaService } from '../database/prisma.service';
import { WorkspaceService } from './workspace.service';
const currentUser: CurrentUserContext = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  organizationKey: 'ORG-12',
  userId: '00000000-0000-4000-8000-000000000003',
  userKey: 'USR-7',
  username: 'operator',
};

describe('workspace authorization', () => {
  it('resolves any project in the organization without a project in the session', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'internal',
      publicNumber: 205,
      name: 'Second project',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new WorkspaceService({
      project: { findFirst },
    } as unknown as PrismaService);
    const result = await service.getProject(currentUser, 205);
    expect(findFirst).toHaveBeenCalledWith({
      where: { organizationId: currentUser.organizationId, publicNumber: 205 },
    });
    expect(result.publicKey).toBe('PRJ-205');
    expect(result).not.toHaveProperty('id');
  });
  it('rejects an organization before creating a project', async () => {
    const create = jest.fn();
    const service = new WorkspaceService({
      organization: { findFirst: jest.fn().mockResolvedValue(null) },
      project: { create },
    } as unknown as PrismaService);
    await expect(
      service.createProject(currentUser, 99, { name: 'Other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });
});
