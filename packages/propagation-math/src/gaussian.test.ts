import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyImpact,
  bandToGaussian,
  expectedProbability,
  gaussianToBand,
} from '@bycelium/propagation-math';

function close(actual: number, expected: number, tolerance = 1e-12): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}.`,
  );
}

test('converts between Gaussians and exact three-sigma bands', () => {
  assert.deepEqual(
    gaussianToBand({ mean: 0, standardDeviation: 5 }),
    { lower: -15, upper: 15 },
  );
  assert.deepEqual(
    bandToGaussian({ lower: -15, upper: 15 }),
    { mean: 0, standardDeviation: 5 },
  );
  assert.deepEqual(
    bandToGaussian({ lower: 6, upper: 6 }),
    { mean: 6, standardDeviation: 0 },
  );
});

test('applies signed impacts at a premise probability', () => {
  assert.deepEqual(
    applyImpact(
      { mean: -10, standardDeviation: 2 },
      { deltaMean: 20, deltaStandardDeviation: 2 },
      0.5,
    ),
    { mean: 0, standardDeviation: 3 },
  );
});

test('folds a signed spread impact through zero', () => {
  assert.deepEqual(
    applyImpact(
      { mean: 0, standardDeviation: 2 },
      { deltaMean: 0, deltaStandardDeviation: -6 },
      0.5,
    ),
    { mean: 0, standardDeviation: 1 },
  );
});

test('integrates premise probability over the complete Gaussian', () => {
  close(expectedProbability({ mean: 10, standardDeviation: 2 }), 0.9019365387133964, 1e-11);
  close(expectedProbability({ mean: 10, standardDeviation: 20 }), 0.6794921122706966, 1e-11);
  close(expectedProbability({ mean: -10, standardDeviation: 20 }), 0.3205078877293041, 1e-11);
  close(expectedProbability({ mean: 0, standardDeviation: 200 }), 0.5);
});

test('matches the Bycelium reference integration fixtures', () => {
  for (const [mean, standardDeviation, expected] of [
    [10, 5, 0.8671460895375879],
    [-7, 12, 0.31106539391147475],
    [1, 10000, 0.5000398942156208],
  ] as const) {
    close(expectedProbability({ mean, standardDeviation }), expected, 1e-12);
  }
});

test('handles point beliefs, symmetry, and extreme decibans', () => {
  close(expectedProbability({ mean: 10, standardDeviation: 0 }), 10 / 11);
  assert.equal(expectedProbability({ mean: 10000, standardDeviation: 0 }), 1);
  assert.equal(expectedProbability({ mean: -10000, standardDeviation: 0 }), 0);
  for (const [mean, spread] of [[3, 20], [100, 100], [10, 5]] as const) {
    close(
      expectedProbability({ mean, standardDeviation: spread })
        + expectedProbability({ mean: -mean, standardDeviation: spread }),
      1,
      1e-12,
    );
  }
});

test('reports a numerical failure when the transition cannot be resolved', () => {
  assert.throws(
    () => expectedProbability({ mean: 1e20, standardDeviation: 1e20 }),
    /requested tolerance/i,
  );
});

test('rejects invalid or unrepresentable numeric inputs', () => {
  assert.throws(
    () => gaussianToBand({ mean: Number.MAX_VALUE, standardDeviation: Number.MAX_VALUE }),
    /unrepresentable/i,
  );
  assert.throws(() => bandToGaussian({ lower: 1, upper: -1 }), /lower/i);
  assert.throws(
    () => applyImpact(
      { mean: Number.MAX_VALUE, standardDeviation: 0 },
      { deltaMean: Number.MAX_VALUE, deltaStandardDeviation: 0 },
      1,
    ),
    /unrepresentable/i,
  );
  assert.throws(
    () => expectedProbability({ mean: 0, standardDeviation: -1 }),
    /non-negative/i,
  );
});
