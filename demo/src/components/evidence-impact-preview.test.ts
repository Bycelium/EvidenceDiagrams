import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceImpactPreviewGeometry } from './evidence-impact-preview.ts';

test('impact preview centers a positive off-main-axis arrow tail in its local viewport', () => {
  const geometry = buildEvidenceImpactPreviewGeometry({ mean: 80, standardDeviation: 1 }, 12, 15);
  assert.equal(geometry.minimum, 35);
  assert.equal(geometry.maximum, 95);
  assert.equal(geometry.position.left, 70);
});

test('impact preview keeps a large opposing arrow and its endpoint in view', () => {
  const geometry = buildEvidenceImpactPreviewGeometry({ mean: -90, standardDeviation: 2 }, -70, 15);
  assert.equal(geometry.minimum, -101.5);
  assert.equal(geometry.maximum, 73.5);
  assert.equal((-14 - geometry.minimum) / (geometry.maximum - geometry.minimum) * 100, 50);
  assert.equal((-84 - geometry.minimum) / (geometry.maximum - geometry.minimum) * 100, 10);
});

test('zero selected mean shift centers its posterior tail rather than inventing an arrow', () => {
  const geometry = buildEvidenceImpactPreviewGeometry({ mean: 75, standardDeviation: 2 }, 0, 15);
  assert.deepEqual([geometry.minimum, geometry.maximum], [45, 105]);
});

test('an explicit force extent keeps current and conditional shifts on one scale', () => {
  const geometry = buildEvidenceImpactPreviewGeometry(
    { mean: 30, standardDeviation: 2 }, 5, 15, 40,
  );
  assert.deepEqual([geometry.minimum, geometry.maximum], [-21, 59]);
  assert.equal((24 - geometry.minimum) / 80 * 100, 56.25);
});
