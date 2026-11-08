import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeCollapsedEvidence } from '../../src/index.ts';

test('collapsed Evidence summary reports signed totals, counts, and display extents', () => {
  assert.deepEqual(summarizeCollapsedEvidence({ meanChanges: [8, -3, 5, -7], extentDecibans: 20 }), {
    netWeightDecibans: 3,
    absoluteWeightDecibans: 23,
    dissonance: 20 / 23,
    supportDecibans: 13,
    oppositionDecibans: 10,
    supportCount: 2,
    oppositionCount: 2,
    supportPercent: 65,
    oppositionPercent: 50,
  });
});

test('collapsed Evidence summary validates finite signed mean changes and extent', () => {
  assert.throws(() => summarizeCollapsedEvidence({ meanChanges: [1, Number.NaN], extentDecibans: 20 }), /finite/);
  assert.throws(() => summarizeCollapsedEvidence({ meanChanges: [1], extentDecibans: 0 }), /finite positive/);
});
