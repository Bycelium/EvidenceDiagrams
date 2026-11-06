#!/usr/bin/env node

import { mkdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');

function usage() {
  return `Usage: node scripts/capture-social-preview.mjs --playwright-module <module> [options]

Options:
  --playwright-module <path>  Playwright module path (required)
  --browser-path <path>       Chromium executable path
  --output-path <path>        PNG destination (default: demo/social-preview.png)
  --url <url>                 Demo URL (default: file://${resolve(ROOT, 'demo/index.html')})
  --help                      Show this message
`;
}

function parseArguments(args) {
  const options = {
    outputPath: resolve(ROOT, 'demo/social-preview.png'),
    url: pathToFileURL(resolve(ROOT, 'demo/index.html')).href,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') return { help: true };
    const field = {
      '--playwright-module': 'playwrightModule',
      '--browser-path': 'browserPath',
      '--output-path': 'outputPath',
      '--url': 'url',
    }[argument];
    if (!field) throw new Error(`Unknown option: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
    options[field] = value;
    index += 1;
  }
  if (!options.playwrightModule) throw new Error('--playwright-module is required.');
  options.outputPath = resolve(options.outputPath);
  if (options.browserPath) options.browserPath = resolve(options.browserPath);
  return options;
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const moduleUrl = isAbsolute(options.playwrightModule) || options.playwrightModule.startsWith('.')
  ? pathToFileURL(resolve(options.playwrightModule)).href
  : options.playwrightModule;
const { chromium } = await import(moduleUrl);
const browser = await chromium.launch({
  headless: true,
  ...(options.browserPath ? { executablePath: options.browserPath } : {}),
});
let context;

try {
  context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.goto(options.url, { waitUntil: 'load' });
  await page.locator('#inquiry-session-notice-acknowledge').check();
  await page.locator('#inquiry-session-notice-dismiss').click();
  const claim = page.locator('.inquiry-focus-heading[data-action="toggle-claim"]');
  if (await claim.getAttribute('aria-expanded') === 'false') await claim.click();
  const graph = page.locator('.inquiry-graph-toggle[data-action="toggle-graph"]');
  if (await graph.getAttribute('aria-expanded') === 'false') await graph.click();
  const trail = page.locator('.inquiry-trail-toggle[data-action="toggle-trail"]');
  if (await trail.getAttribute('aria-expanded') === 'true') await trail.click();
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await mkdir(dirname(options.outputPath), { recursive: true });
  await page.screenshot({ path: options.outputPath });
  const preview = await readFile(options.outputPath);
  const width = preview.readUInt32BE(16);
  const height = preview.readUInt32BE(20);
  if (width !== 1200 || height !== 630) {
    throw new Error(`Social preview must be 1200×630px, received ${width}×${height}px.`);
  }
  process.stdout.write(`Wrote ${options.outputPath} (${width}×${height})\n`);
} finally {
  await context?.close();
  await browser.close();
}
