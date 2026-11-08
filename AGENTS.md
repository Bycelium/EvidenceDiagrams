# Working agreements

## Package releases

- Keep `@bycelium/evidence-diagrams` free of DOM/SVG renderers, stylesheets,
  and browser-only imports. Its release tags are `vX.Y.Z` and match
  `packages/evidence-diagrams/package.json`.
- Put native DOM and SVG presentations in
  `@bycelium/evidence-diagrams-dom`. Its release tags are `dom-vX.Y.Z` and
  match `packages/evidence-diagrams-dom/package.json` independently.
- Import `@bycelium/evidence-diagrams-dom/styles.css` explicitly. Shared styles
  stay scoped to package components and do not reset global page or font rules.
- Run both packed consumer tests before a release. Publish the archive selected
  by `scripts/release-package.mjs`; unknown or mismatched tags must fail.

## Source organization

- Name helpers after their responsibility. Keep package-private HTML element
  creation in `html-element.ts`, URL validation in `safe-http-url.ts`, and pure
  impact geometry separate from DOM rendering.

## Domain language and dependencies

- Use Bycelium vocabulary for public APIs and documentation: Claim, Contribution, Evidence, credibility, conditional belief, conditional impact, premise weight, and current influence. Keep the Evidence triple explicit where it matters: source Contribution, premise Claim, and target Claim.
- Keep calculation code independent of DOM and demo code. DOM renderers receive consumer formatting, localized text, and interaction callbacks as concrete parameters. The demo owns navigation and state. Add dependency inversion only when an active boundary needs it.
- Prefer named input objects for a new multi-part package API or callback. Retain conventional formatter callbacks and published compatibility signatures unless an intentional versioned change requires otherwise.
- Keep a selected Evidence premise condition explicit. `premiseState: 'true'` uses the premise Claim's probability; `'false'` uses the complementary condition. Replay metadata exposes the true premise probability separately from the applied premise weight.

## Behavior and tests

- Keep package tests focused on observable behavior across responsibility modules. DOM behavior suites import `src/index.ts`, so they exercise the public package boundary.
- Preserve public exports and render output through source reorganizations. Use internal folders for ownership; do not expose internal paths without a supported consumer.
