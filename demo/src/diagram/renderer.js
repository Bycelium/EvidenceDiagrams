import {
  DEFAULT_COLOR_OPTIONS,
  evidenceStrengthColor,
} from '@bycelium/evidence-diagrams';
import { gaussianToBand } from '@bycelium/evidence-diagrams/propagation-math';
import { diagonalArrowPoints } from './arrow-geometry.js';
import { buildInquiryBandGeometry } from './geometry.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function pointsAttribute(points) {
  return points?.map(({ x, y }) => `${x},${y}`).join(' ');
}

export function inquiryStepTone(before, after) {
  const deltaMean = after.mean - before.mean;
  if (deltaMean !== 0) return deltaMean > 0 ? 'support' : 'oppose';
  return 'neutral';
}

export function inquiryStepColor(
  before,
  after,
  saturationThresholdDecibans = DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans,
) {
  const deltaMean = after.mean - before.mean;
  const directionalWeight = deltaMean === 0
    ? 0
    : Math.sign(deltaMean) * saturationThresholdDecibans;
  return evidenceStrengthColor({
    netWeightDecibans: directionalWeight,
    absoluteWeightDecibans: Math.abs(directionalWeight),
    dissonance: 0,
  }, { saturationThresholdDecibans });
}

function wrappedTextLines(text, viewportWidth, characterWidth) {
  const availableWidth = Math.max(120, viewportWidth - 32);
  const charactersPerLine = Math.max(16, Math.floor(availableWidth / characterWidth));
  const words = text.trim().split(/\s+/u);
  let lines = 1;
  let length = 0;
  for (const word of words) {
    if (length === 0) {
      lines += Math.max(0, Math.ceil(word.length / charactersPerLine) - 1);
      length = word.length === 0 ? 0 : (word.length - 1) % charactersPerLine + 1;
    } else if (length + 1 + word.length <= charactersPerLine) {
      length += 1 + word.length;
    } else {
      lines += 1;
      lines += Math.max(0, Math.ceil(word.length / charactersPerLine) - 1);
      length = word.length === 0 ? 0 : (word.length - 1) % charactersPerLine + 1;
    }
  }
  return lines;
}

export function inquiryLabelHeight(label, viewportWidth) {
  if (!label?.title) return 0;
  const titleCharacterWidth = viewportWidth <= 620 ? 7.5 : 8;
  const titleLines = wrappedTextLines(label.title, viewportWidth, titleCharacterWidth);
  const strengthLines = label.strength
    ? wrappedTextLines(label.strength, viewportWidth, 7.2)
    : 1;
  return 54 + (titleLines - 1) * 20 + (strengthLines - 1) * 17;
}

export function inquiryStepLayout(transitionHeight, labelHeight) {
  const transition = Math.max(8, transitionHeight);
  if (labelHeight === 0) {
    return { height: Math.max(18, transition), labelOffset: 0 };
  }
  const labelSpace = labelHeight + 8;
  const height = Math.max(18, transition, labelSpace);
  return {
    height,
    labelOffset: (height - labelHeight) / 2,
  };
}

export function inquiryStepBox(width, yAfter, yBefore) {
  return { x: 0, y: yAfter, width, height: Math.max(0, yBefore - yAfter) };
}

export function inquiryStepBandPoints(
  before, after, yBefore, yTransition, yAfter, width,
) {
  const x = (percentage) => percentage / 100 * width;
  return [
    { x: x(before.left), y: yBefore },
    { x: x(before.left + before.width), y: yBefore },
    { x: x(after.left + after.width), y: yTransition },
    { x: x(after.left + after.width), y: yAfter },
    { x: x(after.left), y: yAfter },
    { x: x(after.left), y: yTransition },
  ];
}

export function inquiryVisualSteps(steps) {
  return [...steps].reverse();
}

export function inquiryTrajectoryBandPositions(bands, { minimum, maximum }) {
  const domain = maximum - minimum;
  return bands.map(({ lower, upper }) => ({
    left: (lower - minimum) / domain * 100,
    width: (upper - lower) / domain * 100,
    center: ((lower + upper) / 2 - minimum) / domain * 100,
  }));
}

