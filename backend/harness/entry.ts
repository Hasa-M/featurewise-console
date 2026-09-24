import { loadHarnessEnvironment } from './environment';

if (process.argv.includes('--live'))
  throw new Error(
    'Live mode has been removed. Harness never calls cloud services.',
  );
const mode = 'deterministic';
async function main() {
  const settings = loadHarnessEnvironment(mode);
  // Nest configuration reads environment during module evaluation; load it first.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execute } = require('./commands') as typeof import('./commands');
  await execute(process.argv[2] ?? 'help', process.argv.slice(3), settings);
}
main().catch((error: unknown) => {
  // Provider errors may contain signed URLs; do not dump arbitrary objects or stacks.
  const message =
    error instanceof Error ? error.message : 'Unknown harness failure';
  console.error(
    message
      .replace(/https?:\/\/[^\s]+\?[^\s]+/g, '[URL with query omitted]')
      .replace(/postgresql:\/\/[^\s]+/g, '[database URL omitted]'),
  );
  process.exitCode = 1;
});
