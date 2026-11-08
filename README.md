# Evidence Diagrams workspace

Explore how Evidence changes the credibility of a Claim.

[![Core npm version](https://img.shields.io/npm/v/%40bycelium%2Fevidence-diagrams?label=core)](https://www.npmjs.com/package/@bycelium/evidence-diagrams) [![DOM npm version](https://img.shields.io/npm/v/%40bycelium%2Fevidence-diagrams-dom?label=DOM)](https://www.npmjs.com/package/@bycelium/evidence-diagrams-dom)

This workspace contains the independently versioned public packages [`@bycelium/evidence-diagrams`](packages/evidence-diagrams/README.md) and [`@bycelium/evidence-diagrams-dom`](packages/evidence-diagrams-dom/README.md), the private propagation-math workspace, and a standalone demonstration consumer.

[Open the live demo](https://evidence.bycelium.com) · [Download the standalone demo](https://raw.githubusercontent.com/Bycelium/EvidenceDiagrams/main/demo/index.html)

## Demo walkthrough

### 1. Open the Claim and its Evidence summary

<img src="images/inquiry-overview-light.png" width="860" alt="Inquiry overview with the root claim, current credibility, and combined evidence summary.">

The root card starts with the Claim and its current credibility. Open it to reveal **Combined Evidence**, which compares accumulated Countering, dissonance, and Supporting Evidence.

### 2. Expand the diagram

Open the summary to follow every Evidence step from the prior credibility band to the current result.

<img src="images/inquiry-diagram-light.png" width="860" alt="Expanded Inquiry diagram with every Evidence row between the prior and current credibility bands.">

### 3. Change the starting credibility

Use the inner chevron to collapse the Evidence path while keeping the prior and current credibility bands visible. Drag a prior handle to update the Inquiry or use ↺ to restore its starting value.

[![Reveal the Inquiry and change its prior](images/changing-inquiry-prior.gif)](https://evidence.bycelium.com)

### 4. Inspect Evidence and follow its premise

<img src="images/evidence-drawer-light.png" width="960" alt="Evidence drawer with the source Contribution, conditional impact, premise credibility, and current influence.">

Select an Evidence arrow to see its premise, source Contribution, conditional impact, premise credibility, and current influence. Drag the conditional-impact handle to edit the relationship in 1 dBan steps and see its current influence update. Open the premise Claim to continue into its own Evidence subtree.

[![Adjust an Evidence relationship's conditional impact](images/adjusting-evidence-strength.gif)](https://evidence.bycelium.com)

### 5. Start another Inquiry

<img src="images/add-claim-light.png" width="860" alt="Inquiry page with the Add a Claim action above the current root Claim.">

Select **Add a Claim** above the current root to start an Inquiry from a Claim and description, then add Supporting or Countering Evidence with a premise and HTTP(S) source. Switching roots preserves each Inquiry while the demo is open. Shared premises and sources stay identifiable across arguments; correlation between distinct arguments is not inferred automatically.

The live legend follows the selected Claim and its prior. Read the [Inquiry model](docs/inquiry.md), [nuclear-demo source audit](docs/nuclear-sources.md), and [dependence proposals](docs/proposals/evidence-dependence.md) for details.

## Development

```bash
pnpm install
pnpm build:demo
pnpm check
```

`build:demo` regenerates the standalone `demo/index.html` page. It runs in English and French, follows the system color preference with a light fallback, stores explicit theme choices, and remains usable offline when downloaded. To regenerate the favicon PNGs from their editable SVG source, run `pnpm build:demo-assets`; it requires the Inkscape CLI. `check` runs the project checks and both packed-consumer tests. To add a locale, implement the consuming features’ typed message domains under `demo/src/i18n/locales/`, then register the locale in `demo/src/i18n/index.ts`.

Install Chromium once with `pnpm exec playwright install chromium` (see [Playwright browser setup](https://playwright.dev/docs/browsers)). From the repository root, refresh the README screenshots, GIFs, and social preview with `pnpm screenshots`. The capture command defaults to the local pinned Playwright module and `ffmpeg`/`ffprobe` from PATH; non-Nix environments need both executables installed. Pass `--playwright-module`, `--browser-path`, `--url`, or `--ffmpeg-path` only to override them.

For deployment, serve `demo/` as the site root so `index.html`, `robots.txt`, `sitemap.xml`, and the favicon PNGs are available at their root paths. The generated page remains a self-contained offline demo.

Release procedures are in [docs/releasing.md](docs/releasing.md).

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
