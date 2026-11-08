import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceImpactPreviewGeometry } from '../../src/index.ts';

test('impact geometry follows the selected lower bound and preserves uncertainty movement', () => {
  const geometry = buildEvidenceImpactPreviewGeometry({
    before: { mean: 0, standardDeviation: 5 },
    conditional: { mean: 12, standardDeviation: 3 },
    after: { mean: 6, standardDeviation: 4 },
    premiseWeight: 0.5,
  });

  assert.equal(geometry.selectedBound, 'lower');
  assert.equal(geometry.beforeBound, -15);
  assert.equal(geometry.conditionalBound, 3);
  assert.equal(geometry.currentBound, -6);
  assert.equal(geometry.conditionalMovement, 18);
  assert.equal(geometry.currentMovement, 9);
  assert.equal(geometry.proportionalWeighting, true);
});

test('impact geometry keeps reflected spread endpoints and disables proportional weighting', () => {
  const geometry = buildEvidenceImpactPreviewGeometry({
    before: { mean: 0, standardDeviation: 2 },
    conditional: { mean: 2, standardDeviation: 3 },
    after: { mean: 1, standardDeviation: 0.5 },
    premiseWeight: 0.5,
  });

  assert.equal(geometry.selectedBound, 'lower');
  assert.equal(geometry.conditionalBound, -7);
  assert.equal(geometry.currentBound, -0.5);
  assert.equal(geometry.proportionalWeighting, false);
});
