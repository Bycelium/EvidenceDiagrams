import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'evidence-diagrams-dom-package-'));
const coreManifest = JSON.parse(await readFile(new URL('../packages/evidence-diagrams/package.json', import.meta.url), 'utf8'));
const domManifest = JSON.parse(await readFile(
  new URL('../packages/evidence-diagrams-dom/package.json', import.meta.url),
  'utf8',
));

function run(command, argumentsList, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: options.cwd ?? repositoryRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let errorOutput = '';
    child.stdout.setEncoding('utf8').on('data', (data) => { output += data; });
    child.stderr.setEncoding('utf8').on('data', (data) => { errorOutput += data; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${argumentsList.join(' ')} failed (${code}).\n${output}${errorOutput}`));
    });
  });
}

async function pnpm(argumentsList, options = {}) {
  const executable = process.env.npm_execpath;
  if (executable?.endsWith('.cjs') || executable?.endsWith('.js')) {
    return run(process.execPath, [executable, ...argumentsList], options);
  }
  return run(executable ?? 'pnpm', argumentsList, options);
}

try {
  const coreArchive = join(temporaryDirectory, `evidence-diagrams-${coreManifest.version}.tgz`);
  const domArchive = join(temporaryDirectory, `evidence-diagrams-dom-${domManifest.version}.tgz`);
  await pnpm(['--filter', coreManifest.name, 'pack', '--out', coreArchive]);
  await pnpm(['--filter', domManifest.name, 'pack', '--out', domArchive]);

  const consumerDirectory = join(temporaryDirectory, 'consumer');
  await mkdir(consumerDirectory);
  await writeFile(join(consumerDirectory, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      [coreManifest.name]: `file:${coreArchive}`,
      [domManifest.name]: `file:${domArchive}`,
    },
    pnpm: {
      overrides: {
        [coreManifest.name]: `file:${coreArchive}`,
      },
    },
  }, null, 2));
  await pnpm([
    'install',
    '--ignore-scripts',
    '--offline',
    '--store-dir',
    join(temporaryDirectory, 'pnpm-store'),
  ], { cwd: consumerDirectory });

  const installedDom = join(consumerDirectory, 'node_modules', ...domManifest.name.split('/'));
  const installedManifest = JSON.parse(await readFile(join(installedDom, 'package.json'), 'utf8'));
  assert.equal(installedManifest.dependencies[coreManifest.name], `^${coreManifest.version}`);
  assert.equal(installedManifest.sideEffects[0], './styles.css');
  assert.ok(installedManifest.exports['./styles.css']);
  const css = await readFile(join(installedDom, 'styles.css'), 'utf8');
  assert.match(css, /--ed-dom-weight-ink/u);
  assert.doesNotMatch(css, /(?:^|\})\s*(?:body|html)\s*\{/u);
  for (const name of ['README.md', 'LICENSE', 'NOTICE']) {
    await readFile(join(installedDom, name), 'utf8');
  }

  await writeFile(join(consumerDirectory, 'index.mjs'), `import assert from 'node:assert/strict';
import {
  buildEvidenceImpactPreviewGeometry,
  summarizeCollapsedEvidence,
} from '${domManifest.name}';

const summary = summarizeCollapsedEvidence({ meanChanges: [-2, 4], extentDecibans: 10 });
assert.deepEqual({
  oppositionDecibans: summary.oppositionDecibans,
  oppositionCount: summary.oppositionCount,
  oppositionPercent: summary.oppositionPercent,
  supportDecibans: summary.supportDecibans,
  supportCount: summary.supportCount,
  supportPercent: summary.supportPercent,
}, {
  oppositionDecibans: 2,
  oppositionCount: 1,
  oppositionPercent: 20,
  supportDecibans: 4,
  supportCount: 1,
  supportPercent: 40,
});
assert.equal(buildEvidenceImpactPreviewGeometry({
  before: { mean: 0, standardDeviation: 2 },
  conditional: { mean: 10, standardDeviation: 1 },
  after: { mean: 5, standardDeviation: 1.5 },
  premiseWeight: .5,
}).selectedBound, 'lower');
`);
  await run(process.execPath, ['index.mjs'], { cwd: consumerDirectory });

  await writeFile(join(consumerDirectory, 'index.ts'), `import {
  renderCredibilityAxis,
  type CredibilityAxisOptions,
} from '${domManifest.name}';
const options: CredibilityAxisOptions = {
  band: { lower: -5, upper: 5 },
  position: { left: 25, width: 50, center: 50, clippedMinimum: false, clippedMaximum: false },
  domain: { minimum: -30, maximum: 30 },
  saturationThresholdDecibans: 15,
  plotWidth: 400,
  formatPercent: value => String(value),
};
void renderCredibilityAxis;
void options;
`);
  const tscPath = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
  await run(process.execPath, [
    tscPath,
    '--noEmit',
    '--strict',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ESNext',
    '--lib',
    'ESNext,DOM',
    'index.ts',
  ], { cwd: consumerDirectory });

  console.log(`Packed consumer validated: ${domManifest.name}@${domManifest.version}.`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
