import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { buildDatabaseUrl } from '../src/config/database-url';
import { seedOperator } from './seed-operator';

if (process.env.NODE_ENV !== 'test') loadEnv();
const prisma = new PrismaClient({
  adapter: new PrismaPg(buildDatabaseUrl(), { schema: 'public' }),
});
seedOperator(prisma, {
  username: process.env.SEED_USERNAME ?? 'dev.operator',
  organizationName: process.env.SEED_ORGANIZATION_NAME ?? 'Featurewise',
  password: process.env.SEED_PASSWORD,
})
  .then(() => console.log('Operator setup complete; existing data preserved.'))
  .catch(() => {
    console.error(
      'Operator setup failed. Check database and seed configuration.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
