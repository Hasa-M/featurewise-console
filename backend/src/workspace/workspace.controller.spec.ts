import type { CurrentUserContext } from '../auth/current-user-context';
import type { PublicNumber } from '../common/public-identifiers';
import { WorkspaceController } from './workspace.controller';
import type { WorkspaceService } from './workspace.service';
const currentUser: CurrentUserContext = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  organizationKey: 'ORG-12',
  userId: '00000000-0000-4000-8000-000000000003',
  userKey: 'USR-7',
  username: 'operator',
};

it('passes project creation through the authorized workspace boundary', async () => {
  const createProject = jest.fn().mockResolvedValue({ publicKey: 'PRJ-2' });
  const controller = new WorkspaceController({
    createProject,
  } as unknown as WorkspaceService);
  await expect(
    controller.createProject(
      currentUser,
      { value: 12 as PublicNumber },
      { name: 'Second' },
    ),
  ).resolves.toEqual({ publicKey: 'PRJ-2' });
  expect(createProject).toHaveBeenCalledWith(currentUser, 12, {
    name: 'Second',
  });
});
