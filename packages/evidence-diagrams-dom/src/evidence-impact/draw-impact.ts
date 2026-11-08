import { CREDIBILITY_BAND_HEIGHT_REM } from '../credibility/render-axis.ts';
import { IMPACT_LAYOUT } from './calculate-geometry.ts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const REM_PIXELS = 16;
const IMPACT_VIEWBOX_HEIGHT = IMPACT_LAYOUT.trackHeightRem * REM_PIXELS;
const ARROW_BODY_HALF_HEIGHT = CREDIBILITY_BAND_HEIGHT_REM * REM_PIXELS / 2;
const ARROW_HEAD_HALF_HEIGHT = 0.5625 * REM_PIXELS;
const ARROW_TIP_HALF_HEIGHT = 0.04 * REM_PIXELS;
const ARROW_HEAD_LENGTH = 4.5;
const CONNECTOR_WIDTH = 0.5;

function svgElement<Tag extends keyof SVGElementTagNameMap>(
  tag: Tag,
  attributes: Readonly<Record<string, string | number>> = {},
): SVGElementTagNameMap[Tag] {
  const node = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function appendArrow(
  drawing: SVGSVGElement,
  className: string,
  end: number,
  center: number,
): void {
  const origin = 50;
  const length = Math.abs(end - origin);
  if (length <= 1e-12) return;
  const direction = Math.sign(end - origin);
  const headBase = end - direction * Math.min(ARROW_HEAD_LENGTH, length);
  const points = [
    [origin, center - ARROW_BODY_HALF_HEIGHT],
    [headBase, center - ARROW_BODY_HALF_HEIGHT],
    [headBase, center - ARROW_HEAD_HALF_HEIGHT],
    [end, center - ARROW_TIP_HALF_HEIGHT],
    [end, center + ARROW_TIP_HALF_HEIGHT],
    [headBase, center + ARROW_HEAD_HALF_HEIGHT],
    [headBase, center + ARROW_BODY_HALF_HEIGHT],
    [origin, center + ARROW_BODY_HALF_HEIGHT],
  ];
  drawing.append(svgElement('polygon', {
    class: className,
    points: points.map(point => point.join(',')).join(' '),
  }));
}

function appendBar(
  drawing: SVGSVGElement,
  conditionalEnd: number,
  weightedEnd: number,
): void {
  const y = IMPACT_LAYOUT.weightTopRem * REM_PIXELS;
  const height = IMPACT_LAYOUT.weightHeightRem * REM_PIXELS;
  const extentX = Math.min(50, conditionalEnd);
  const extentWidth = Math.abs(conditionalEnd - 50);
  const fillX = Math.min(50, weightedEnd);
  const fillWidth = Math.abs(weightedEnd - 50);
  drawing.append(svgElement('rect', {
    class: 'inquiry-impact-weight-extent', x: extentX, y, width: extentWidth, height,
  }));
  drawing.append(svgElement('rect', {
    class: 'inquiry-impact-weight-fill', x: fillX, y, width: fillWidth, height,
  }));
  if (extentWidth > 1) {
    const horizontalInset = 0.4;
    const verticalInset = 1;
    drawing.append(svgElement('path', {
      class: 'inquiry-impact-weight-frame',
      'fill-rule': 'evenodd',
      d: `M ${extentX} ${y} H ${extentX + extentWidth} V ${y + height} H ${extentX} Z M ${extentX + horizontalInset} ${y + verticalInset} H ${extentX + extentWidth - horizontalInset} V ${y + height - verticalInset} H ${extentX + horizontalInset} Z`,
    }));
  }
}

function impactConnector(
  className: string,
  end: number,
  y: number,
  height: number,
  support: boolean,
): SVGRectElement {
  return svgElement('rect', {
    class: className,
    x: support ? end - CONNECTOR_WIDTH : end,
    y,
    width: CONNECTOR_WIDTH,
    height,
  });
}

function arrowTone(meanShift: number): 'support' | 'opposition' | 'neutral' {
  return meanShift > 1e-12 ? 'support' : meanShift < -1e-12 ? 'opposition' : 'neutral';
}

export function endpoint(origin: number, offset: number): number {
  return Math.max(0, Math.min(100, origin + offset));
}

type EvidenceImpactDrawingInput = {
  readonly conditionalEnd: number;
  readonly weightedEnd: number;
  readonly currentEnd: number;
  readonly direction: string;
  readonly conditionalMeanShift: number;
  readonly currentMeanShift: number;
  readonly proportionalWeighting: boolean;
};

export function renderImpactDrawing({
  conditionalEnd,
  weightedEnd,
  currentEnd,
  direction,
  conditionalMeanShift,
  currentMeanShift,
  proportionalWeighting,
}: EvidenceImpactDrawingInput): SVGSVGElement {
  const conditionalCenter = IMPACT_LAYOUT.conditionalCenterRem * REM_PIXELS;
  const weightTop = IMPACT_LAYOUT.weightTopRem * REM_PIXELS;
  const weightBottom = weightTop + IMPACT_LAYOUT.weightHeightRem * REM_PIXELS;
  const currentCenter = IMPACT_LAYOUT.currentCenterRem * REM_PIXELS;
  const support = conditionalEnd >= 50;
  const drawing = svgElement('svg', {
    class: `inquiry-impact-drawing${direction}`,
    viewBox: `0 0 100 ${IMPACT_VIEWBOX_HEIGHT}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  drawing.append(svgElement('line', {
    class: 'inquiry-impact-origin-guide',
    x1: 50, y1: conditionalCenter, x2: 50, y2: currentCenter,
  }));
  if (proportionalWeighting) {
    drawing.append(
      impactConnector(
        'inquiry-impact-conditional-connector',
        conditionalEnd,
        conditionalCenter,
        weightTop - conditionalCenter,
        support,
      ),
      impactConnector(
        'inquiry-impact-attenuation-connector',
        weightedEnd,
        weightBottom,
        currentCenter - weightBottom,
        support,
      ),
    );
    appendBar(drawing, conditionalEnd, weightedEnd);
  }
  appendArrow(drawing, `inquiry-impact-arrow inquiry-impact-conditional-arrow is-${arrowTone(conditionalMeanShift)}`, conditionalEnd, conditionalCenter);
  appendArrow(drawing, `inquiry-impact-arrow inquiry-impact-current-arrow is-${arrowTone(currentMeanShift)}`, currentEnd, currentCenter);
  return drawing;
}
