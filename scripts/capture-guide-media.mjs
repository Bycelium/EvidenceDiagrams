#!/usr/bin/env node

/** Capture the README stills and short UI walkthroughs from the generated demo. */
import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_URL = pathToFileURL(resolve(ROOT, 'demo/index.html')).href;
const FRAME_RATE = 10;

function usage() {
  return `Usage: node scripts/capture-guide-media.mjs --output-dir <directory> --playwright-module <module> --ffmpeg-path <path> [options]

Options:
  --output-dir <directory>    Destination for the PNG and GIF files (required)
  --playwright-module <path>  Playwright module path (required)
  --ffmpeg-path <path>        ffmpeg used to encode the GIFs (required)
  --browser-path <path>       Chromium executable path
  --url <url>                 Demo URL (default: ${DEFAULT_URL})
  --gifs-only                 Capture only the two animated walkthroughs
  --pngs-only                 Capture only the four still images
  --headed                    Show Chromium while capturing
  --help                      Show this message
`;
}

function parseArguments(args) {
  const options = { url: DEFAULT_URL, headed: false, gifsOnly: false, pngsOnly: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') return { help: true };
    if (argument === '--headed') { options.headed = true; continue; }
    if (argument === '--gifs-only') { options.gifsOnly = true; continue; }
    if (argument === '--pngs-only') { options.pngsOnly = true; continue; }
    const field = {
      '--output-dir': 'outputDir',
      '--playwright-module': 'playwrightModule',
      '--ffmpeg-path': 'ffmpegPath',
      '--browser-path': 'browserPath',
      '--url': 'url',
    }[argument];
    if (!field) throw new Error(`Unknown option: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
    options[field] = value;
    index += 1;
  }
  for (const field of ['outputDir', 'playwrightModule', 'ffmpegPath']) {
    if (!options[field]) throw new Error(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required.`);
  }
  if (options.gifsOnly && options.pngsOnly) throw new Error('--gifs-only and --pngs-only cannot be combined.');
  options.outputDir = resolve(options.outputDir);
  options.ffmpegPath = resolve(options.ffmpegPath);
  if (options.browserPath) options.browserPath = resolve(options.browserPath);
  return options;
}

async function loadPlaywright(moduleSpecifier) {
  const source = isAbsolute(moduleSpecifier) || moduleSpecifier.startsWith('.')
    ? pathToFileURL(resolve(moduleSpecifier)).href
    : moduleSpecifier;
  const imported = await import(source);
  const playwright = imported.default ?? imported;
  if (!playwright.chromium?.launch) throw new Error(`${moduleSpecifier} does not export chromium.launch().`);
  return playwright;
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(output);
      else reject(new Error(`${command} exited with ${code}: ${output}`));
    });
  });
}

async function settle(page) {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function createPage(browser, url, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: options.colorScheme ?? 'light',
    locale: 'en-US',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto(url, { waitUntil: 'load' });
  const sessionNoticeAcknowledge = page.locator('#inquiry-session-notice-acknowledge');
  const sessionNoticeDismiss = page.locator('#inquiry-session-notice-dismiss');
  await sessionNoticeDismiss.waitFor({ state: 'visible' });
  await sessionNoticeAcknowledge.check();
  await sessionNoticeDismiss.click();
  await page.locator('#inquiry-session-notice').waitFor({ state: 'hidden' });
  await page.locator('.inquiry-focus-heading').waitFor();
  await settle(page);
  return { page, context, errors };
}

async function ensureExpanded(locator, expanded) {
  await locator.waitFor();
  const current = await locator.getAttribute('aria-expanded');
  if ((current === 'true') !== expanded) {
    await locator.click();
    await locator.page().waitForTimeout(80);
    await settle(locator.page());
  }
}

async function prepareGraph(page, { trailExpanded = true } = {}) {
  await ensureExpanded(page.locator('.inquiry-focus-heading'), true);
  await ensureExpanded(page.locator('.inquiry-graph-toggle'), true);
  await ensureExpanded(page.locator('.inquiry-trail-toggle'), trailExpanded);
}

async function assertCleanPage(page, errors, label) {
  await settle(page);
  if (errors.length) throw new Error(`${label} produced page errors:\n${errors.join('\n')}`);
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
  ) - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`${label} overflows the viewport by ${overflow}px.`);
}

