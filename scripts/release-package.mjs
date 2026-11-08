import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

export async function selectReleasePackage(tag) {
  let packagePath;
  let expectedPrefix;
  if (/^v\d+\.\d+\.\d+$/u.test(tag)) {
    packagePath = 'packages/evidence-diagrams';
    expectedPrefix = 'v';
  } else if (/^dom-v\d+\.\d+\.\d+$/u.test(tag)) {
    packagePath = 'packages/evidence-diagrams-dom';
    expectedPrefix = 'dom-v';
  } else {
    throw new Error(`Unsupported release tag: ${tag}`);
  }

  const manifest = JSON.parse(await readFile(new URL(`${packagePath}/package.json`, root), 'utf8'));
  const expectedTag = `${expectedPrefix}${manifest.version}`;
  if (tag !== expectedTag) {
    throw new Error(`Release tag ${tag} must equal ${expectedTag} for ${manifest.name}.`);
  }
  return {
    package_name: manifest.name,
    package_path: packagePath,
    package_version: manifest.version,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const outputs = await selectReleasePackage(argumentValue('--tag'));
  const githubOutput = process.argv.includes('--github-output')
    ? argumentValue('--github-output')
    : undefined;
  if (githubOutput) {
    await appendFile(githubOutput, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
  } else {
    process.stdout.write(`${JSON.stringify(outputs)}\n`);
  }
}
