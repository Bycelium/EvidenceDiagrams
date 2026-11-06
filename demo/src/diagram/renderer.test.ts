import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inquiryConnectionGeometry,
  inquiryLabelHeight,
  inquiryResultantSegments,
  inquiryStepBandPoints,
  inquiryStepBox,
  inquiryStepColor,
  inquiryStepLayout,
  inquiryStepTone,
  inquiryTrajectoryBandPositions,
  inquiryVisualSteps,
} from './renderer.ts';

test('directional fills cover the full six-vertex evidence band', () => {
  assert.deepEqual(inquiryStepBandPoints(
    { left: 20, width: 50 },
    { left: 30, width: 40 },
    80,
    30,
    10,
    200,
  ), [
    { x: 40, y: 80 },
    { x: 140, y: 80 },
    { x: 140, y: 30 },
    { x: 140, y: 10 },
    { x: 60, y: 10 },
    { x: 60, y: 30 },
  ]);
});

test('trajectory coordinates retain endpoints beyond the fixed display domain', () => {
  const positions = inquiryTrajectoryBandPositions([
    { lower: 18, upper: 32 },
    { lower: 26, upper: 46 },
    { lower: -46, upper: -26 },
  ], { minimum: -20, maximum: 20 });
  assert.deepEqual(positions.map(({ width, center }) => ({ width, center })), [
    { width: 35, center: 112.5 },
    { width: 50, center: 140 },
    { width: 50, center: -40 },
  ]);
  assert.ok(Math.abs(positions[0].left - 95) < 1e-9);
  assert.ok(Math.abs(positions[1].left - 115) < 1e-9);
  assert.ok(Math.abs(positions[2].left + 65) < 1e-9);
  assert.ok(positions[1].left > 100 && positions[2].left < 0,
    'both edge transitions preserve their actual off-axis slope');
});

test('diagram connections trace credibility bounds and the resultant prior anchor', () => {
  assert.deepEqual(inquiryConnectionGeometry({
    width: 200,
    currentPosition: { left: 25, width: 50 },
    priorPosition: { left: 10, width: 30 },
    currentY: 10,
    priorY: 90,
    expanded: false,
    resultantStarts: [20],
    minimum: -20,
    maximum: 20,
  }), {
    boundaries: [
      { x1: 50, y1: 10, x2: 20, y2: 90 },
      { x1: 150, y1: 10, x2: 80, y2: 90 },
    ],
    guides: [{ x1: 200, y1: 90, x2: 200, y2: 10 }],
  });

  assert.deepEqual(inquiryConnectionGeometry({
    width: 200,
    currentPosition: { left: 50, width: 0 },
    priorPosition: { left: 25, width: 50 },
    currentY: 10,
    priorY: 100,
    expanded: true,
    trajectoryCurrentY: 45,
    trajectoryPriorY: 70,
    minimum: -20,
    maximum: 20,
  }).boundaries, [
    { x1: 100, y1: 10, x2: 100, y2: 45 },
    { x1: 50, y1: 70, x2: 50, y2: 100 },
    { x1: 150, y1: 70, x2: 150, y2: 100 },
  ]);
});

test('inquiry step tones distinguish direction and pure width changes', () => {
  const prior = { mean: 0, standardDeviation: 5 };
  assert.equal(inquiryStepTone(prior, { mean: 2, standardDeviation: 5 }), 'support');
  assert.equal(inquiryStepTone(prior, { mean: -2, standardDeviation: 5 }), 'oppose');
  assert.equal(inquiryStepTone(prior, { mean: 0, standardDeviation: 7 }), 'neutral');
  assert.equal(inquiryStepTone(prior, { mean: 0, standardDeviation: 3 }), 'neutral');
  assert.equal(inquiryStepTone(prior, prior), 'neutral');
});

