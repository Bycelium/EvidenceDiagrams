# `@bycelium/evidence-diagrams`

DOM-free calculations for Evidence aggregation, credibility displays, probability bounds, and Inquiry replay in decibans.

See the [repository demonstration](https://github.com/Bycelium/EvidenceDiagrams#readme), [DOM renderer package](https://www.npmjs.com/package/@bycelium/evidence-diagrams-dom), and [release procedure](https://github.com/Bycelium/EvidenceDiagrams/blob/main/docs/releasing.md).

## Install

```bash
pnpm add @bycelium/evidence-diagrams
```

## Calculation API

Each Claim has a Gaussian prior in decibans. Each Evidence relationship names a source Contribution, premise Claim, target Claim, and conditional impact.

```ts
import { evaluateInquiry, type Inquiry } from '@bycelium/evidence-diagrams';

const inquiry: Inquiry = {
  rootClaimId: 'nuclear-higher-mortality',
  claims: [
    { id: 'nuclear-higher-mortality', title: 'Nuclear is dangerous', description: 'Nuclear electricity causes a high number of deaths.', prior: { mean: 0, standardDeviation: 5 } },
    { id: 'normalized-comparison', title: 'Nuclear death rates are far below coal and gas', description: 'Published deaths-per-TWh estimates place nuclear far below coal and gas.', prior: { mean: 8, standardDeviation: 2 } },
  ],
  contributions: [{ id: 'owid-energy-mortality', title: 'Our World in Data: Death rates from energy production per TWh', url: 'https://ourworldindata.org/grapher/death-rates-from-energy-production-per-twh?tab=table' }],
  evidence: [{ id: 'normalized-comparison-effect', contributionId: 'owid-energy-mortality', premiseClaimId: 'normalized-comparison', targetClaimId: 'nuclear-higher-mortality', impact: { deltaMean: -20, deltaStandardDeviation: -0.6 } }],
};

const result = evaluateInquiry(inquiry, { evidenceOrder: 'weakest-first' });
result.claims['nuclear-higher-mortality'].posterior; // { mean, standardDeviation }
```

The evaluator recursively computes each premise probability, then scales the saved conditional impact by the Evidence's selected premise condition. `premiseState: 'true'` is the default and uses the Claim's expected probability; `'false'` uses its complement. The replay step exposes the true `premiseProbability` and selected `premiseWeight`. `weakest-first` orders them by ascending absolute weighted mean shift; ties retain Evidence-array order.

```ts
import { aggregateEvidence, buildEvidenceDiagram, boundProbability } from '@bycelium/evidence-diagrams';

const evidence = [{ id: 'report', weightDecibans: 12 }, { id: 'counter-analysis', weightDecibans: -5 }];
const summary = aggregateEvidence(evidence);
summary.netWeightDecibans; // 7
summary.absoluteWeightDecibans; // 17
summary.dissonance; // 10 / 17

const diagram = buildEvidenceDiagram(evidence);
diagram.resultant.jeffreysBand; // 'moderate'
boundProbability(summary).text; // 'Probability ≥ 13 %'
```

| Export | Purpose |
| --- | --- |
| `aggregateEvidence(weights)` | Returns net weight, absolute weight, and dissonance. |
| `probabilityToDecibans({ probability })` | Converts probability to decibans. |
| `decibansToProbability({ weightDecibans })` | Converts decibans to probability. |
| `boundProbability(summary, options?)` | Returns a conservative, exact, or indeterminate probability. |
| `buildEvidenceDiagram(evidence, options?)` | Returns a render-independent diagram model. |
| `evaluateInquiry(inquiry, options?)` | Replays Evidence impacts through an Inquiry. |
| `jeffreysBand({ weightDecibans })` | Returns the adapted Jeffreys Evidence band. |
| `color`, `triangleColor`, `trianglePosition` | Provide diagram color and triangular-legend values. |
| `credibilityAxisColor`, `credibilityBandBackground` | Color absolute credibility coordinates and interval bands. |
| `evidenceStrengthColor` | Color an individual Evidence impact against an exact neutral prior. |

`EvidenceWeight` has `weightDecibans`. `EvidenceSummary` has `netWeightDecibans`, `absoluteWeightDecibans`, and `dissonance`. `Probability` has `probability`. `ProbabilityBoundsOptions` accepts `minPriorDecibans` and `maxPriorDecibans`. `ColorOptions` adds `saturationThresholdDecibans` and `anchors.gray`, `anchors.yellow`, `anchors.green`, and `anchors.red`.

The default prior interval is `[-15, +15] dBan`, and the default color saturation threshold is `15 dBan`.

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
