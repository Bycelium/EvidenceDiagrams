import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Captures the public social preview with an already-running Playwright browser. */
export async function captureSocialPreview({ browser, url, outputPath }) {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.locator('#inquiry-session-notice-acknowledge').check();
    await page.locator('#inquiry-session-notice-dismiss').click();
    await page.addStyleTag({ content: 'main.inquiry-page { width: 1120px; max-width: none; margin: 0 auto; zoom: 1; } .inquiry-claim-description { visibility: hidden; }' });
    await page.locator('#inquiry-root-list [data-action="add-root"]').click();
    await page.locator('[name="rootTitle"]').fill('How credible is this claim?');
    await page.locator('[name="rootDescription"]').fill('A short inquiry that weighs supporting findings and a documented limitation.');
    await page.locator('#inquiry-dialog-submit').click();

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

    for (const selector of [
      '.inquiry-focus-heading[data-action="toggle-claim"]',
      '.inquiry-graph-toggle[data-action="toggle-graph"]',
      '.inquiry-trail-toggle',
    ]) {
      const toggle = page.locator(selector);
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.evaluate(() => {
      const combined = [...document.querySelectorAll('.inquiry-graph-toggle')].find((element) => (
        element.closest('.inquiry-focus')?.textContent?.includes('How credible is this claim?')
      ));
      if (!(combined instanceof HTMLElement)) throw new Error('The new inquiry graph was not rendered.');
      const diagram = combined.closest('.inquiry-diagram');
      if (!(diagram instanceof HTMLElement)) throw new Error('The new inquiry diagram was not rendered.');
      const { height } = diagram.getBoundingClientRect();
      const availableHeight = window.innerHeight - 48;
      const scale = Math.min(1, availableHeight / height);
      const inquiry = document.querySelector('main.inquiry-page');
      if (!(inquiry instanceof HTMLElement)) throw new Error('The inquiry page was not rendered.');
      inquiry.style.zoom = String(scale);
    });
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.evaluate(() => {
      const combined = [...document.querySelectorAll('.inquiry-graph-toggle')].find((element) => (
        element.closest('.inquiry-focus')?.textContent?.includes('How credible is this claim?')
      ));
      if (!(combined instanceof HTMLElement)) throw new Error('The new inquiry graph was not rendered after fitting.');
      const diagram = combined.closest('.inquiry-diagram');
      if (!(diagram instanceof HTMLElement)) throw new Error('The new inquiry diagram was not rendered after fitting.');
      window.scrollBy(0, diagram.getBoundingClientRect().top - 24);
    });
    await page.mouse.move(5, 5);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.evaluate(() => {
      const combined = [...document.querySelectorAll('.inquiry-graph-toggle')].find((element) => (
        element.closest('.inquiry-focus')?.textContent?.includes('How credible is this claim?')
      ));
      const diagram = combined?.closest('.inquiry-diagram');
      if (!(diagram instanceof HTMLElement)) {
        throw new Error('The social preview graph region was not rendered.');
      }
      const bounds = diagram.getBoundingClientRect();
      const margin = 16;
      if (bounds.top < margin || bounds.left < margin || bounds.right > window.innerWidth - margin || bounds.bottom > window.innerHeight - margin) {
        throw new Error(`Social preview graph is clipped: ${JSON.stringify(bounds.toJSON())}.`);
      }
    });
    await mkdir(dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath });
    if (errors.length) throw new Error(`Social preview produced page errors:\n${errors.join('\n')}`);

    const preview = await readFile(outputPath);
    const width = preview.readUInt32BE(16);
    const height = preview.readUInt32BE(20);
    if (width !== 1200 || height !== 630) {
      throw new Error(`Social preview must be 1200×630px, received ${width}×${height}px.`);
    }
    return { path: outputPath, width, height };
  } finally { await context.close(); }
}
