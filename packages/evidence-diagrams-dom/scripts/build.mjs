import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const packageDirectory = new URL('../', import.meta.url);
const distDirectory = new URL('../dist/', import.meta.url);
const tscPath = fileURLToPath(new URL('../../../node_modules/typescript/bin/tsc', import.meta.url));

await rm(distDirectory, { recursive: true, force: true });

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [tscPath, '-p', 'tsconfig.build.json'], {
    cwd: fileURLToPath(packageDirectory),
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('close', resolve);
});
if (exitCode !== 0) throw new Error(`TypeScript build failed with exit code ${exitCode}.`);
