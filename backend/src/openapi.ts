import type { INestApplication } from '@nestjs/common';
import { ApiProperty, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject, OperationObject } from '@nestjs/swagger';
import { LoginRequestDto } from './auth/dto/login-request.dto';
import { CreateFeatureDto } from './features/dto/create-feature.dto';
import { UpdateFeatureDto } from './features/dto/update-feature.dto';
import { UpdateOrganizationDto } from './workspace/dto/update-organization.dto';
import { UpdateProjectDto } from './workspace/dto/update-project.dto';
import { CreateProjectDto } from './workspace/dto/create-project.dto';

const str: SchemaObject = { type: 'string' };
const integer: SchemaObject = { type: 'integer' };
const date: SchemaObject = { type: 'string', format: 'date-time' };
const array = (items: SchemaObject): SchemaObject => ({ type: 'array', items });
const object = (
  properties: Record<string, SchemaObject>,
  required = Object.keys(properties),
): SchemaObject => ({ type: 'object', properties, required });
const key = (prefix: string): SchemaObject => ({
  type: 'string',
  pattern: `^${prefix}-[1-9][0-9]*$`,
  example: `${prefix}-1`,
});
const timestamps = { createdAt: date, updatedAt: date };

// Explicit metadata also works under ts-node: no build-only Swagger transformer is required.
function describeDto(
  target: { prototype: object },
  properties: Record<string, SchemaObject>,
  optional: string[] = [],
) {
  for (const [name, schema] of Object.entries(properties)) {
    ApiProperty({ ...schema, required: !optional.includes(name) } as Parameters<
      typeof ApiProperty
    >[0])(target.prototype, name);
  }
}

export function setupOpenApi(app: INestApplication) {
  describeDto(LoginRequestDto, {
    username: { ...str, maxLength: 100 },
    password: { ...str, maxLength: 1000, writeOnly: true },
  });
  const featureInput = { title: { ...str, maxLength: 180, pattern: '\\S' } };
  describeDto(CreateFeatureDto, featureInput);
  describeDto(UpdateFeatureDto, featureInput);
  for (const dto of [UpdateOrganizationDto, UpdateProjectDto, CreateProjectDto])
    describeDto(dto, { name: { ...str, maxLength: 120, pattern: '\\S' } });

  const config = new DocumentBuilder()
    .setTitle('Featurewise local API')
    .setVersion('1')
    .setDescription(
      'Implemented Console endpoints. Report ingestion, history, attachments and finding decisions have no HTTP endpoints yet. Use public keys, never domain UUIDs.',
    )
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const user = object({
    userKey: key('USR'),
    username: str,
    organizationKey: key('ORG'),
  });
  const feature = object({
    publicKey: key('FEAT'),
    projectKey: key('PRJ'),
    title: str,
    createdByKey: key('USR'),
    ...timestamps,
  });
  const organization = object({
    publicKey: key('ORG'),
    name: str,
    ...timestamps,
  });
  const project = object({
    publicKey: key('PRJ'),
    organizationKey: key('ORG'),
    name: str,
    ...timestamps,
  });
  const schemas: Record<string, SchemaObject> = {
    AuthController_login: object({
      accessToken: str,
      expiresInSeconds: integer,
      tokenType: { ...str, enum: ['Bearer'] },
      user,
    }),
    AuthController_getCurrentUser: user,
    FeaturesController_listFeatures: array(feature),
    ...Object.fromEntries(
      ['createFeature', 'getProjectFeature', 'getFeature', 'updateFeature'].map(
        (name) => [`FeaturesController_${name}`, feature],
      ),
    ),
    WorkspaceController_getOrganization: organization,
    WorkspaceController_updateOrganization: organization,
    WorkspaceController_listProjects: array(
      object({ ...project.properties, featureCount: integer }),
    ),
    WorkspaceController_getProject: project,
    WorkspaceController_updateProject: project,
    WorkspaceController_createProject: project,
    HealthController_getHealth: object({
      status: str,
      service: str,
      timestamp: date,
      environment: str,
      uptimeSeconds: integer,
    }),
    HealthController_getDatabaseHealth: object({
      status: str,
      database: str,
      timestamp: date,
      responseTimeMs: integer,
    }),
  };
  const prefixes: Record<string, string> = {
    featureKey: 'FEAT',
    projectKey: 'PRJ',
    organizationKey: 'ORG',
    storageObjectKey: 'OBJ',
  };
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'patch', 'put', 'delete'] as const) {
      const operation: OperationObject | undefined = item[method];
      if (!operation) continue;
      const publicRoute = path.startsWith('/health') || path === '/auth/login';
      operation.security = publicRoute ? [] : [{ bearer: [] }];
      operation.parameters ??= [];
      // Branded ParsedPublicNumber parameters are erased at runtime. Recover
      // their public route names rather than documenting internal UUIDs.
      for (const match of path.matchAll(/\{([^}]+)\}/g)) {
        const name = match[1];
        if (
          !operation.parameters.some(
            (parameter) =>
              'name' in parameter &&
              parameter.in === 'path' &&
              parameter.name === name,
          )
        ) {
          operation.parameters.push({
            name,
            in: 'path',
            required: true,
            schema: prefixes[name] ? key(prefixes[name]) : str,
          });
        }
      }
      for (const parameter of operation.parameters ?? []) {
        if (
          'in' in parameter &&
          parameter.in === 'path' &&
          prefixes[parameter.name]
        )
          parameter.schema = key(prefixes[parameter.name]);
      }
      operation.responses['400'] = {
        description: 'Invalid request or public key',
      };
      if (!publicRoute) {
        operation.responses['401'] = {
          description: 'Missing or invalid bearer token',
        };
        operation.responses['404'] = {
          description: 'Resource unavailable to the current operator',
        };
      }
      const schema = schemas[operation.operationId ?? ''];
      if (schema) {
        const status =
          Object.keys(operation.responses).find((code) => /^2/.test(code)) ??
          '200';
        operation.responses[status] = {
          description: 'Success',
          content: { 'application/json': { schema } },
        };
      }
    }
  }
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: false },
  });
  return document;
}
