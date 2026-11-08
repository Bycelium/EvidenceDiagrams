import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { selectReleasePackage } from './release-package.mjs';

const coreManifest = JSON.parse(await readFile(
  new URL('../packages/evidence-diagrams/package.json', import.meta.url),
  'utf8',
));
const domManifest = JSON.parse(await readFile(
  new URL('../packages/evidence-diagrams-dom/package.json', import.meta.url),
  'utf8',
));

function nextPatch(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

test('selects each independently versioned package from its exact namespace', async () => {
  assert.deepEqual(await selectReleasePackage(`v${coreManifest.version}`), {
    package_name: '@bycelium/evidence-diagrams',
    package_path: 'packages/evidence-diagrams',
    package_version: coreManifest.version,
  });
  assert.deepEqual(await selectReleasePackage(`dom-v${domManifest.version}`), {
    package_name: '@bycelium/evidence-diagrams-dom',
    package_path: 'packages/evidence-diagrams-dom',
    package_version: domManifest.version,
  });
});

test('rejects unknown and package-version-mismatched release tags', async () => {
  await assert.rejects(selectReleasePackage('next'), /Unsupported release tag/u);
  await assert.rejects(selectReleasePackage(`v${nextPatch(coreManifest.version)}`), /must equal/u);
  await assert.rejects(selectReleasePackage(`dom-v${nextPatch(domManifest.version)}`), /must equal/u);
});
