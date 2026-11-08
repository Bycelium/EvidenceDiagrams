import assert from 'node:assert/strict';
import test from 'node:test';

import { lookupPublishedRelease, verifyPublishedRelease } from './check-published-release.mjs';

const archive = {
  packageName: '@bycelium/evidence-diagrams',
  packageVersion: '1.2.0',
  integrity: 'sha512-bG9jYWwtYXJjaGl2ZQ==',
};

test('accepts an identically published archive', async () => {
  const result = await verifyPublishedRelease({
    archive,
    lookup: async (request) => {
      assert.deepEqual(request, { packageName: archive.packageName, packageVersion: archive.packageVersion });
      return { integrity: archive.integrity };
    },
  });
  assert.deepEqual(result, { published: true });
});

test('reports an absent exact package version as unpublished', async () => {
  const result = await verifyPublishedRelease({ archive, lookup: async () => undefined });
  assert.deepEqual(result, { published: false });
});

test('rejects an existing package version with different archive integrity', async () => {
  await assert.rejects(
    verifyPublishedRelease({ archive, lookup: async () => ({ integrity: 'sha512-b3RoZXItYXJjaGl2ZQ==' }) }),
    /different archive integrity/u,
  );
});

test('rejects a malformed published integrity', async () => {
  await assert.rejects(
    verifyPublishedRelease({ archive, lookup: async () => ({ integrity: 'sha256-not-sha512' }) }),
    /malformed sha512 integrity/u,
  );
});

test('does not treat registry faults as an absent package version', async () => {
  await assert.rejects(
    verifyPublishedRelease({ archive, lookup: async () => { throw new Error('connection reset'); } }),
    /registry lookup failed: connection reset/u,
  );
});

test('rejects malformed registry responses', async () => {
  await assert.rejects(
    lookupPublishedRelease({
      packageName: archive.packageName,
      packageVersion: archive.packageVersion,
      fetchImpl: async () => ({ status: 200, ok: true }),
    }),
    /invalid response/u,
  );
});
