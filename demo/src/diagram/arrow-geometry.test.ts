import assert from 'node:assert/strict';
import test from 'node:test';
import { diagonalArrowPoints } from './arrow-geometry.ts';

test('diagonal arrow geometry retains a pointed true endpoint', () => {
  const points = diagonalArrowPoints({ x1: 20, y1: 0, x2: 8, y2: 40, trueEnd: true }, 'minimum');
  assert.ok(points);
  assert.ok(points.length >= 5);
  assert.deepEqual(points[2], { x: 8, y: 40 });
});

test('vertical boundary movement still produces a directional arrow', () => {
  const points = diagonalArrowPoints({ x1: 20, y1: 0, x2: 20, y2: 40, trueEnd: true }, 'maximum');
  assert.ok(points);
  assert.deepEqual(points[2], { x: 20, y: 40 });
});
