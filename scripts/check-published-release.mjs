import { appendFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const registry = 'https://registry.npmjs.org';

function integrityFor(bytes) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

function requireIntegrity(integrity, source) {
  if (typeof integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(integrity)) {
    throw new Error(`${source} has malformed sha512 integrity.`);
  }
  return integrity;
}

/** Retrieves the exact package-version archive integrity from npm's public registry. */
export async function lookupPublishedRelease({ packageName, packageVersion, fetchImpl = fetch }) {
  const url = `${registry}/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}`;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(`npm registry request failed: ${error.message}`, { cause: error });
  }
  if (!response || typeof response.status !== 'number' || typeof response.ok !== 'boolean' || typeof response.json !== 'function') {
    throw new Error('npm registry returned an invalid response.');
  }
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}.`);
  let manifest;
  try {
    manifest = await response.json();
  } catch (error) {
    throw new Error(`npm registry returned invalid JSON: ${error.message}`, { cause: error });
  }
  return { integrity: manifest?.dist?.integrity };
}

/** Determines whether npm already has the exact locally packed archive. */
export async function verifyPublishedRelease({ archive, lookup = lookupPublishedRelease }) {
  requireIntegrity(archive.integrity, 'Local archive');
  let published;
  try {
    published = await lookup({ packageName: archive.packageName, packageVersion: archive.packageVersion });
  } catch (error) {
    throw new Error(`registry lookup failed: ${error.message}`, { cause: error });
  }
  if (published === undefined) return { published: false };
  const integrity = requireIntegrity(published?.integrity, 'Published package');
  if (integrity !== archive.integrity) {
    throw new Error(`Published ${archive.packageName}@${archive.packageVersion} has different archive integrity.`);
  }
  return { published: true };
}

export async function checkPublishedRelease({ packageName, packageVersion, archivePath, readArchive = readFile, lookup }) {
  const bytes = await readArchive(archivePath);
  return verifyPublishedRelease({
    archive: { packageName, packageVersion, integrity: integrityFor(bytes) },
    ...(lookup ? { lookup } : {}),
  });
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await checkPublishedRelease({
    packageName: argumentValue('--package-name'),
    packageVersion: argumentValue('--package-version'),
    archivePath: argumentValue('--archive'),
  });
  const githubOutput = process.argv.includes('--github-output') ? argumentValue('--github-output') : undefined;
  if (githubOutput) await appendFile(githubOutput, `published=${result.published}\n`);
  else process.stdout.write(`${JSON.stringify(result)}\n`);
}
