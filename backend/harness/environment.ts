import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = resolve(__dirname, '../..');
export const artifacts = resolve(root, '.harness/console');
export const settingsFile = resolve(artifacts, 'environment.json');
export const modeFile = resolve(artifacts, 'database-mode.json');

export function assertHarnessMode(): void {
  if (existsSync(modeFile)) {
    const stored = JSON.parse(readFileSync(modeFile, 'utf8')) as {
      mode: string;
    };
    if (stored.mode !== process.env.HARNESS_MODE)
      throw new Error(
        'Harness database provider mode differs. Use harness:reset with the intended mode before switching.',
      );
  }
}

export interface HarnessSettings {
  identity: 'featurewise-console-harness-v1';
  databasePassword: string;
  operatorPassword: string;
  tokenSecret: string;
}

export function assertHarnessDatabase(value: string): void {
  const url = new URL(value);
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '5434' ||
    url.pathname !== '/featurewise_harness' ||
    url.username !== 'featurewise_harness' ||
    url.search !== ''
  ) {
    throw new Error(
      'Refusing non-harness database: expected dedicated loopback database on port 5434',
    );
  }
}

export function loadHarnessEnvironment(
  mode: 'deterministic' = 'deterministic',
) {
  mkdirSync(artifacts, { recursive: true });
  if (!existsSync(settingsFile)) {
    writeFileSync(
      settingsFile,
      JSON.stringify(
        {
          identity: 'featurewise-console-harness-v1',
          databasePassword: randomBytes(24).toString('hex'),
          operatorPassword: randomBytes(18).toString('base64url'),
          tokenSecret: randomBytes(32).toString('hex'),
        },
        null,
        2,
      ),
      { mode: 0o600, flag: 'wx' },
    );
  }
  const settings = JSON.parse(
    readFileSync(settingsFile, 'utf8'),
  ) as HarnessSettings;
  if (
    settings.identity !== 'featurewise-console-harness-v1' ||
    !settings.databasePassword ||
    !settings.operatorPassword ||
    !settings.tokenSecret
  ) {
    throw new Error('Invalid harness environment identity or credentials');
  }
  // Never inherit normal database or cloud settings in the isolated harness.
  for (const name of Object.keys(process.env)) {
    if (/^(DATABASE_|S3_|AUTH_|AWS_|SEED_|HARNESS_)/.test(name))
      delete process.env[name];
  }
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: '3100',
    SWAGGER_ENABLED: 'true',
    HARNESS_MODE: mode,
    HARNESS_DB_PASSWORD: settings.databasePassword,
    DATABASE_URL: `postgresql://featurewise_harness:${encodeURIComponent(settings.databasePassword)}@127.0.0.1:5434/featurewise_harness`,
    AUTH_TOKEN_SECRET: settings.tokenSecret,
    VITE_API_PROXY_TARGET: 'http://127.0.0.1:3100',
  });
  Object.assign(process.env, {
    S3_BUCKET: '',
    AWS_EC2_METADATA_DISABLED: 'true',
  });
  assertHarnessDatabase(process.env.DATABASE_URL!);
  return settings;
}
