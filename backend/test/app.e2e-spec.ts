import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { argon2id, hash } from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/configure-application';
import { PrismaService } from '../src/database/prisma.service';

describe('authentication HTTP without S3', () => {
  let app: INestApplication<App>;
  const findUnique = jest.fn();
  const operator = {
    id: 'internal',
    publicNumber: 7,
    username: 'operator',
    organizationId: 'org',
    isActive: true,
    passwordHash: '',
    organization: { publicNumber: 1 },
  };
  beforeAll(async () => {
    process.env.AUTH_TOKEN_SECRET =
      'test-only-token-secret-at-least-32-characters';
    process.env.S3_BUCKET = '';
    process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
    operator.passwordHash = await hash('test-password', { type: argon2id });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => findUnique.mockResolvedValue(operator));
  it('logs in with an organization-only identity and restores its session', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'operator', password: 'test-password' })
      .expect(200);
    const body = response.body as { accessToken: string; user: unknown };
    expect(body.user).toEqual({
      userKey: 'USR-7',
      username: 'operator',
      organizationKey: 'ORG-1',
    });
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth(body.accessToken, { type: 'bearer' })
      .expect(200, body.user);
  });
  it('rejects wrong passwords and inactive users', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'operator', password: 'wrong' })
      .expect(401);
    findUnique.mockResolvedValue({ ...operator, isActive: false });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'operator', password: 'test-password' })
      .expect(401);
  });
  it('protects container routes and rejects invalid sessions', async () => {
    await request(app.getHttpServer()).get('/projects/PRJ-1').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
  });
});
