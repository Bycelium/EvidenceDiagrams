import {
  DEFAULT_COLOR_OPTIONS,
  evidenceStrengthColor,
  type InquiryClaimEvaluation,
} from '@bycelium/evidence-diagrams';
import {
  gaussianToBand,
  type Gaussian,
  type GaussianBand,
} from '@bycelium/evidence-diagrams/propagation-math';
import { diagonalArrowPoints, type DiagramPoint } from './arrow-geometry.ts';
import {
  buildInquiryBandGeometry,
  type InquiryBandGeometry,
} from './geometry.ts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type SvgAttributes = Record<string, string | number | boolean | undefined>;
export type EvidenceTone = 'support' | 'oppose' | 'neutral';
export type InquiryLabel = { title: string; strength?: string; strengthColor?: string };
export type InquiryStepLayout = { height: number; labelOffset: number };
export type InquiryStepBox = { x: number; y: number; width: number; height: number };
export type TrajectoryBandPosition = { left: number; width: number; center?: number };
export type DiagramConnectionSegment = { x1: number; y1: number; x2: number; y2: number };
export type InquiryConnectionGeometry = {
  boundaries: DiagramConnectionSegment[];
  guides: DiagramConnectionSegment[];
};
export type InquiryConnectionOptions = {
  width: number;
  currentPosition: TrajectoryBandPosition;
  priorPosition: TrajectoryBandPosition;
  currentY: number;
  priorY: number;
  expanded: boolean;
  trajectoryCurrentY?: number;
  trajectoryPriorY?: number;
  resultantStarts?: readonly number[];
  minimum: number;
  maximum: number;
};

function svgElement<Tag extends keyof SVGElementTagNameMap>(
  tag: Tag,
  attributes: SvgAttributes = {},
): SVGElementTagNameMap[Tag] {
  const node = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) node.setAttribute(key, String(value));
  }
  return node;
}

function pointsAttribute(points: readonly DiagramPoint[] | null | undefined): string | undefined {
  return points?.map(({ x, y }) => `${x},${y}`).join(' ');
}

export function inquiryStepTone(before: Gaussian, after: Gaussian): EvidenceTone {
  const deltaMean = after.mean - before.mean;
  if (deltaMean !== 0) return deltaMean > 0 ? 'support' : 'oppose';
  return 'neutral';
}

export function inquiryStepColor(
  before: Gaussian,
  after: Gaussian,
  saturationThresholdDecibans: number = DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans,
): string {
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

function wrappedTextLines(text: string, viewportWidth: number, characterWidth: number): number {
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

export function inquiryLabelHeight(label: InquiryLabel | undefined, viewportWidth: number): number {
  if (!label?.title) return 0;
  const titleCharacterWidth = viewportWidth <= 620 ? 7.5 : 8;
  const titleLines = wrappedTextLines(label.title, viewportWidth, titleCharacterWidth);
  const strengthLines = label.strength
    ? wrappedTextLines(label.strength, viewportWidth, 7.2)
    : 1;
  return 54 + (titleLines - 1) * 20 + (strengthLines - 1) * 17;
}

export function inquiryStepLayout(
  transitionHeight: number,
  labelHeight: number,
): InquiryStepLayout {
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

export function inquiryStepBox(width: number, yAfter: number, yBefore: number): InquiryStepBox {
  return { x: 0, y: yAfter, width, height: Math.max(0, yBefore - yAfter) };
}

export function inquiryStepBandPoints(
  before: TrajectoryBandPosition,
  after: TrajectoryBandPosition,
  yBefore: number,
  yTransition: number,
  yAfter: number,
  width: number,
): DiagramPoint[] {
  const x = (percentage: number) => percentage / 100 * width;
  return [
    { x: x(before.left), y: yBefore },
    { x: x(before.left + before.width), y: yBefore },
    { x: x(after.left + after.width), y: yTransition },
    { x: x(after.left + after.width), y: yAfter },
    { x: x(after.left), y: yAfter },
    { x: x(after.left), y: yTransition },
  ];
}

export function inquiryVisualSteps<Step>(steps: readonly Step[]): Step[] {
  return [...steps].reverse();
}

export function inquiryTrajectoryBandPositions(
  bands: readonly GaussianBand[],
  { minimum, maximum }: Pick<InquiryBandGeometry, 'minimum' | 'maximum'>,
): TrajectoryBandPosition[] {
  const domain = maximum - minimum;
  return bands.map(({ lower, upper }) => ({
    left: (lower - minimum) / domain * 100,
    width: (upper - lower) / domain * 100,
    center: ((lower + upper) / 2 - minimum) / domain * 100,
  }));
}

export function renderInquiryTrajectory(
  trajectoryAria: string,
  evaluation: InquiryClaimEvaluation,
  saturationThresholdDecibans: number,
  viewportWidth = 600,
  labels: readonly InquiryLabel[] = [],
): { svg: SVGSVGElement; geometry: InquiryBandGeometry; bands: GaussianBand[] } {
  const gaussians = [evaluation.prior, ...evaluation.steps.map(({ after }) => after)];
  const bands = gaussians.map((gaussian) => gaussianToBand(gaussian));
  const geometry = buildInquiryBandGeometry(bands, saturationThresholdDecibans);
  const trajectoryPositions = inquiryTrajectoryBandPositions(bands, geometry);
  const width = viewportWidth;
  const top = 5;
  const visualSteps = inquiryVisualSteps(evaluation.steps);
  const transitionHeights = visualSteps.map((_step, visualIndex) => {
    const index = evaluation.steps.length - visualIndex - 1;
    const before = trajectoryPositions[index]!;
    const after = trajectoryPositions[index + 1]!;
    return Math.max(8,
      Math.abs(after.left - before.left) / 100 * width,
      Math.abs(after.left + after.width - before.left - before.width) / 100 * width);
  });
  const stepLayouts = visualSteps.map((_step, visualIndex) => {
    const index = evaluation.steps.length - visualIndex - 1;
    const labelHeight = inquiryLabelHeight(labels[index], viewportWidth);
    return inquiryStepLayout(transitionHeights[visualIndex], labelHeight);
  });
  const yPositions = [top];
  for (const { height: stepHeight } of stepLayouts) {
    yPositions.push(yPositions.at(-1)! + stepHeight);
  }
  const height = Math.max(18, yPositions.at(-1)! + top);
  const x = (percentage: number) => percentage / 100 * width;
  const svg = svgElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': trajectoryAria,
  });
  svg.style.height = `${height}px`;
  const bandY: Array<number | undefined> = Array(trajectoryPositions.length);

  visualSteps.forEach((step, visualIndex) => {
    const index = evaluation.steps.length - visualIndex - 1;
    const before = trajectoryPositions[index]!;
    const after = trajectoryPositions[index + 1]!;
    const yAfter = yPositions[visualIndex]!;
    const yBefore = yPositions[visualIndex + 1]!;
    const yTransition = yBefore - transitionHeights[visualIndex]!;
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
    const sides: ReadonlyArray<readonly ['minimum' | 'maximum', number, number]> = [
      ['minimum', x(before.left), x(after.left)],
      ['maximum', x(before.left + before.width), x(after.left + after.width)],
    ];
    for (const [side, x1, x2] of sides) {
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
    const connectors: ReadonlyArray<readonly [number, number]> = [
      [x(after.left), x(after.left)],
      [x(after.left + after.width), x(after.left + after.width)],
    ];
    for (const [x1, x2] of connectors) {
      group.append(svgElement('line', {
        class: 'inquiry-flow-connector', x1, x2, y1: yAfter, y2: yTransition,
      }));
    }
    const label = labels[index];
    if (label) {
      const labelHeight = inquiryLabelHeight(label, viewportWidth);
      const layout = stepLayouts[visualIndex]!;
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
      strengthLabel.textContent = label.strength ?? '';
      if (label.strengthColor) {
        strengthLabel.style.setProperty('--effect-color', label.strengthColor);
      }
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
        class: 'inquiry-flow-point', cx: x(band.center ?? band.left), cy: y, r: 3,
      }));
    }
  });
  return { svg, geometry, bands };
}