async function capturePngs(browser, options) {
  const output = [];

  {
    const { page, context, errors } = await createPage(browser, options.url, {
      viewport: { width: 1280, height: 860 },
    });
    try {
      await ensureExpanded(
        page.locator('.inquiry-focus-heading[data-action="toggle-claim"]'),
        true,
      );
      await ensureExpanded(
        page.locator('.inquiry-graph-toggle[data-action="toggle-graph"]'),
        false,
      );
      const path = resolve(options.outputDir, 'inquiry-overview-light.png');
      const clip = await page.evaluate(() => {
        const main = document.querySelector('main');
        const focus = document.querySelector('.inquiry-focus');
        if (!(main instanceof HTMLElement) || !(focus instanceof HTMLElement)) {
          throw new Error('The overview requires main and .inquiry-focus.');
        }
        const mainBounds = main.getBoundingClientRect();
        const focusBounds = focus.getBoundingClientRect();
        return {
          x: mainBounds.left,
          y: mainBounds.top,
          width: mainBounds.width,
          height: focusBounds.bottom + 16 - mainBounds.top,
        };
      });
      await page.screenshot({ path, clip });
      await assertCleanPage(page, errors, 'Light overview');
      output.push(path);
    } finally { await context.close(); }
  }

  {
    const { page, context, errors } = await createPage(browser, options.url, {
      viewport: { width: 1280, height: 900 },
    });
    try {
      await prepareGraph(page);
      const path = resolve(options.outputDir, 'inquiry-diagram-light.png');
      await page.locator('.inquiry-focus').screenshot({ path });
      await assertCleanPage(page, errors, 'Expanded inquiry diagram');
      output.push(path);
    } finally { await context.close(); }
  }

  {
    const { page, context, errors } = await createPage(browser, options.url, {
      viewport: { width: 1280, height: 900 }, colorScheme: 'light',
    });
    try {
      await ensureExpanded(
        page.locator('.inquiry-focus-heading[data-action="toggle-claim"]'),
        true,
      );
      await ensureExpanded(
        page.locator('.inquiry-graph-toggle[data-action="toggle-graph"]'),
        true,
      );
      const evidence = page.locator(
        '[data-evidence-id="nuclear.e-renewables-root"] .inquiry-flow-label-button',
      );
      await evidence.scrollIntoViewIfNeeded();
      await evidence.click();
      await page.locator('#inquiry-evidence-panel[open]').waitFor();
      await settle(page);
      const path = resolve(options.outputDir, 'evidence-drawer-light.png');
      await page.locator('#inquiry-evidence-panel').screenshot({ path });
      await assertCleanPage(page, errors, 'Light evidence drawer');
      output.push(path);
    } finally { await context.close(); }
  }

  {
    const { page, context, errors } = await createPage(browser, options.url, {
      viewport: { width: 1080, height: 760 },
    });
    try {
      const addRoot = page.locator('#inquiry-root-list [data-action="add-root"]');
      await addRoot.hover();
      const path = resolve(options.outputDir, 'add-claim-light.png');
      const clip = await page.evaluate(() => {
        const main = document.querySelector('main');
        const focus = document.querySelector('.inquiry-focus');
        if (!(main instanceof HTMLElement) || !(focus instanceof HTMLElement)) {
          throw new Error('The Add a claim capture requires main and .inquiry-focus.');
        }
        const mainBounds = main.getBoundingClientRect();
        const focusBounds = focus.getBoundingClientRect();
        return {
          x: mainBounds.left,
          y: mainBounds.top,
          width: mainBounds.width,
          height: focusBounds.bottom + 16 - mainBounds.top,
        };
      });
      await page.screenshot({ path, clip });
      await assertCleanPage(page, errors, 'Add a claim action');
      output.push(path);
    } finally { await context.close(); }
  }
  return output;
}

async function createFrameWriter(page, directory, target) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  let frame = 0;
  async function capture(repeats = 1) {
    const path = resolve(directory, `frame-${String(frame).padStart(4, '0')}.png`);
    await target.screenshot({ path });
    frame += 1;
    for (let index = 1; index < repeats; index += 1) {
      await copyFile(path, resolve(directory, `frame-${String(frame).padStart(4, '0')}.png`));
      frame += 1;
    }
  }
  return { capture, count: () => frame, page };
}

async function encodeGif(ffmpegPath, frameDirectory, outputPath) {
  await run(ffmpegPath, [
    '-y', '-framerate', String(FRAME_RATE),
    '-i', resolve(frameDirectory, 'frame-%04d.png'),
    '-filter_complex', "fps=10,scale='min(960,iw)':-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=72:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
    '-fps_mode', 'passthrough', '-loop', '0', outputPath,
  ]);
}

async function validateGif(ffmpegPath, path, expectedFrames) {
  const ffprobePath = resolve(dirname(ffmpegPath), 'ffprobe');
  const raw = await run(ffprobePath, [
    '-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,nb_read_frames,avg_frame_rate:format=duration,size',
    '-of', 'json', path,
  ]);
  const report = JSON.parse(raw);
  const stream = report.streams?.[0] ?? {};
  const duration = Number(report.format?.duration);
  const frames = Number(stream.nb_read_frames);
  const size = Number(report.format?.size);
  if (frames !== expectedFrames) throw new Error(`${path} has ${frames} frames; expected ${expectedFrames}.`);
  if (duration < 6 || duration > 15) throw new Error(`${path} is ${duration}s; expected 6–15s.`);
  if (size > 2_500_000) throw new Error(`${path} is ${size} bytes; expected at most 2.5 MB.`);
  return { path, width: Number(stream.width), height: Number(stream.height), frames, duration, size };
}