test('intermediate flow colors are binary for each evidence direction', () => {
  const threshold = 20;
  assert.equal(
    inquiryStepColor(
      { mean: -100, standardDeviation: 5 },
      { mean: -80, standardDeviation: 5 },
      threshold,
    ),
    '#22c55e',
  );
  assert.equal(
    inquiryStepColor(
      { mean: 100, standardDeviation: 5 },
      { mean: 80, standardDeviation: 5 },
      threshold,
    ),
    '#ef4444',
  );
  assert.equal(
    inquiryStepColor(
      { mean: 100, standardDeviation: 5 },
      { mean: 100, standardDeviation: 8 },
      threshold,
    ),
    '#9ca3af',
  );
  assert.equal(
    inquiryStepColor(
      { mean: 0, standardDeviation: 5 },
      { mean: Number.EPSILON, standardDeviation: 5 },
      threshold,
    ),
    '#22c55e',
  );
  assert.equal(
    inquiryStepColor(
      { mean: 0, standardDeviation: 5 },
      { mean: -Number.EPSILON, standardDeviation: 5 },
      threshold,
    ),
    '#ef4444',
  );
});

test('label space and diagonal transitions share one evidence row', () => {
  const transitionDominant = inquiryStepLayout(80, 54);
  assert.deepEqual(transitionDominant, {
    height: 80,
    labelOffset: 13,
  });
  const labelDominant = inquiryStepLayout(8, 54);
  assert.deepEqual(labelDominant, {
    height: 62,
    labelOffset: 4,
  });
  assert.ok(labelDominant.height < 8 + 54 + 8,
    'a modest transition does not extend the row beyond its label space');
  for (const layout of [transitionDominant, labelDominant]) {
    assert.ok(layout.labelOffset >= 0 && layout.labelOffset + 54 <= layout.height,
      'the full label stays inside its evidence row');
    assert.equal(layout.labelOffset + 54 / 2, layout.height / 2,
      'the label remains centered in the available row');
  }
  assert.deepEqual(inquiryStepLayout(8, 0), {
    height: 18,
    labelOffset: 0,
  });
});

test('each evidence step owns its full-width allocated row', () => {
  assert.deepEqual(inquiryStepBox(320, 12, 76), {
    x: 0,
    y: 12,
    width: 320,
    height: 64,
  });
});

test('label height follows wrapped title content without the former row padding', () => {
  const label = { title: 'A complete premise statement that wraps across several lines on a narrow mobile plot.' };
  const narrowHeight = inquiryLabelHeight(label, 280);
  assert.ok(narrowHeight >= 94);
  assert.ok(narrowHeight < 120);
  assert.ok(narrowHeight > inquiryLabelHeight(label, 800));
  assert.equal(inquiryLabelHeight(undefined, 280), 0);
  assert.ok(inquiryLabelHeight({
    ...label,
    strength: 'Variation de l’incertitude (Δσ +0,58 dBan)',
  }, 280) > narrowHeight);
});

test('full-width title rows use their extra width without hiding long mobile titles', () => {
  const label = { title: 'A premise title that needs exactly one extra wrapped line near the old inset' };
  assert.ok(inquiryLabelHeight(label, 320) <= inquiryLabelHeight(label, 288));
  assert.ok(inquiryLabelHeight(label, 320) >= 54);
});

test('visual evidence order places the latest strongest replay step nearest current credibility', () => {
  const steps = [{ evidenceId: 'weak' }, { evidenceId: 'medium' }, { evidenceId: 'strong' }];
  assert.deepEqual(inquiryVisualSteps(steps).map(({ evidenceId }) => evidenceId), [
    'strong', 'medium', 'weak',
  ]);
  assert.deepEqual(steps.map(({ evidenceId }) => evidenceId), ['weak', 'medium', 'strong']);
});

test('resultant uses the active prior endpoint and its actual posterior endpoint', () => {
  assert.deepEqual(inquiryResultantSegments({
    prior: { mean: 0, standardDeviation: 5 },
    posterior: { mean: 2, standardDeviation: 6 },
  }), [{ start: -15, end: -16, tone: 'support' }]);
  assert.deepEqual(inquiryResultantSegments({
    prior: { mean: 0, standardDeviation: 5 },
    posterior: { mean: -2, standardDeviation: 4 },
  }), [{ start: 15, end: 10, tone: 'oppose' }]);
});

test('pure width changes move both credibility endpoints', () => {
  assert.deepEqual(inquiryResultantSegments({
    prior: { mean: 0, standardDeviation: 5 },
    posterior: { mean: 0, standardDeviation: 6 },
  }), [
    { start: -15, end: -18, tone: 'neutral' },
    { start: 15, end: 18, tone: 'neutral' },
  ]);
});
