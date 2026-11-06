import { cp, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageDirectory = new URL('../', import.meta.url);
const distDirectory = new URL('../dist/', import.meta.url);
const mathDistDirectory = new URL('../packages/propagation-math/dist/', import.meta.url);
const publishedMathDirectory = new URL('../dist/propagation-math/', import.meta.url);
const tscPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));

await rm(distDirectory, { recursive: true, force: true });
await rm(mathDistDirectory, { recursive: true, force: true });

function compile(project) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tscPath, '-p', project], {
      cwd: fileURLToPath(packageDirectory),
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`TypeScript build failed with exit code ${code}.`));
    });
  });
}

await compile('packages/propagation-math/tsconfig.build.json');
await mkdir(distDirectory, { recursive: true });
await cp(mathDistDirectory, publishedMathDirectory, { recursive: true });
await compile('tsconfig.build.json');
