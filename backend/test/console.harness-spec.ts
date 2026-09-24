import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createHarnessApplication } from '../harness/application';
import { PrismaService } from '../src/database/prisma.service';
import { seedOperator } from '../prisma/seed-operator';
import { formatPublicKey } from '../src/common/public-identifiers';

jest.setTimeout(60_000);
describe('Console HTTP with isolated PostgreSQL', () => {
  let harness: Awaited<ReturnType<typeof createHarnessApplication>>;
  let prisma: PrismaService;
  const password = 'http-test-password';
  const username = `http.${randomUUID()}`;
  let organizationKey: string;
  let token: string;
  let otherOrganization: string;
  let otherProject: string;
  let otherFeature: string;
  let first: string;
  let second: string;
  let feature: string;
  const api = () => request(harness.app.getHttpServer() as App);
  const keyOf = (body: unknown) => (body as { publicKey: string }).publicKey;
  beforeAll(async () => {
    harness = await createHarnessApplication();
    prisma = harness.app.get(PrismaService);
    const user = await seedOperator(prisma, {
      username,
      organizationName: 'HTTP tests',
      password,
    });
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    organizationKey = formatPublicKey('organization', org.publicNumber);
    const other = await seedOperator(prisma, {
      username: `${username}.other`,
      organizationName: 'Other',
      password,
    });
    const foreign = await prisma.organization.findUniqueOrThrow({
      where: { id: other.organizationId },
    });
    otherOrganization = formatPublicKey('organization', foreign.publicNumber);
    const foreignProject = await prisma.project.create({
      data: { name: 'Private', organizationId: other.organizationId },
    });
    otherProject = formatPublicKey('project', foreignProject.publicNumber);
    const foreignFeature = await prisma.feature.create({
      data: {
        title: 'Private feature',
        projectId: foreignProject.id,
        createdById: other.id,
      },
    });
    otherFeature = formatPublicKey('feature', foreignFeature.publicNumber);
  });
  afterAll(async () => {
    await harness.app.close();
  });
  async function login() {
    const result = await api()
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    const body = result.body as {
      accessToken: string;
      user: Record<string, string>;
    };
    expect(Object.keys(body.user).sort()).toEqual([
      'organizationKey',
      'userKey',
      'username',
    ]);
    token = body.accessToken;
    await api()
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200, body.user);
  }
  it('logs in with zero, one and multiple projects', async () => {
    await login();
    await api()
      .get(`/organizations/${organizationKey}/projects`)
      .auth(token, { type: 'bearer' })
      .expect(200, []);
    for (const name of ['First project', 'Second project']) {
      const result = await api()
        .post(`/organizations/${organizationKey}/projects`)
        .auth(token, { type: 'bearer' })
        .send({ name })
        .expect(201);
      if (!first) first = keyOf(result.body);
      else second = keyOf(result.body);
      expect(JSON.stringify(result.body)).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f-]{27,}/i,
      );
      await login();
    }
    const list = await api()
      .get(`/organizations/${organizationKey}/projects`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ publicKey: first, featureCount: 0 }),
        expect.objectContaining({ publicKey: second, featureCount: 0 }),
      ]),
    );
  });
  it('creates and renames a title-only feature in the second project', async () => {
    const result = await api()
      .post(`/projects/${second}/features`)
      .auth(token, { type: 'bearer' })
      .send({ title: '  Saved views  ' })
      .expect(201);
    feature = keyOf(result.body);
    expect(result.body).toMatchObject({
      title: 'Saved views',
      projectKey: second,
    });
    expect(Object.keys(result.body as object).sort()).toEqual([
      'createdAt',
      'createdByKey',
      'projectKey',
      'publicKey',
      'title',
      'updatedAt',
    ]);
    await api()
      .get(`/projects/${second}/features/${feature}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    await api()
      .get(`/projects/${first}/features/${feature}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    await api()
      .patch(`/features/${feature}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Renamed feature' })
      .expect(200);
    await api()
      .patch(`/projects/${second}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Renamed project' })
      .expect(200);
    await api()
      .patch(`/organizations/${organizationKey}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Renamed organization' })
      .expect(200);
    expect(
      (
        await api()
          .get(`/features/${feature}`)
          .auth(token, { type: 'bearer' })
          .expect(200)
      ).body,
    ).toMatchObject({ title: 'Renamed feature' });
  });
  it('enforces organization isolation and rejects internal UUIDs', async () => {
    for (const path of [
      `/organizations/${otherOrganization}`,
      `/organizations/${otherOrganization}/projects`,
      `/projects/${otherProject}`,
      `/projects/${otherProject}/features`,
      `/features/${otherFeature}`,
      `/projects/${otherProject}/features/${otherFeature}`,
    ]) {
      await api().get(path).auth(token, { type: 'bearer' }).expect(404);
    }
    await api()
      .post(`/organizations/${otherOrganization}/projects`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Unauthorized' })
      .expect(404);
    await api()
      .patch(`/projects/${otherProject}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Unauthorized' })
      .expect(404);
    await api()
      .post(`/projects/${otherProject}/features`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Unauthorized' })
      .expect(404);
    await api()
      .patch(`/features/${otherFeature}`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Unauthorized' })
      .expect(404);
    await api()
      .delete(`/features/${otherFeature}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    await api()
      .get(`/projects/${randomUUID()}`)
      .auth(token, { type: 'bearer' })
      .expect(400);
    await api().get(`/projects/${second}`).expect(401);
  });
  it('validates inputs and exposes no deferred or removed endpoints', async () => {
    for (const title of ['', '   ', 'x'.repeat(181), null]) {
      await api()
        .post(`/projects/${second}/features`)
        .auth(token, { type: 'bearer' })
        .send({ title })
        .expect(400);
    }
    await api()
      .post(`/projects/${second}/features`)
      .auth(token, { type: 'bearer' })
      .send({ title: 'Valid', specificationContent: 'Removed field' })
      .expect(400);
    await api()
      .post(`/organizations/${organizationKey}/projects`)
      .auth(token, { type: 'bearer' })
      .send({ name: ' ' })
      .expect(400);
    expect(Object.keys(harness.document.paths).join(' ')).not.toMatch(
      /context|repository|github|analysis|report|finding|storage/i,
    );
    for (const path of [
      `/features/${feature}/context`,
      `/projects/${second}/repository`,
      `/features/${feature}/analyses`,
      `/features/${feature}/reports`,
    ]) {
      await api().get(path).auth(token, { type: 'bearer' }).expect(404);
    }
  });
  it('soft deletes a feature without removing its history', async () => {
    const record = await prisma.feature.findUniqueOrThrow({
      where: { publicNumber: Number(feature.split('-')[1]) },
    });
    const report = await prisma.reviewReport.create({
      data: {
        featureId: record.id,
        savedById: record.createdById,
        content: 'Retained',
        formatVersion: 'test/1',
        producedAt: new Date(),
      },
    });
    await api()
      .delete(`/features/${feature}`)
      .auth(token, { type: 'bearer' })
      .expect(204);
    await api()
      .get(`/features/${feature}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    expect(
      (await prisma.feature.findUniqueOrThrow({ where: { id: record.id } }))
        .deletedAt,
    ).not.toBeNull();
    expect(
      await prisma.reviewReport.findUnique({ where: { id: report.id } }),
    ).not.toBeNull();
  });
});