export type InquiryResultantSegment = {
  start: number;
  end: number;
  tone: EvidenceTone;
};

export function inquiryResultantSegments(
  evaluation: Pick<InquiryClaimEvaluation, 'prior' | 'posterior'>,
): InquiryResultantSegment[] {
  const beforeBand = gaussianToBand(evaluation.prior);
  const afterBand = gaussianToBand(evaluation.posterior);
  const tone = inquiryStepTone(evaluation.prior, evaluation.posterior);
  const meanShift = evaluation.posterior.mean - evaluation.prior.mean;
  if (Math.abs(meanShift) > 1e-12) {
    const endpoint: keyof GaussianBand = meanShift > 0 ? 'lower' : 'upper';
    return [{ start: beforeBand[endpoint], end: afterBand[endpoint], tone }];
  }
  const endpoints: ReadonlyArray<keyof GaussianBand> = ['lower', 'upper'];
  return endpoints
    .map((endpoint) => ({ start: beforeBand[endpoint], end: afterBand[endpoint], tone }))
    .filter(({ start, end }) => Math.abs(end - start) > 1e-12);
}

function uniqueConnectionSegments(
  segments: readonly DiagramConnectionSegment[],
): DiagramConnectionSegment[] {
  const seen = new Set<string>();
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
}: InquiryConnectionOptions): InquiryConnectionGeometry {
  if (expanded && (trajectoryCurrentY === undefined || trajectoryPriorY === undefined)) {
    throw new TypeError('Expanded connection geometry requires trajectory endpoints.');
  }
  const x = (percentage: number) => percentage / 100 * width;
  const endpoints = (position: TrajectoryBandPosition): [number, number] => [
    x(position.left),
    x(position.left + position.width),
  ];
  const current = endpoints(currentPosition);
  const prior = endpoints(priorPosition);
  const boundaries = expanded
    ? [
      ...current.map((coordinate): DiagramConnectionSegment => ({
        x1: coordinate, y1: currentY, x2: coordinate, y2: trajectoryCurrentY!,
      })),
      ...prior.map((coordinate): DiagramConnectionSegment => ({
        x1: coordinate, y1: trajectoryPriorY!, x2: coordinate, y2: priorY,
      })),
    ]
    : current.map((coordinate, index) => ({
      x1: coordinate, y1: currentY, x2: prior[index]!, y2: priorY,
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

export function renderInquiryConnections(
  connectionGeometry: InquiryConnectionGeometry,
  width: number,
  height: number,
): SVGSVGElement {
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

export function renderInquiryResultant(
  evaluation: Pick<InquiryClaimEvaluation, 'prior' | 'posterior'>,
  geometry: Pick<InquiryBandGeometry, 'minimum' | 'maximum'>,
  viewportWidth: number,
  resultantColor: string,
): SVGSVGElement {
  const height = 18;
  const svg = svgElement('svg', {
    class: 'inquiry-resultant-arrow',
    viewBox: `0 0 ${viewportWidth} ${height}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  const rawX = (value: number) => (
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
