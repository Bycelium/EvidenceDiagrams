import assert from 'node:assert/strict';
import test from 'node:test';

import { createI18n } from '../i18n/index.ts';
import { claimEvidenceSummary, formatClaimCredibility } from './claim-card.ts';

test('claim cards use the conservative credibility inequality from the focused claim', () => {
  const i18n = createI18n('en');
  assert.match(formatClaimCredibility(i18n, {
    prior: { mean: 0, standardDeviation: 1 },
    posterior: { mean: 10, standardDeviation: 1 },
  }), /^≥/u);
  assert.match(formatClaimCredibility(i18n, {
    prior: { mean: 0, standardDeviation: 1 },
    posterior: { mean: -10, standardDeviation: 1 },
  }), /^≤/u);
  assert.match(formatClaimCredibility(i18n, {
    prior: { mean: 0, standardDeviation: 1 },
    posterior: { mean: 0, standardDeviation: 2 },
  }), / – /u);
});

test('claim card tint summaries use the claim own evaluated steps', () => {
  assert.deepEqual(claimEvidenceSummary({
    steps: [
      { before: { mean: 0 }, after: { mean: 4 } },
      { before: { mean: 4 }, after: { mean: 1 } },
    ],
  }), {
    netWeightDecibans: 1,
    absoluteWeightDecibans: 7,
    dissonance: 1 - 1 / 7,
  });
});
