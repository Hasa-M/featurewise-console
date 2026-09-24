import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { createServer, createConnection } from 'node:net';
import {
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  artifacts,
  assertHarnessDatabase,
  assertHarnessMode,
  modeFile,
  root,
  type HarnessSettings,
} from './environment';
import { createHarnessApplication } from './application';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from '../src/database/prisma.service';
import { seedFixtures } from './fixtures';
import {
  artifactDirectory,
  inspectFeature,
  json,
  saveJson,
} from './inspection';
import { exportRetiredDerivatives } from '../scripts/export-retired-derivatives';

const backend = join(root, 'backend');
const cli = join(backend, 'harness/entry.ts');
const tsNode = join(backend, 'node_modules/ts-node/register');
const nodeArgs = ['-r', tsNode];
const prismaCli = join(backend, 'node_modules/prisma/build/index.js');
const controlUrl = 'http://127.0.0.1:3199';
const modeArgs = () => [];
const compose = ['compose', '-f', join(backend, 'harness/compose.yml')];
const pause = (ms: number) =>
  new Promise((resolvePause) => setTimeout(resolvePause, ms));

async function listening(port: number): Promise<boolean> {
  return new Promise((resolveListening) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (connected: boolean) => {
      socket.destroy();
      resolveListening(connected);
    };
    socket.setTimeout(1000, () => finish(false));
    socket.once('error', () => finish(false));
    socket.once('connect', () => finish(true));
  });
}

