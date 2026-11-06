import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInquiryBandGeometry,
  credibilityDisplayBounds,
  editBandEndpoint,
} from './geometry.js';

test('band geometry preserves pure narrowing and widening', () => {
  const geometry = buildInquiryBandGeometry([
    { lower: -6, upper: 6 },
    { lower: -2, upper: 2 },
    { lower: -10, upper: 10 },
  ], 20);
  assert.ok(geometry.bands[1].width < geometry.bands[0].width);
  assert.ok(geometry.bands[2].width > geometry.bands[0].width);
  assert.equal(geometry.bands[0].center, geometry.bands[1].center);
  assert.equal(geometry.bands[1].center, geometry.bands[2].center);
});

test('band geometry positions shifted intervals on a shared scale', () => {
  const geometry = buildInquiryBandGeometry([
    { lower: -4, upper: 2 },
    { lower: 3, upper: 9 },
  ], 20);
  assert.ok(geometry.bands[0].center < geometry.bands[1].center);
  assert.equal(geometry.bands[0].width, geometry.bands[1].width);
});

test('band geometry keeps the calculator axis fixed and marks clipped endpoints', () => {
  const first = buildInquiryBandGeometry([{ lower: -5, upper: 5 }], 20);
  const second = buildInquiryBandGeometry([{ lower: -100, upper: 120 }, { lower: 25, upper: 30 }], 20);
  assert.deepEqual([first.minimum, first.maximum], [-40, 40]);
  assert.deepEqual([second.minimum, second.maximum], [-40, 40]);
  assert.equal(second.bands[0].clippedMinimum, true);
  assert.equal(second.bands[0].clippedMaximum, true);
  assert.equal(second.bands[0].width, 100);
});

test('band geometry follows the shared saturation threshold', () => {
  const geometry = buildInquiryBandGeometry([{ lower: -5, upper: 5 }], 12);
  assert.deepEqual([geometry.minimum, geometry.maximum], [-24, 24]);
});

test('editing one endpoint preserves the opposite endpoint outside the visible domain', () => {
  const band = { lower: -15, upper: 15 };
  assert.deepEqual(editBandEndpoint(band, 'lower', -8, -10, 10), {
    lower: -8,
    upper: 15,
  });
  assert.deepEqual(editBandEndpoint(band, 'upper', 8, -10, 10), {
    lower: -15,
    upper: 8,
  });
  assert.deepEqual(editBandEndpoint(band, 'lower', -20, -10, 10), {
    lower: -10,
    upper: 15,
  });
});

test('credibility display selects conservative posterior band bounds', () => {
  const band = { lower: -15, upper: 15 };
  assert.deepEqual(credibilityDisplayBounds(band, 2), [
    { decibans: -15, direction: 'lower' },
  ]);
  assert.deepEqual(credibilityDisplayBounds(band, -2), [
    { decibans: 15, direction: 'upper' },
  ]);
  assert.deepEqual(credibilityDisplayBounds(band, 0), [
    { decibans: -15, direction: 'lower' },
    { decibans: 15, direction: 'upper' },
  ]);
  assert.deepEqual(credibilityDisplayBounds({ lower: 4, upper: 4 }, 0), [
    { decibans: 4, direction: 'exact' },
  ]);
});
