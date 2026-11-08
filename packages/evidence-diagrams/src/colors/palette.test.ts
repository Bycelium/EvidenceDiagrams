import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  credibilityAxisColor,
  credibilityBandBackground,
  evidenceStrengthColor,
} from '@bycelium/evidence-diagrams';

test('colors credibility coordinates with an exact neutral prior', () => {
  assert.equal(credibilityAxisColor(0), '#9ca3af');
  assert.equal(credibilityAxisColor(-20), '#ef4444');
  assert.equal(credibilityAxisColor(20), '#22c55e');
  assert.equal(credibilityAxisColor(10), '#4bba79');
  assert.equal(credibilityAxisColor(10, { saturationThresholdDecibans: 10 }), '#22c55e');
  assert.equal(credibilityAxisColor(20, { anchors: { green: '#0000ff' } }), '#0000ff');
});

test('builds a clipped credibility-band gradient from the same axis colors', () => {
  const background = credibilityBandBackground({ lower: -30, upper: 30 }, {
    minimum: -20,
    maximum: 20,
    saturationThresholdDecibans: 20,
  });
  assert.match(background, /^linear-gradient\(90deg,/u);
  assert.match(background, /#ef4444 0%/u);
  assert.match(background, /#9ca3af 50%/u);
  assert.match(background, /#22c55e 100%/u);
  assert.equal(credibilityBandBackground({ lower: 2, upper: 2 }, {
    minimum: -20,
    maximum: 20,
  }), credibilityAxisColor(2));
});

test('colors individual evidence strength independently of claim priors', () => {
  const weak = { netWeightDecibans: -2, absoluteWeightDecibans: 2, dissonance: 0 };
  const strong = { netWeightDecibans: -20, absoluteWeightDecibans: 20, dissonance: 0 };
  assert.equal(evidenceStrengthColor(weak), '#a796a1');
  assert.equal(evidenceStrengthColor(strong), '#ef4444');
  assert.equal(evidenceStrengthColor(strong, {
    saturationThresholdDecibans: 40,
  }), '#c6747a');
  assert.equal(evidenceStrengthColor(strong, {
    anchors: { red: '#0000ff' },
  }), '#0000ff');
});

test('rejects malformed public palette inputs', () => {
  assert.throws(() => credibilityBandBackground({ lower: 2, upper: 1 }, {
    minimum: -20,
    maximum: 20,
  }), /band/i);
  assert.throws(() => credibilityBandBackground({ lower: 1, upper: 2 }, {
    minimum: 20,
    maximum: 20,
  }), /axis/i);
});