async function run(command: string, args: string[], cwd = backend) {
  await new Promise<void>((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolveRun()
        : reject(
            new Error(`${command.split(/[\\/]/).at(-1)} exited with ${code}`),
          ),
    );
  });
}
async function portFree(port: number) {
  await new Promise<void>((resolvePort, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(
        new Error(
          `Port ${port} is occupied; stop its owner or the existing harness`,
        ),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(() => resolvePort()));
  });
}
async function waitFor(url: string, milliseconds = 45000) {
  const until = Date.now() + milliseconds;
  while (Date.now() < until) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      /* Service is starting. */
    }
    await pause(500);
  }
  throw new Error(
    `Service did not become ready: ${url}; inspect .harness logs`,
  );
}
async function control(settings: HarnessSettings, method = 'GET') {
  return fetch(controlUrl, {
    method,
    headers: { Authorization: `Bearer ${settings.tokenSecret}` },
    signal: AbortSignal.timeout(3000),
  });
}
async function withApplication<T>(
  action: (
    app: Awaited<ReturnType<typeof createHarnessApplication>>['app'],
  ) => Promise<T>,
) {
  const { app } = await createHarnessApplication();
  try {
    return await action(app);
  } finally {
    await app.close();
  }
}
function option(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error(`Required argument: ${name}`);
  return args[index + 1];
}
async function supervisor(settings: HarnessSettings) {
  const children: ChildProcess[] = [];
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) child.kill();
    server.close();
    setTimeout(() => process.exit(0), 1000).unref();
  };
  const server = httpServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${settings.tokenSecret}`) {
      res.writeHead(403).end();
      return;
    }
    if (req.method === 'POST') {
      res.end('Stopping owned processes');
      shutdown();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(
      json({
        identity: 'featurewise-console-harness-v1',
        providerMode: process.env.HARNESS_MODE,
        processes: children.map((child) => child.pid),
      }),
    );
  });
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(3199, '127.0.0.1', ok);
  });
  const launch = (name: string, args: string[], cwd: string) => {
    const log = openSync(join(artifacts, `${name}.log`), 'a');
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', log, log],
      windowsHide: true,
    });
    children.push(child);
    child.on('error', shutdown);
    child.on('exit', () => {
      if (!shuttingDown) shutdown();
    });
  };
  launch('backend', [...nodeArgs, cli, 'serve', ...modeArgs()], backend);
  launch(
    'frontend',
    [
      join(root, 'frontend/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      '5174',
      '--strictPort',
    ],
    join(root, 'frontend'),
  );
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export async function execute(
  command: string,
  args: string[],
  settings: HarnessSettings,
): Promise<void> {
  assertHarnessDatabase(process.env.DATABASE_URL!);
  if (command === 'supervise') return supervisor(settings);
  if (command === 'serve') {
    const { app } = await createHarnessApplication();
    app.enableShutdownHooks();
    await app.listen(3100, '127.0.0.1');
    return;
  }
  if (command === 'doctor') {
    console.log(
      `Node ${process.version}; harness environment identity verified`,
    );
    await run('docker', ['info', '--format', '{{.ServerVersion}}']);
    for (const file of [
      prismaCli,
      join(root, 'frontend/node_modules/vite/bin/vite.js'),
    ])
      if (!existsSync(file))
        throw new Error('Install backend and frontend dependencies first');
    if (await listening(5434)) {
      await run(process.execPath, [prismaCli, 'migrate', 'status']);
      console.log('Harness database is reachable; migration status checked.');
    } else
      console.log(
        'Harness database is not started; harness:up will initialize it.',
      );
    if (await listening(3199)) {
      const response = await control(settings);
      if (!response.ok) throw new Error('Supervisor identity mismatch');
      await waitFor('http://127.0.0.1:3100/health/database', 3000);
      await waitFor('http://127.0.0.1:5174', 3000);
      console.log('Harness API/database health and frontend are ready.');
    }
    console.log(
      'Chrome: verify the CLI connection with Chrome DevTools MCP. The harness never calls cloud services.',
    );
    return;
  }
  if (command === 'up') {
    assertHarnessMode();
    await portFree(3199);
    await portFree(3100);
    await portFree(5174);
    await run('docker', [...compose, 'up', '-d', '--wait']);
    // Preflight on the dedicated DB only, before any old derivative columns disappear.
    const prisma = new PrismaClient({
      adapter: new PrismaPg(process.env.DATABASE_URL!),
    });
    try {
      const [state] = await prisma.$queryRaw<
        { present: boolean }[]
      >`SELECT to_regclass('context_artifact') IS NOT NULL AS present`;
      if (state.present)
        console.log(
          await exportRetiredDerivatives(
            prisma,
            artifactDirectory('retired-derivatives'),
          ),
        );
    } finally {
      await prisma.$disconnect();
    }
    await run(process.execPath, [prismaCli, 'migrate', 'deploy']);
    writeFileSync(modeFile, json({ mode: process.env.HARNESS_MODE }));
    await execute('seed', [], settings);
    const log = openSync(join(artifacts, 'supervisor.log'), 'a');
    const child = spawn(
      process.execPath,
      [...nodeArgs, cli, 'supervise', ...modeArgs()],
      {
        cwd: backend,
        env: process.env,
        detached: true,
        stdio: ['ignore', log, log],
        windowsHide: true,
      },
    );
    child.unref();
    try {
      await waitFor('http://127.0.0.1:3100/health/database');
      await waitFor('http://127.0.0.1:5174');
    } catch (error) {
      await control(settings, 'POST').catch(() => undefined);
      throw error;
    }
    const session = {
      identity: 'featurewise-console-harness-v1',
      providerMode: process.env.HARNESS_MODE,
      api: 'http://127.0.0.1:3100',
      frontend: 'http://127.0.0.1:5174',
      swagger: 'http://127.0.0.1:3100/docs',
      openapi: 'http://127.0.0.1:3100/docs-json',
      studio: 'http://127.0.0.1:5556',
      fixtures: JSON.parse(
        readFileSync(join(artifacts, 'fixtures.json'), 'utf8'),
      ) as unknown,
      artifacts,
      logs: ['backend.log', 'frontend.log', 'supervisor.log'],
    };
    writeFileSync(join(artifacts, 'session.json'), json(session));
    console.log(json(session));
    return;
  }
  if (command === 'status') {
    try {
      console.log(await (await control(settings)).text());
    } catch {
      console.log('Harness application is not running');
    }
    await run('docker', [...compose, 'ps']);
    return;
  }
  if (command === 'down') {
    if (await listening(3199)) {
      const response = await control(settings, 'POST');
      if (!response.ok) throw new Error('Supervisor identity mismatch');
    }
    await pause(1500);
    await run('docker', [...compose, 'stop']);
    return;
  }
  if (command === 'reset') {
    await execute('down', [], settings);
    // The fixed Compose project/volume is the deletion boundary; no path enumeration or SQL against arbitrary URLs.
    await run('docker', [...compose, 'down', '--volumes']);
    if (existsSync(modeFile)) unlinkSync(modeFile);
    await execute('up', [], settings);
    return;
  }
  if (command === 'studio') {
    await portFree(5556);
    await run(process.execPath, [
      prismaCli,
      'studio',
      '--port',
      '5556',
      '--browser',
      'none',
    ]);
    return;
  }
  if (command === 'seed') {
    const fixtures = await withApplication((app) =>
      seedFixtures(app.get(PrismaService), settings),
    );
    writeFileSync(join(artifacts, 'fixtures.json'), json(fixtures));
    console.log(
      `Fixtures ready. Login: harness.operator; password is in .harness/console/environment.json (not printed).`,
    );
    return;
  }
  if (command === 'inspect') {
    await withApplication(async (app) => {
      const directory = artifactDirectory('inspection');
      saveJson(
        join(directory, 'feature.json'),
        await inspectFeature(app, option(args, '--feature')),
      );
      console.log(directory);
    });
    return;
  }
  if (
    command === 'test' ||
    command === 'test:postgres' ||
    command === 'test:http'
  ) {
    assertHarnessMode();
    const directory = artifactDirectory('tests');
    const configs =
      command === 'test:postgres'
        ? ['jest-postgres.json']
        : command === 'test:http'
          ? ['jest-harness.json']
          : ['jest-postgres.json', 'jest-harness.json'];
    let failed = false;
    for (const config of configs) {
      try {
        await run(process.execPath, [
          join(backend, 'node_modules/jest/bin/jest.js'),
          '--config',
          `test/${config}`,
          '--runInBand',
          '--json',
          '--outputFile',
          join(directory, `${config}.results.json`),
        ]);
      } catch {
        failed = true;
      }
    }
    console.log(`Test evidence: ${directory}`);
    if (failed) throw new Error('Integration suite failed');
    return;
  }
  console.log(
    'Commands: doctor, up, status, seed, reset, down, studio, inspect --feature FEAT-*, test, test:postgres, test:http.',
  );
}
