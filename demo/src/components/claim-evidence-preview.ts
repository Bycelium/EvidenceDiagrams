import { gaussianToBand, type GaussianBand } from '@bycelium/evidence-diagrams/propagation-math';
import type { InquiryClaimEvaluation, InquiryEvaluationStep } from '@bycelium/evidence-diagrams';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type PreviewPoint = { x: number; y: number };

function svgElement(tag: keyof SVGElementTagNameMap, attributes: Record<string, string | number | boolean> = {}): SVGElement {
  const node = document.createElementNS(SVG_NAMESPACE, tag) as SVGElement;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

function arrowHead(start: PreviewPoint, end: PreviewPoint): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const size = Math.min(3.2, length * .45);
  const ux = dx / length;
  const uy = dy / length;
  const baseX = end.x - ux * size;
  const baseY = end.y - uy * size;
  const perpendicularX = -uy * size * .48;
  const perpendicularY = ux * size * .48;
  return `${end.x},${end.y} ${baseX + perpendicularX},${baseY + perpendicularY} ${baseX - perpendicularX},${baseY - perpendicularY}`;
}

/**
 * Renders the claim's current, premise-weighted evidence replay as a quiet
 * miniature trajectory. Every segment is one real evaluated evidence effect.
 */
export function renderClaimEvidencePreview(evaluated: InquiryClaimEvaluation): SVGSVGElement | undefined {
  const steps = evaluated.steps.filter((step) => (
    Math.abs(step.after.mean - step.before.mean) > 1e-12
    || Math.abs(step.after.standardDeviation - step.before.standardDeviation) > 1e-12
  ));
  if (steps.length === 0) return undefined;

  const stepBands: { before: GaussianBand; after: GaussianBand }[] = steps.map((step: InquiryEvaluationStep) => ({
    before: gaussianToBand(step.before),
    after: gaussianToBand(step.after),
  }));
  const values = stepBands.flatMap(({ before, after }) => [
    before.lower, before.upper, after.lower, after.upper,
  ]);
  const dataMinimum = Math.min(...values);
  const dataMaximum = Math.max(...values);
  const padding = Math.max(2, (dataMaximum - dataMinimum) * .08);
  const minimum = dataMinimum - padding;
  const maximum = dataMaximum + padding;
  const x = (value: number): number => 5 + (value - minimum) / (maximum - minimum) * 90;
  const top = 0;
  const height = 40;
  const stepExtents = stepBands.map(({ before, after }) => Math.max(
    Math.abs(after.lower - before.lower),
    Math.abs(after.upper - before.upper),
  ));
  const totalExtent = stepExtents.reduce((sum, extent) => sum + extent, 0);
  const stepHeights = totalExtent > 1e-12
    ? stepExtents.map((extent) => extent / totalExtent * height)
    : stepExtents.map(() => height / steps.length);
  const svg = svgElement('svg', {
    class: 'inquiry-claim-evidence-preview',
    viewBox: '0 0 100 40',
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    focusable: 'false',
  }) as SVGSVGElement;

  let yBefore = top + height;
  steps.forEach((step: InquiryEvaluationStep, index: number) => {
    const before = stepBands[index].before;
    const after = stepBands[index].after;
    const meanShift = step.after.mean - step.before.mean;
    const direction = meanShift > 0 ? 'support' : meanShift < 0 ? 'opposition' : 'neutral';
    const yAfter = yBefore - stepHeights[index]!;
    const start = { x: x(step.before.mean), y: yBefore };
    const end = { x: x(step.after.mean), y: yAfter };
    svg.append(svgElement('polygon', {
      class: `inquiry-claim-evidence-preview-band is-${direction}`,
      points: `${x(before.lower)},${yBefore} ${x(before.upper)},${yBefore} ${x(after.upper)},${yAfter} ${x(after.lower)},${yAfter}`,
    }));
    if (direction !== 'neutral') {
      svg.append(
        svgElement('line', {
          class: `inquiry-claim-evidence-preview-segment is-${direction}`,
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
        }),
        svgElement('polygon', {
          class: `inquiry-claim-evidence-preview-head is-${direction}`,
          points: arrowHead(start, end),
        }),
      );
    }
    yBefore = yAfter;
  });
  return svg;
}
