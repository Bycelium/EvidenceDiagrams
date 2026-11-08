import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../packages/evidence-diagrams/', import.meta.url));
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'evidence-diagrams-package-'));
const rootManifest = JSON.parse(await readFile(new URL('../packages/evidence-diagrams/package.json', import.meta.url), 'utf8'));
const packageSpecifier = rootManifest.name;
const mathSpecifier = `${packageSpecifier}/propagation-math`;
const installedPackageDirectory = join(
  temporaryDirectory,
  'consumer',
  'node_modules',
  ...packageSpecifier.split('/'),
);

function run(command, argumentsList, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd: options.cwd ?? packageRoot,
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
  const archiveFilename = `evidence-diagrams-${rootManifest.version}.tgz`;
  const archivePath = join(temporaryDirectory, archiveFilename);
  await pnpm(['--filter', rootManifest.name, 'pack', '--out', archivePath]);
  const files = (await run('tar', ['-tzf', archivePath]))
    .trim()
    .split('\n')
    .map((path) => path.replace(/^package\//u, ''))
    .sort();
  assert.ok(files.includes('dist/index.js'), 'The archive must contain the JavaScript entry point.');
  assert.ok(files.includes('dist/index.d.ts'), 'The archive must contain TypeScript declarations.');
  assert.ok(
    files.includes('dist/propagation-math/index.js'),
    'The archive must contain the propagation math JavaScript entry point.',
  );
  assert.ok(
    files.includes('dist/propagation-math/index.d.ts'),
    'The archive must contain propagation math declarations.',
  );
  assert.ok(files.includes('README.md'), 'The archive must contain the README.');
  assert.ok(files.includes('LICENSE'), 'The archive must contain the license.');
  assert.ok(files.includes('NOTICE'), 'The archive must contain attribution notices.');
  assert.ok(files.includes('package.json'), 'The archive must contain its metadata.');
  assert.deepEqual(
    files.filter((file) => !/^(?:dist\/.+\.(?:js|d\.ts)|README\.md|LICENSE|NOTICE|package\.json)$/.test(file)),
    [],
    'The archive contains a file outside the publication allowlist.',
  );
  assert.deepEqual(
    files.filter((file) => /(?:^|\/)(?:demo|visualization)(?:\/|$)|\.(?:css|html)$/.test(file)),
    [],
    'The archive must not contain demo or rendering assets.',
  );

  const consumerDirectory = join(temporaryDirectory, 'consumer');
  await mkdir(consumerDirectory);
  await writeFile(join(consumerDirectory, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      [rootManifest.name]: `file:${archivePath}`,
    },
  }, null, 2));
  await pnpm([
    'install',
    '--ignore-scripts',
    '--offline',
    '--store-dir',
    join(temporaryDirectory, 'pnpm-store'),
  ], { cwd: consumerDirectory });

  const source = `import assert from 'node:assert/strict';
import {
  DEFAULT_COLOR_OPTIONS,
  JEFFREYS_THRESHOLDS_DECIBANS,
  aggregateEvidence,
  buildEvidenceDiagram,
  credibilityAxisColor,
  credibilityBandBackground,
  evaluateInquiry,
  evidenceStrengthColor,
  formatProbabilityDisplay,
  jeffreysBand,
} from '${packageSpecifier}';
import { expectedProbability, gaussianToBand } from '${mathSpecifier}';

assert.deepEqual(aggregateEvidence([{ weightDecibans: 12 }, { weightDecibans: -5 }]), {
  netWeightDecibans: 7,
  absoluteWeightDecibans: 17,
  dissonance: 1 - 7 / 17,
});
assert.equal(
  buildEvidenceDiagram([{ id: 'evidence', weightDecibans: 20 }]).probability.text,
  'Probability ≥ 75 %',
);
assert.equal(DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans, 15);
assert.deepEqual([...JEFFREYS_THRESHOLDS_DECIBANS], [2.5, 5, 10, 15, 20]);
assert.equal(jeffreysBand({ weightDecibans: 3 }), 'weak');
assert.deepEqual(formatProbabilityDisplay(0, 'exact'), { value: 50 });
assert.match(credibilityAxisColor(10), /^#[0-9a-f]{6}$/u);
assert.match(evidenceStrengthColor({
  netWeightDecibans: -3,
  absoluteWeightDecibans: 3,
  dissonance: 0,
}), /^#[0-9a-f]{6}$/u);
assert.ok(credibilityBandBackground({ lower: -5, upper: 5 }, {
  minimum: -30,
  maximum: 30,
}).startsWith('linear-gradient('));
assert.deepEqual(gaussianToBand({ mean: 0, standardDeviation: 5 }), { lower: -15, upper: 15 });
assert.ok(Math.abs(expectedProbability({ mean: 10, standardDeviation: 5 }) - 0.8671460895375879) < 1e-12);
const inquiry = evaluateInquiry({
  rootClaimId: 'target',
  claims: [
    { id: 'target', title: 'Target', description: 'Target scope.', prior: { mean: 0, standardDeviation: 5 } },
    { id: 'premise', title: 'Premise', prior: { mean: 0, standardDeviation: 0 } },
  ],
  contributions: [{ id: 'source', title: 'Source' }],
  evidence: [{
    id: 'evidence',
    contributionId: 'source',
    premiseClaimId: 'premise',
    targetClaimId: 'target',
    impact: { deltaMean: 10, deltaStandardDeviation: -2 },
  }],
});
assert.deepEqual(inquiry.claims.target.posterior, { mean: 5, standardDeviation: 4 });
`;
  await writeFile(join(consumerDirectory, 'index.mjs'), source);
  await writeFile(join(consumerDirectory, 'index.ts'), `import {
  aggregateEvidence,
  evaluateInquiry,
  type Inquiry,
  type EvidenceSummary,
} from '${packageSpecifier}';
import {
  applyImpact,
  type Gaussian,
  type GaussianImpact,
} from '${mathSpecifier}';

const summary: EvidenceSummary = aggregateEvidence([{ weightDecibans: 12 }]);
const expected: number = summary.netWeightDecibans;
void expected;
const prior: Gaussian = { mean: 0, standardDeviation: 5 };
const impact: GaussianImpact = { deltaMean: 10, deltaStandardDeviation: -2 };
const posterior: Gaussian = applyImpact(prior, impact, 0.5);
void posterior;
const inquiry: Inquiry = {
  rootClaimId: 'target',
  claims: [{ id: 'target', title: 'Target', description: 'Target scope.', prior }],
  contributions: [],
  evidence: [],
};
const rootMean: number = evaluateInquiry(inquiry).claims.target!.posterior.mean;
void rootMean;
`);
  await run(process.execPath, ['index.mjs'], { cwd: consumerDirectory });

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
    'index.ts',
  ], { cwd: consumerDirectory });

  const installedManifest = JSON.parse(await readFile(
    join(installedPackageDirectory, 'package.json'),
    'utf8',
  ));
  assert.equal(installedManifest.name, rootManifest.name);
  assert.equal(installedManifest.version, rootManifest.version);
  assert.equal(installedManifest.license, 'Apache-2.0');
  assert.ok(installedManifest.exports['./propagation-math']);
  for (const name of ['LICENSE', 'NOTICE']) {
    assert.equal(
      await readFile(join(installedPackageDirectory, name), 'utf8'),
      await readFile(join(packageRoot, name), 'utf8'),
      `The installed ${name} must preserve the project notice.`,
    );
  }
  console.log(`Archive validated: ${archiveFilename} (${files.length} files).`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
