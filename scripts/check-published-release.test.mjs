import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { checkPublishedRelease, lookupPublishedRelease } from './check-published-release.mjs';

const archive = {
  packageName: '@bycelium/evidence-diagrams',
  packageVersion: '1.2.0',
  bytes: Buffer.from('a locally packed archive', 'utf8'),
};
const integrity = `sha512-${createHash('sha512').update(archive.bytes).digest('base64')}`;

function check({ lookup }) {
  return checkPublishedRelease({
    packageName: archive.packageName,
    packageVersion: archive.packageVersion,
    archivePath: '/tmp/evidence-diagrams.tgz',
    readArchive: async (path) => {
      assert.equal(path, '/tmp/evidence-diagrams.tgz');
      return archive.bytes;
    },
    lookup,
  });
}

test('accepts an identically published archive after hashing its bytes', async () => {
  const result = await check({
    lookup: async (request) => {
      assert.deepEqual(request, { packageName: archive.packageName, packageVersion: archive.packageVersion });
      return { integrity };
    },
  });
  assert.deepEqual(result, { published: true });
});

test('maps an exact npm 404 to an unpublished archive', async () => {
  const result = await check({
    lookup: (request) => lookupPublishedRelease({
      ...request,
      fetchImpl: async (url, options) => {
        assert.equal(url, 'https://registry.npmjs.org/%40bycelium%2Fevidence-diagrams/1.2.0');
        assert.ok(options.signal instanceof AbortSignal);
        return new Response('', { status: 404 });
      },
    }),
  });
  assert.deepEqual(result, { published: false });
});

test('rejects an existing package version with different archive integrity', async () => {
  const otherIntegrity = `sha512-${createHash('sha512').update('another archive').digest('base64')}`;
  await assert.rejects(check({ lookup: async () => ({ integrity: otherIntegrity }) }), /different archive integrity/u);
});

test('rejects a malformed published integrity', async () => {
  await assert.rejects(check({ lookup: async () => ({ integrity: 'sha512-too-short' }) }), /malformed sha512 integrity/u);
});

test('treats npm HTTP failures, invalid JSON, and transport faults as failures', async () => {
  const request = { packageName: archive.packageName, packageVersion: archive.packageVersion };
  await assert.rejects(
    lookupPublishedRelease({ ...request, fetchImpl: async () => new Response('', { status: 500 }) }),
    /HTTP 500/u,
  );
  await assert.rejects(
    lookupPublishedRelease({ ...request, fetchImpl: async () => new Response('not json', { status: 200 }) }),
    /invalid JSON/u,
  );
  await assert.rejects(
    lookupPublishedRelease({ ...request, fetchImpl: async () => { throw new Error('connection reset'); } }),
    /request failed: connection reset/u,
  );
});
