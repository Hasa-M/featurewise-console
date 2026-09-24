import type { PrismaClient } from '@prisma/client';
import { argon2id, hash } from 'argon2';

export async function seedOperator(
  prisma: PrismaClient,
  input: {
    username: string;
    organizationName: string;
    password?: string;
  },
) {
  const username = input.username.trim();
  const organizationName = input.organizationName.trim();
  if (!username || !organizationName)
    throw new Error('Seed username and organization name are required');
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent setup using the stable operator identity.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${username}))`;
    const existing = await tx.user.findUnique({ where: { username } });
    if (existing) return existing;
    if (!input.password?.trim())
      throw new Error('SEED_PASSWORD is required for initial setup');
    const passwordHash = await hash(input.password, { type: argon2id });
    return tx.user.create({
      data: {
        username,
        passwordHash,
        organization: { create: { name: organizationName } },
      },
    });
  });
}
