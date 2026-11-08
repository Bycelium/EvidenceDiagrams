# Releasing packages

The repository publishes two independently versioned packages:

| Package | Tag | Purpose |
| --- | --- | --- |
| `@bycelium/evidence-diagrams` | `vX.Y.Z` | DOM-free calculations and types |
| `@bycelium/evidence-diagrams-dom` | `dom-vX.Y.Z` | Native DOM/SVG presentations and opt-in CSS |

Set the selected package version, run `pnpm check`, and inspect a locally packed archive before publication. The consumer checks pack into temporary directories and remove those archives after validation. A publication packs checked source again; its archive is not represented as the archive previously inspected by a consumer check.

Manual publication requires npm login and the account's required two-factor authentication. Publish the compatible core version before a DOM package that first depends on it:

```bash
pnpm check
npm login
pnpm --filter @bycelium/evidence-diagrams pack --out /tmp/evidence-diagrams-1.2.0.tgz
npm publish /tmp/evidence-diagrams-1.2.0.tgz --access public
pnpm --filter @bycelium/evidence-diagrams-dom pack --out /tmp/evidence-diagrams-dom-1.0.0.tgz
npm publish /tmp/evidence-diagrams-dom-1.0.0.tgz --access public
```

The root workspace is private and cannot be published. Do not pass `--provenance` to a local publication. `workspace:^` packs as the compatible published core range.

The first publication of a package is a separately authorized, authenticated bootstrap of the reviewed source. After that bootstrap, configure that package's GitHub trusted publisher for this repository and [publish.yml](../.github/workflows/publish.yml), then allow direct workflow publication. See npm's [trusted publisher prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites) and [scoped public package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

The fresh core release uses `v1.2.0`; do not reuse the existing `v1.1.1` GitHub release tag.

A GitHub release runs [publish.yml](../.github/workflows/publish.yml). The workflow accepts an exact package tag, runs the full check, packs the selected package, and checks the public npm integrity for that exact package version. It skips publication only when the archive is already identical, and fails for a different archive or a registry error. It accepts `vX.Y.Z` for the core package and `dom-vX.Y.Z` for the DOM package.