export function renderInquiryTrajectory(
  i18n, evaluation, saturationThresholdDecibans, viewportWidth = 600, labels = [],
) {
  const gaussians = [evaluation.prior, ...evaluation.steps.map(({ after }) => after)];
  const bands = gaussians.map((gaussian) => gaussianToBand(gaussian));
  const geometry = buildInquiryBandGeometry(bands, saturationThresholdDecibans);
  const trajectoryPositions = inquiryTrajectoryBandPositions(bands, geometry);
  const width = viewportWidth;
  const top = 5;
  const visualSteps = inquiryVisualSteps(evaluation.steps);
  const transitionHeights = visualSteps.map((step, visualIndex) => {
    const index = evaluation.steps.length - visualIndex - 1;
    const before = trajectoryPositions[index];
    const after = trajectoryPositions[index + 1];
    return Math.max(8,
      Math.abs(after.left - before.left) / 100 * width,
      Math.abs(after.left + after.width - before.left - before.width) / 100 * width);
  });
  const stepLayouts = visualSteps.map((step, visualIndex) => {
    const index = evaluation.steps.length - visualIndex - 1;
    const labelHeight = inquiryLabelHeight(labels[index], viewportWidth);
    return inquiryStepLayout(transitionHeights[visualIndex], labelHeight);
  });
  const yPositions = [top];
  for (const { height: stepHeight } of stepLayouts) {
    yPositions.push(yPositions.at(-1) + stepHeight);
  }
  const height = Math.max(18, yPositions.at(-1) + top);
  const x = (percentage) => percentage / 100 * width;
  const svg = svgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': i18n.t('inquiry.trajectoryAria'),
  });
  svg.style.height = `${height}px`;
  const bandY = Array(trajectoryPositions.length);

  visualSteps.forEach((step, visualIndex) => {
    const index = evaluation.steps.length - visualIndex - 1;
    const before = trajectoryPositions[index];
    const after = trajectoryPositions[index + 1];
    const yAfter = yPositions[visualIndex];
    const yBefore = yPositions[visualIndex + 1];
    const yTransition = yBefore - transitionHeights[visualIndex];
    bandY[index + 1] = yAfter;
    bandY[index] = yBefore;
    const tone = inquiryStepTone(step.before, step.after);
    const effectColor = inquiryStepColor(
      step.before, step.after, saturationThresholdDecibans,
    );
    const group = svgElement('g', {
      class: `inquiry-flow-evidence is-${tone}`,
      'data-evidence-id': step.evidenceId,
    });
    svg.append(group);
    group.append(svgElement('rect', {
      class: `inquiry-flow-step is-${tone}`,
      'aria-hidden': 'true',
      ...inquiryStepBox(width, yAfter, yBefore),
    }));
    group.append(svgElement('polygon', {
      class: `inquiry-flow-palette is-${tone}`,
      points: pointsAttribute(inquiryStepBandPoints(
        before, after, yBefore, yTransition, yAfter, width,
      )),
      style: `fill: ${tone === 'neutral' ? 'none' : effectColor}`,
    }));
    for (const [side, x1, x2] of [
      ['minimum', x(before.left), x(after.left)],
      ['maximum', x(before.left + before.width), x(after.left + after.width)],
    ]) {
      const points = diagonalArrowPoints({
        x1,
        y1: yBefore,
        x2,
        y2: yTransition,
        trueEnd: true,
      }, side === 'minimum' ? 'maximum' : 'minimum');
      if (points) group.append(svgElement('polygon', {
        class: `inquiry-flow-arrow is-${tone}`,
        points: pointsAttribute(points),
        style: `fill: ${effectColor}`,
      }));
    }
    for (const [x1, x2] of [
      [x(after.left), x(after.left)],
      [x(after.left + after.width), x(after.left + after.width)],
    ]) {
      group.append(svgElement('line', {
        class: 'inquiry-flow-connector', x1, x2, y1: yAfter, y2: yTransition,
      }));
    }
    const label = labels[index];
    if (label) {
      const labelHeight = inquiryLabelHeight(label, viewportWidth);
      const layout = stepLayouts[visualIndex];
      const foreignObject = svgElement('foreignObject', {
        class: 'inquiry-flow-label',
        x: 0,
        y: yAfter + layout.labelOffset,
        width,
        height: labelHeight,
      });
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `inquiry-flow-label-button is-${tone}`;
      const title = document.createElement('span');
      title.className = 'inquiry-flow-label-title';
      title.textContent = label.title;
      const strengthLabel = document.createElement('span');
      strengthLabel.className = 'inquiry-flow-label-strength';
      strengthLabel.textContent = label.strength;
      strengthLabel.style.setProperty('--effect-color', label.strengthColor);
      button.append(title, strengthLabel);
      foreignObject.append(button);
      group.append(foreignObject);
    }
  });

  trajectoryPositions.forEach((band, index) => {
    const y = bandY[index] ?? top;
    svg.append(svgElement('line', {
      class: `inquiry-flow-band${index === 0 ? ' is-prior' : ''}`,
      x1: x(band.left), x2: x(band.left + band.width), y1: y, y2: y,
    }));
    if (band.width === 0) {
      svg.append(svgElement('circle', {
        class: 'inquiry-flow-point', cx: x(band.center), cy: y, r: 3,
      }));
    }
  });
  return { svg, geometry, bands };
}

