#!/usr/bin/env node

/** Capture the README stills and short UI walkthroughs from the generated demo. */
import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { captureSocialPreview } from './capture-social-preview.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_URL = pathToFileURL(resolve(ROOT, 'demo/index.html')).href;
const FRAME_RATE = 20;
const GIF_DURATION_SECONDS = 9.7;

function framesFor(seconds) {
  return Math.round(seconds * FRAME_RATE);
}

function usage() {
  return `Usage: node scripts/capture-guide-media.mjs --output-dir <directory> [options]

Options:
  --output-dir <directory>    Destination for the PNG and GIF files (required)
  --playwright-module <path>  Playwright module path (default: playwright)
  --ffmpeg-path <path>        ffmpeg executable or path (required for GIF-only mode)
  --browser-path <path>       Chromium executable path
  --url <url>                 Demo URL (default: ${DEFAULT_URL})
  --gifs-only                 Capture only the two animated walkthroughs
  --pngs-only                 Capture still images and the social preview
  --social-only                Capture only demo/social-preview.png
  --shared-dom-review         Capture focused shared axis, summary, and impact review images
  --readme-media               Capture root and DOM package README media
  --headed                    Show Chromium while capturing
  --help                      Show this message
`;
}

function parseArguments(args) {
  const options = {
    url: DEFAULT_URL,
    headed: false,
    gifsOnly: false,
    pngsOnly: false,
    sharedDomReview: false,
    readmeMedia: false,
    socialOnly: false,
    playwrightModule: 'playwright',
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help') return { help: true };
    if (argument === '--headed') { options.headed = true; continue; }
    if (argument === '--gifs-only') { options.gifsOnly = true; continue; }
    if (argument === '--pngs-only') { options.pngsOnly = true; continue; }
    if (argument === '--shared-dom-review') { options.sharedDomReview = true; continue; }
    if (argument === '--readme-media') { options.readmeMedia = true; continue; }
    if (argument === '--social-only') { options.socialOnly = true; continue; }
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
  for (const field of ['outputDir']) {
    if (!options[field]) throw new Error(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required.`);
  }
  if ((options.gifsOnly && options.pngsOnly) || (options.gifsOnly && options.socialOnly)) {
    throw new Error('--gifs-only cannot be combined with --pngs-only or --social-only.');
  }
  if (!options.pngsOnly && !options.socialOnly && !options.sharedDomReview && !options.readmeMedia && !options.ffmpegPath) {
    throw new Error('--ffmpeg-path is required when capturing GIFs.');
  }
  options.outputDir = resolve(options.outputDir);
  if (options.ffmpegPath && (isAbsolute(options.ffmpegPath) || options.ffmpegPath.includes('/'))) {
    options.ffmpegPath = resolve(options.ffmpegPath);
  }
  else if (!options.ffmpegPath && options.readmeMedia) options.ffmpegPath = 'ffmpeg';
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
    locale: options.locale ?? 'en-US',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto(url, { waitUntil: 'load' });
  const sessionNoticeAcknowledge = page.locator('#inquiry-session-notice-acknowledge');
  const sessionNoticeDismiss = page.locator('#inquiry-session-notice-dismiss');
  await sessionNoticeDismiss.waitFor({ state: 'visible' });
  const initialFocus = await page.evaluate(() => document.activeElement?.id);
  if (initialFocus !== 'inquiry-session-notice-acknowledge') {
    throw new Error(`Session notice initially focused ${initialFocus ?? 'nothing'} instead of its acknowledgment checkbox.`);
  }
  await page.keyboard.press('Space');
  if (!await sessionNoticeAcknowledge.isChecked()) throw new Error('Space did not toggle the session notice acknowledgment.');
  await page.keyboard.press('Tab');
  const tabFocus = await page.evaluate(() => document.activeElement?.closest('#inquiry-session-notice') !== null);
  if (!tabFocus) throw new Error('Tab from the session notice acknowledgment left the notice.');
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
  await assertResultantAlignment(page);
  await assertEvidenceSummaryTotals(page);
}

async function assertResultantAlignment(page) {
  const offsets = await page.evaluate(() => [...document.querySelectorAll('.inquiry-resultant-line')]
    .map((line) => {
      const track = line.ownerSVGElement?.closest('.inquiry-flow-axis-track');
      const band = track?.querySelector('.posterior-band');
      const lineBounds = line.getBoundingClientRect();
      const bandBounds = band?.getBoundingClientRect();
      if (!bandBounds || lineBounds.width === 0) return undefined;
      return Math.abs(lineBounds.top + lineBounds.height / 2 - (bandBounds.top + bandBounds.height / 2));
    })
    .filter((offset) => offset !== undefined));
  if (offsets.some((offset) => offset > 1)) {
    throw new Error(`Resultant arrow center differs from its credibility band by ${Math.max(...offsets)}px.`);
  }
}

async function assertEvidenceSummaryTotals(page) {
  const summaries = await page.locator('.collapsed-evidence-summary').evaluateAll((elements) => elements.map((summary) => (
    [...summary.querySelectorAll('.collapsed-evidence-summary-total.is-opposition, .collapsed-evidence-summary-total.is-support')]
      .map((total) => total.textContent ?? '')
  )));
  for (const totals of summaries) {
    if (totals.length !== 2 || totals.some((total) => !total.includes('dBan') || !/\(\d+\)/u.test(total))) {
      throw new Error('Evidence summary must show Supporting and Countering counts with dBan totals.');
    }
  }
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

async function openEvidenceDrawer(page, { graphPrepared = false } = {}) {
  if (!graphPrepared) await prepareGraph(page);
  const evidence = page.locator(
    '[data-evidence-id="nuclear.e-renewables-root"] .inquiry-flow-label-button',
  );
  await evidence.scrollIntoViewIfNeeded();
  await evidence.click();
  const panel = page.locator('#inquiry-evidence-panel[open]');
  await panel.waitFor();
  await settle(page);
  return panel;
}

async function captureSharedDomReview(browser, options) {
  const output = [];
  const scenarios = [
    {
      name: 'shared-dom-claim-path-mobile-light.png',
      viewport: { width: 390, height: 844 },
      colorScheme: 'light',
      locale: 'en-US',
      drawer: false,
    },
    {
      name: 'shared-dom-impact-mobile-dark.png',
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      locale: 'en-US',
      drawer: true,
    },
    {
      name: 'shared-dom-impact-desktop-fr.png',
      viewport: { width: 1100, height: 820 },
      colorScheme: 'light',
      locale: 'fr-FR',
      drawer: true,
    },
  ];
  for (const scenario of scenarios) {
    const { page, context, errors } = await createPage(browser, options.url, scenario);
    try {
      let target;
      if (scenario.drawer) {
        await prepareGraph(page);
        if (scenario.colorScheme === 'dark') {
          const theme = await page.evaluate(() => document.documentElement.dataset.theme);
          if (theme !== 'dark') throw new Error(`${scenario.name} selected ${theme ?? 'no'} theme.`);
          const priorReview = await page.locator('.inquiry-focus .prior-track').evaluate((track) => {
            const band = track.querySelector('.posterior-band');
            const bandBounds = band?.getBoundingClientRect();
            return [...track.querySelectorAll('.inquiry-prior-handle')].map((handle) => {
              const bounds = handle.getBoundingClientRect();
              return {
                width: bounds.width,
                height: bounds.height,
                background: getComputedStyle(handle).backgroundColor,
                centeredOnBand: Boolean(bandBounds
                  && Math.abs(bounds.top + bounds.height / 2 - (bandBounds.top + bandBounds.height / 2)) < 1),
              };
            });
          });
          if (priorReview.length !== 2 || priorReview.some((handle) => (
            handle.width < 44 || handle.height < 44 || !handle.centeredOnBand
            || handle.background !== 'rgba(0, 0, 0, 0)'
          ))) {
            throw new Error(`${scenario.name} does not show transparent 44px prior handles on the credibility band.`);
          }
          await page.locator('.inquiry-focus .prior-handle-min').hover();
          const hoveredBackground = await page.locator('.inquiry-focus .prior-handle-min').evaluate((handle) => (
            getComputedStyle(handle).backgroundColor
          ));
          if (hoveredBackground !== 'rgba(0, 0, 0, 0)') {
            throw new Error(`${scenario.name} paints a prior-handle hit area on hover.`);
          }
          const priorPath = resolve(options.outputDir, 'shared-dom-prior-handles-mobile-dark.png');
          await page.locator('.inquiry-focus .prior-track').screenshot({ path: priorPath });
          output.push(priorPath);
        }
        target = await openEvidenceDrawer(page, { graphPrepared: true });
        const controlReview = await target.evaluate((drawer) => {
          const arrow = drawer.querySelector('.inquiry-force-arrow:not([hidden])');
          return {
            arrow: arrow && {
              width: arrow.getBoundingClientRect().width,
              color: getComputedStyle(arrow).color,
              zIndex: getComputedStyle(arrow.parentElement).zIndex,
            },
          };
        });
        if (!controlReview.arrow || controlReview.arrow.width <= 0 || controlReview.arrow.color === 'rgba(0, 0, 0, 0)'
          || controlReview.arrow.zIndex !== '2') {
          throw new Error(`${scenario.name} does not show a painted conditional-strength arrow.`);
        }
        const impact = target.locator('.inquiry-evidence-impact-preview');
        await impact.waitFor();
        const endpointLabels = impact.locator(
          '.inquiry-flow-ruler.is-secondary .inquiry-flow-ruler-label',
        );
        if (await endpointLabels.count() !== 2) {
          throw new Error(`${scenario.name} must show before and current probability endpoints.`);
        }
        if (scenario.name === 'shared-dom-impact-mobile-dark.png') {
          const readPremiseCondition = () => target.evaluate((drawer) => {
            const checked = drawer.querySelector('button[data-premise-state]');
            const input = drawer.querySelector('.inquiry-conditional-strength-input');
            const conditionalLabel = drawer.querySelector('.inquiry-impact-conditional-label');
            const weight = drawer.querySelector('.inquiry-impact-weight-percent');
            return {
              checked: checked?.getAttribute('data-premise-state'),
              checkedCount: drawer.querySelectorAll('button[data-premise-state]').length,
              rangeValue: input instanceof HTMLInputElement ? input.value : undefined,
              conditionalLabel: conditionalLabel?.textContent,
              weight: weight?.textContent,
              focused: document.activeElement?.getAttribute('data-premise-state'),
              visibleLabel: checked?.querySelector('.inquiry-premise-state-value')?.textContent,
              accessibleName: checked?.getAttribute('aria-label'),
            };
          });
          const beforeCondition = await readPremiseCondition();
          if (beforeCondition.checked !== 'true' || beforeCondition.checkedCount !== 1
            || beforeCondition.visibleLabel !== 'true' || beforeCondition.accessibleName !== 'Premise condition: true. Change to false'
            || !beforeCondition.rangeValue || !beforeCondition.conditionalLabel || !beforeCondition.weight) {
            throw new Error(`${scenario.name} does not show an initialized true premise condition.`);
          }
          await target.locator('button[data-premise-state]').click();
          await settle(page);
          const falseCondition = await readPremiseCondition();
          if (falseCondition.checked !== 'false' || falseCondition.checkedCount !== 1
            || falseCondition.visibleLabel !== 'false' || falseCondition.accessibleName !== 'Premise condition: false. Change to true'
            || falseCondition.rangeValue !== beforeCondition.rangeValue
            || falseCondition.conditionalLabel === beforeCondition.conditionalLabel
            || falseCondition.weight === beforeCondition.weight
            || falseCondition.focused !== 'false') {
            throw new Error(`${scenario.name} does not apply the false premise condition through the detail panel.`);
          }
          await target.locator('button[data-premise-state]').press('Space');
          await settle(page);
          const restoredCondition = await readPremiseCondition();
          if (restoredCondition.checked !== 'true' || restoredCondition.checkedCount !== 1
            || restoredCondition.visibleLabel !== 'true' || restoredCondition.accessibleName !== 'Premise condition: true. Change to false'
            || restoredCondition.rangeValue !== beforeCondition.rangeValue
            || restoredCondition.conditionalLabel !== beforeCondition.conditionalLabel
            || restoredCondition.weight !== beforeCondition.weight
            || restoredCondition.focused !== 'true') {
            throw new Error(`${scenario.name} does not restore the true premise condition through the detail panel.`);
          }
          const premisePath = resolve(options.outputDir, 'shared-dom-premise-toggle-mobile-dark.png');
          await target.locator('.inquiry-evidence-panel-premise').screenshot({ path: premisePath });
          output.push(premisePath);
        }
        if (scenario.colorScheme === 'dark') {
          await impact.scrollIntoViewIfNeeded();
          target = impact;
        }
      } else {
        await prepareGraph(page);
        target = page.locator('.inquiry-focus');
        await target.scrollIntoViewIfNeeded();
      }
      const path = resolve(options.outputDir, scenario.name);
      await target.screenshot({ path });
      await assertCleanPage(page, errors, scenario.name);
      output.push(path);
    } finally { await context.close(); }
  }
  return output;
}

async function captureSocialPreviewImage(browser, options) {
  const outputPath = resolve(options.outputDir, 'demo/social-preview.png');
  await captureSocialPreview({ browser, url: options.url, outputPath });
  return outputPath;
}

async function captureStandardPngs(browser, options) {
  const pngs = await capturePngs(browser, options);
  pngs.push(await captureSocialPreviewImage(browser, options));
  return pngs;
}

async function captureReadmeMedia(browser, options) {
  if (options.socialOnly) {
    return { pngs: [await captureSocialPreviewImage(browser, options)], gifs: [] };
  }
  const rootDirectory = resolve(options.outputDir, 'images');
  const domDirectory = resolve(options.outputDir, 'docs/images/evidence-diagrams-dom');
  await Promise.all([mkdir(rootDirectory, { recursive: true }), mkdir(domDirectory, { recursive: true })]);
  const pngs = options.gifsOnly ? [] : [
    ...await capturePngs(browser, { ...options, outputDir: rootDirectory }),
    ...await captureDomReadme(browser, { ...options, outputDir: domDirectory }),
    await captureSocialPreviewImage(browser, options),
  ];
  const gifs = options.pngsOnly ? [] : [
    await captureChangingPrior(browser, { ...options, outputDir: rootDirectory }),
    await captureAdjustingEvidenceStrength(browser, { ...options, outputDir: rootDirectory }),
  ];
  return { pngs, gifs };
}

async function captureDomReadme(browser, options) {
  const output = [];
  const captures = [
    {
      name: 'credibility-axis-light.png',
      label: 'DOM README credibility axis',
      prepare: async (page) => {
        await prepareGraph(page, { trailExpanded: true });
        return page.locator('.inquiry-focus .inquiry-flow-axis.is-prior');
      },
      colorScheme: 'light',
    },
    {
      name: 'evidence-summary-light.png',
      label: 'DOM README evidence summary',
      prepare: async (page) => {
        await prepareGraph(page, { trailExpanded: false });
        return page.locator('.inquiry-graph-toggle .collapsed-evidence-summary');
      },
      colorScheme: 'light',
    },
    {
      name: 'evidence-impact-dark.png',
      label: 'DOM README evidence impact',
      prepare: async (page) => {
        await prepareGraph(page);
        const drawer = await openEvidenceDrawer(page, { graphPrepared: true });
        return drawer.locator('.inquiry-evidence-impact-preview');
      },
      colorScheme: 'dark',
    },
  ];
  for (const capture of captures) {
    const { page, context, errors } = await createPage(browser, options.url, {
      viewport: { width: 760, height: 620 }, colorScheme: capture.colorScheme, locale: 'en-US',
    });
    try {
      const target = await capture.prepare(page);
      await target.waitFor();
      await target.scrollIntoViewIfNeeded();
      const path = resolve(options.outputDir, capture.name);
      if (capture.name === 'credibility-axis-light.png') {
        const clip = await target.evaluate((axis) => {
          const elements = [axis, ...axis.querySelectorAll('.inquiry-flow-ruler, .inquiry-flow-axis-track, .inquiry-prior-handle')];
          const bounds = elements
            .map((element) => element.getBoundingClientRect())
            .filter(({ width, height }) => width > 0 && height > 0);
          if (!bounds.length) throw new Error('The credibility axis has no visible bounds.');
          const padding = 12;
          const left = Math.max(0, Math.min(...bounds.map(({ left: value }) => value)) - padding);
          const top = Math.max(0, Math.min(...bounds.map(({ top: value }) => value)) - padding);
          const right = Math.max(...bounds.map(({ right: value }) => value)) + padding;
          const bottom = Math.max(...bounds.map(({ bottom: value }) => value)) + padding;
          return { x: left, y: top, width: right - left, height: bottom - top };
        });
        await page.screenshot({ path, clip });
      } else {
        await target.screenshot({ path });
      }
      await assertCleanPage(page, errors, capture.label);
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
  const input = resolve(frameDirectory, 'frame-%04d.png');
  const palette = resolve(frameDirectory, 'palette.png');
  await run(ffmpegPath, [
    '-y', '-threads', '1', '-filter_threads', '1', '-framerate', String(FRAME_RATE), '-i', input,
    '-vf', "fps=20,scale='min(960,iw)':-2:flags=lanczos,palettegen=max_colors=64:stats_mode=diff", palette,
  ]);
  await run(ffmpegPath, [
    '-y', '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1', '-framerate', String(FRAME_RATE), '-i', input, '-i', palette,
    '-filter_complex', "[0:v]fps=20,scale='min(960,iw)':-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
    '-gifflags', '+transdiff', '-fps_mode', 'passthrough', '-loop', '0', outputPath,
  ]);
}

async function validateGif(ffmpegPath, path, expectedFrames) {
  const ffprobePath = ffmpegPath.includes('/') ? resolve(dirname(ffmpegPath), 'ffprobe') : 'ffprobe';
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
  if (duration < 8 || duration > 10) throw new Error(`${path} is ${duration}s; expected 8–10s.`);
  const [rateNumerator, rateDenominator] = String(stream.avg_frame_rate).split('/').map(Number);
  if (Math.abs(rateNumerator / rateDenominator - FRAME_RATE) > 0.01) {
    throw new Error(`${path} is ${stream.avg_frame_rate} fps; expected ${FRAME_RATE} fps.`);
  }
  if (size > 2_500_000) throw new Error(`${path} is ${size} bytes; expected at most 2.5 MB.`);
  return { path, width: Number(stream.width), height: Number(stream.height), frames, duration, size };
}

async function captureChangingPrior(browser, options) {
  const { page, context, errors } = await createPage(browser, options.url, {
    viewport: { width: 1000, height: 900 },
  });
  const output = resolve(options.outputDir, 'changing-inquiry-prior.gif');
  let frames;
  try {
    frames = await mkdtemp(resolve(tmpdir(), 'evidence-diagrams-prior-'));
    await prepareGraph(page, { trailExpanded: false });
    const target = page.locator('.inquiry-focus');
    await target.scrollIntoViewIfNeeded();
    const writer = await createFrameWriter(page, frames, target);
    await writer.capture(framesFor(1.5));

    const handle = page.locator('.prior-handle-max');
    const box = await handle.boundingBox();
    if (!box) throw new Error('The upper prior handle is not visible.');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    const movementSamples = 60;
    for (let step = 1; step <= movementSamples; step += 1) {
      const progress = step / movementSamples;
      const eased = (1 - Math.cos(Math.PI * progress)) / 2;
      await page.mouse.move(startX + eased * 120, startY);
      await settle(page);
      await writer.capture();
    }
    await page.mouse.up();
    await settle(page);
    await writer.capture(framesFor(1.8));
    const reset = page.locator('.inquiry-prior-reset');
    await reset.click();
    await settle(page);
    await writer.capture(framesFor(GIF_DURATION_SECONDS) - writer.count());
    await assertCleanPage(page, errors, 'Changing prior');
    await encodeGif(options.ffmpegPath, frames, output);
    return validateGif(options.ffmpegPath, output, writer.count());
  } finally {
    if (frames) await rm(frames, { recursive: true, force: true });
    await context.close();
  }
}

async function captureAdjustingEvidenceStrength(browser, options) {
  const { page, context, errors } = await createPage(browser, options.url, {
    viewport: { width: 1280, height: 900 },
  });
  const output = resolve(options.outputDir, 'adjusting-evidence-strength.gif');
  let frames;
  try {
    frames = await mkdtemp(resolve(tmpdir(), 'evidence-diagrams-strength-'));
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
    await writer.capture(framesFor(1.5));

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
    const steps = Math.min(24, direction > 0 ? availableRight : range.value - range.minimum);
    const trackInset = Math.min(12, box.width / 4);
    const trackWidth = Math.max(1, box.width - 2 * trackInset);
    const startX = box.x + trackInset
      + (range.value - range.minimum) / (range.maximum - range.minimum) * trackWidth;
    const startY = box.y + box.height / 2;
    const pixelsPerDeciban = trackWidth / (range.maximum - range.minimum);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    const movementSamples = 60;
    for (let sample = 1; sample <= movementSamples; sample += 1) {
      const progress = sample / movementSamples;
      const eased = (1 - Math.cos(Math.PI * progress)) / 2;
      await page.mouse.move(startX + direction * steps * eased * pixelsPerDeciban, startY);
      await settle(page);
      const value = Number(await input.inputValue());
      if (!Number.isInteger(value)) throw new Error(`Conditional strength did not snap to 1 dBan: ${value}.`);
      await writer.capture();
    }
    await page.mouse.up();
    await settle(page);
    const changedValue = Number(await input.inputValue());
    if (Math.abs(changedValue - range.value) < 8) {
      throw new Error(`Conditional strength moved by only ${changedValue - range.value} dBan.`);
    }
    await writer.capture(framesFor(1.8));

    await panel.locator('.inquiry-conditional-strength-reset').click();
    await settle(page);
    await writer.capture(framesFor(GIF_DURATION_SECONDS) - writer.count());

    await assertCleanPage(page, errors, 'Adjusting evidence strength');
    await encodeGif(options.ffmpegPath, frames, output);
    return validateGif(options.ffmpegPath, output, writer.count());
  } finally {
    if (frames) await rm(frames, { recursive: true, force: true });
    await context.close();
  }
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
    const readmeMedia = (options.readmeMedia || options.socialOnly)
      ? await captureReadmeMedia(browser, options)
      : undefined;
    const pngs = readmeMedia?.pngs
      ?? (options.sharedDomReview
        ? await captureSharedDomReview(browser, options)
        : options.gifsOnly ? [] : await captureStandardPngs(browser, options));
    const gifs = readmeMedia?.gifs
      ?? (options.pngsOnly || options.sharedDomReview ? [] : [
        await captureChangingPrior(browser, options),
        await captureAdjustingEvidenceStrength(browser, options),
      ]);
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