async function captureChangingPrior(browser, options) {
  const { page, context, errors } = await createPage(browser, options.url, {
    viewport: { width: 1000, height: 900 },
  });
  const frames = resolve(options.outputDir, '.frames-changing-inquiry-prior');
  const output = resolve(options.outputDir, 'changing-inquiry-prior.gif');
  try {
    await prepareGraph(page, { trailExpanded: false });
    const target = page.locator('.inquiry-focus');
    await target.scrollIntoViewIfNeeded();
    const writer = await createFrameWriter(page, frames, target);
    await writer.capture(18);

    const handle = page.locator('.prior-handle-max');
    const box = await handle.boundingBox();
    if (!box) throw new Error('The upper prior handle is not visible.');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) {
      await page.mouse.move(startX + step * 10, startY, { steps: 2 });
      await settle(page);
      await writer.capture(3);
    }
    await page.mouse.up();
    await settle(page);
    await writer.capture(18);
    const reset = page.locator('.inquiry-prior-reset');
    await reset.click();
    await settle(page);
    await writer.capture(25);
    await assertCleanPage(page, errors, 'Changing prior');
    await encodeGif(options.ffmpegPath, frames, output);
    return validateGif(options.ffmpegPath, output, writer.count());
  } finally { await context.close(); }
}

async function captureAdjustingEvidenceStrength(browser, options) {
  const { page, context, errors } = await createPage(browser, options.url, {
    viewport: { width: 1280, height: 900 },
  });
  const frames = resolve(options.outputDir, '.frames-adjusting-evidence-strength');
  const output = resolve(options.outputDir, 'adjusting-evidence-strength.gif');
  try {
    await prepareGraph(page);
    const evidence = page.locator(
      '[data-evidence-id="nuclear.e-renewables-root"] .inquiry-flow-label-button',
    );
    await evidence.scrollIntoViewIfNeeded();
    await evidence.click();
    const panel = page.locator('#inquiry-evidence-panel[open]');
    await panel.waitFor();
    await settle(page);
    const writer = await createFrameWriter(page, frames, page);
    await writer.capture(18);

    const input = panel.locator('.inquiry-conditional-strength-input');
    const box = await input.boundingBox();
    if (!box) throw new Error('The conditional strength handle is not visible.');
    const range = await input.evaluate((element) => ({
      minimum: Number(element.min),
      maximum: Number(element.max),
      value: Number(element.value),
    }));
    const availableRight = range.maximum - range.value;
    const direction = availableRight >= 12 ? 1 : -1;
    const steps = Math.min(12, direction > 0 ? availableRight : range.value - range.minimum);
    const trackInset = Math.min(12, box.width / 4);
    const trackWidth = Math.max(1, box.width - 2 * trackInset);
    const startX = box.x + trackInset
      + (range.value - range.minimum) / (range.maximum - range.minimum) * trackWidth;
    const startY = box.y + box.height / 2;
    const pixelsPerDeciban = trackWidth / (range.maximum - range.minimum);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let step = 1; step <= steps; step += 1) {
      await page.mouse.move(startX + direction * step * pixelsPerDeciban, startY);
      await settle(page);
      const value = Number(await input.inputValue());
      if (!Number.isInteger(value)) throw new Error(`Conditional strength did not snap to 1 dBan: ${value}.`);
      await writer.capture(3);
    }
    await page.mouse.up();
    await settle(page);
    const changedValue = Number(await input.inputValue());
    if (Math.abs(changedValue - range.value) < 8) {
      throw new Error(`Conditional strength moved by only ${changedValue - range.value} dBan.`);
    }
    await writer.capture(18);

    await panel.locator('.inquiry-conditional-strength-reset').click();
    await settle(page);
    await writer.capture(25);

    await assertCleanPage(page, errors, 'Adjusting evidence strength');
    await encodeGif(options.ffmpegPath, frames, output);
    return validateGif(options.ffmpegPath, output, writer.count());
  } finally { await context.close(); }
}

async function main() {
  let options;
  try { options = parseArguments(process.argv.slice(2)); } catch (error) {
    console.error(`${error.message}\n\n${usage()}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) { console.log(usage()); return; }
  await mkdir(options.outputDir, { recursive: true });
  const playwright = await loadPlaywright(options.playwrightModule);
  const browser = await playwright.chromium.launch({
    headless: !options.headed,
    ...(options.browserPath ? { executablePath: options.browserPath } : {}),
  });
  try {
    const pngs = options.gifsOnly ? [] : await capturePngs(browser, options);
    const gifs = options.pngsOnly ? [] : [
      await captureChangingPrior(browser, options),
      await captureAdjustingEvidenceStrength(browser, options),
    ];
    const pngReports = await Promise.all(pngs.map(async (path) => ({
      path,
      size: (await stat(path)).size,
    })));
    console.log(JSON.stringify({ pngs: pngReports, gifs }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