export function inquiryResultantSegments(evaluation) {
  const beforeBand = gaussianToBand(evaluation.prior);
  const afterBand = gaussianToBand(evaluation.posterior);
  const tone = inquiryStepTone(evaluation.prior, evaluation.posterior);
  const meanShift = evaluation.posterior.mean - evaluation.prior.mean;
  if (Math.abs(meanShift) > 1e-12) {
    const endpoint = meanShift > 0 ? 'lower' : 'upper';
    return [{ start: beforeBand[endpoint], end: afterBand[endpoint], tone }];
  }
  return ['lower', 'upper']
    .map((endpoint) => ({ start: beforeBand[endpoint], end: afterBand[endpoint], tone }))
    .filter(({ start, end }) => Math.abs(end - start) > 1e-12);
}

function uniqueConnectionSegments(segments) {
  const seen = new Set();
  return segments.filter((segment) => {
    const key = [segment.x1, segment.y1, segment.x2, segment.y2].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function inquiryConnectionGeometry({
  width,
  currentPosition,
  priorPosition,
  currentY,
  priorY,
  expanded,
  trajectoryCurrentY,
  trajectoryPriorY,
  resultantStarts = [],
  minimum,
  maximum,
}) {
  const x = (percentage) => percentage / 100 * width;
  const endpoints = (position) => [
    x(position.left),
    x(position.left + position.width),
  ];
  const current = endpoints(currentPosition);
  const prior = endpoints(priorPosition);
  const boundaries = expanded
    ? [
      ...current.map((coordinate) => ({
        x1: coordinate, y1: currentY, x2: coordinate, y2: trajectoryCurrentY,
      })),
      ...prior.map((coordinate) => ({
        x1: coordinate, y1: trajectoryPriorY, x2: coordinate, y2: priorY,
      })),
    ]
    : current.map((coordinate, index) => ({
      x1: coordinate, y1: currentY, x2: prior[index], y2: priorY,
    }));
  const domain = maximum - minimum;
  const guides = resultantStarts.map((value) => {
    const coordinate = Math.max(0, Math.min(width, (value - minimum) / domain * width));
    return { x1: coordinate, y1: priorY, x2: coordinate, y2: currentY };
  });
  return {
    boundaries: uniqueConnectionSegments(boundaries),
    guides: uniqueConnectionSegments(guides),
  };
}

export function renderInquiryConnections(connectionGeometry, width, height) {
  const svg = svgElement('svg', {
    class: 'inquiry-diagram-connections',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  for (const segment of connectionGeometry.boundaries) {
    svg.append(svgElement('line', {
      class: 'inquiry-diagram-connection',
      ...segment,
    }));
  }
  for (const segment of connectionGeometry.guides) {
    svg.append(svgElement('line', {
      class: 'inquiry-diagram-connection is-resultant-guide',
      ...segment,
    }));
  }
  return svg;
}

export function renderInquiryResultant(evaluation, geometry, viewportWidth, resultantColor) {
  const height = 18;
  const svg = svgElement('svg', {
    class: 'inquiry-resultant-arrow',
    viewBox: `0 0 ${viewportWidth} ${height}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  const rawX = (value) => (
    (value - geometry.minimum) / (geometry.maximum - geometry.minimum) * viewportWidth
  );
  for (const segment of inquiryResultantSegments(evaluation)) {
    const rawStart = rawX(segment.start);
    const rawEnd = rawX(segment.end);
    if ((rawStart < 0 && rawEnd < 0) || (rawStart > viewportWidth && rawEnd > viewportWidth)) continue;
    const start = Math.max(0, Math.min(viewportWidth, rawStart));
    const end = Math.max(0, Math.min(viewportWidth, rawEnd));
    const direction = Math.sign(end - start);
    if (!direction || Math.abs(end - start) < .01) continue;
    const arrowheadVisible = rawEnd >= 0 && rawEnd <= viewportWidth;
    const length = Math.abs(end - start);
    const head = Math.min(18, length, Math.max(5, length * .55));
    const lineEnd = arrowheadVisible ? end - direction * head * .82 : end;
    const line = svgElement('line', {
      class: `inquiry-resultant-line is-${segment.tone}`,
      x1: start,
      y1: height / 2,
      x2: lineEnd,
      y2: height / 2,
    });
    line.style.stroke = resultantColor;
    svg.append(line);
    if (arrowheadVisible) {
      const headShape = svgElement('polygon', {
        class: `inquiry-resultant-head is-${segment.tone}`,
        points: `${end},${height / 2} ${end - direction * head},${height / 2 - head / 2} ${end - direction * head},${height / 2 + head / 2}`,
      });
      headShape.style.fill = resultantColor;
      headShape.style.stroke = resultantColor;
      svg.append(headShape);
    }
  }
  return svg;
}
