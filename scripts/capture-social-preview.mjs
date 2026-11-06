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
  page.setDefaultTimeout(5_000);
  await page.goto(options.url, { waitUntil: 'load' });
  process.stdout.write('Loaded demo\n');
  await page.locator('#inquiry-session-notice-acknowledge').check();
  await page.locator('#inquiry-session-notice-dismiss').click();
  await page.addStyleTag({ content: 'main.inquiry-page { width: calc(100% - 2rem); max-width: none; zoom: 1.15; }' });
  const root = page.locator('#inquiry-root-list [data-action="add-root"]');
  await root.click();
  await page.locator('[name="rootTitle"]').fill('How credible is this claim?');
  await page.locator('[name="rootDescription"]').fill('A short inquiry that weighs supporting findings and a documented limitation.');
  await page.locator('#inquiry-dialog-submit').click();
  process.stdout.write('Added root inquiry\n');

  const addEvidence = page.locator('[data-action="add-evidence"]');
  const evidence = [
    ['Quantitative findings support the claim', 'A published finding reports results consistent with the claim.', 'Independent research summary', '20'],
    ['Independent replication confirms the results', 'A separate study reached a similar conclusion using a different sample.', 'Second study record', '12'],
    ['A documented limitation challenges the claim', 'The evidence record identifies a limitation that weakens confidence.', 'Methods review', '-10'],
  ];
  for (const [title, description, source, strength] of evidence) {
    await addEvidence.click();
    await page.locator('[name="premiseTitle"]').fill(title);
    await page.locator('[name="premiseDescription"]').fill(description);
    await page.locator('[name="sourceTitle"]').fill(source);
    await page.locator('[name="sourceUrl"]').fill('https://example.com/evidence');
    await page.locator('.inquiry-conditional-strength-input').fill(strength);
    await page.locator('#inquiry-dialog-submit').click();
  }
  process.stdout.write('Added evidence\n');

  const focus = page.locator('.inquiry-focus-heading[data-action="toggle-claim"]');
  if (await focus.getAttribute('aria-expanded') === 'false') await focus.click();
  const graph = page.locator('.inquiry-graph-toggle[data-action="toggle-graph"]');
  if (await graph.getAttribute('aria-expanded') === 'false') await graph.click();
  const trail = page.locator('.inquiry-trail-toggle');
  if (await trail.getAttribute('aria-expanded') === 'false') await trail.click();
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.evaluate(() => {
    const combined = [...document.querySelectorAll('.inquiry-graph-toggle')].find((element) => (
      element.closest('.inquiry-focus')?.textContent?.includes('How credible is this claim?')
    ));
    if (!(combined instanceof HTMLElement)) throw new Error('The new inquiry graph was not rendered.');
    window.scrollBy(0, combined.getBoundingClientRect().top + 54);
  });
  await page.mouse.move(5, 5);
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
