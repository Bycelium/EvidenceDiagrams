import {
  gaussianToBand,
  type Gaussian,
  type GaussianBand,
} from '@bycelium/evidence-diagrams/propagation-math';

import type { PositionedBand } from '../credibility/render-axis.ts';

export type EvidenceImpactPreviewGeometry = {
  readonly minimum: number;
  readonly maximum: number;
  readonly origin: number;
  readonly extent: number;
  readonly selectedBound: 'lower' | 'upper';
  readonly beforeBound: number;
  readonly conditionalBound: number;
  readonly currentBound: number;
  readonly conditionalMovement: number;
  readonly currentMovement: number;
  readonly proportionalWeighting: boolean;
  readonly afterBand: GaussianBand;
  readonly position: PositionedBand;
};

export type EvidenceImpactPreviewGeometryInput = {
  readonly before: Gaussian;
  readonly conditional: Gaussian;
  readonly after: Gaussian;
  readonly premiseWeight: number;
};

export const IMPACT_LAYOUT = {
  trackHeightRem: 5.9,
  conditionalCenterRem: 0.8,
  weightTopRem: 3.55,
  weightHeightRem: 0.5,
  currentCenterRem: 5.25,
} as const;

const CONDITIONAL_SHARE = 0.45;

function selectedBandValue(band: GaussianBand, selectedBound: 'lower' | 'upper'): number {
  return band[selectedBound];
}

function selectBound(before: GaussianBand, conditional: GaussianBand): 'lower' | 'upper' {
  const shift = (conditional.lower + conditional.upper - before.lower - before.upper) / 2;
  if (shift > 1e-12) return 'lower';
  if (shift < -1e-12) return 'upper';
  return Math.abs(before.lower) <= Math.abs(before.upper) ? 'lower' : 'upper';
}

export function buildEvidenceImpactPreviewGeometry({
  before,
  conditional,
  after,
  premiseWeight,
}: EvidenceImpactPreviewGeometryInput): EvidenceImpactPreviewGeometry {
  const beforeBand = gaussianToBand(before);
  const conditionalBand = gaussianToBand(conditional);
  const afterBand = gaussianToBand(after);
  const selectedBound = selectBound(beforeBand, conditionalBand);
  const beforeBound = selectedBandValue(beforeBand, selectedBound);
  const conditionalBound = selectedBandValue(conditionalBand, selectedBound);
  const currentBound = selectedBandValue(afterBand, selectedBound);
  const conditionalMovement = conditionalBound - beforeBound;
  const currentMovement = currentBound - beforeBound;
  const tolerance = 1e-9 * Math.max(1, Math.abs(currentMovement), Math.abs(conditionalMovement));
  const proportionalWeighting = Math.abs(currentMovement - conditionalMovement * premiseWeight) <= tolerance;
  const largestMovement = Math.max(Math.abs(conditionalMovement), Math.abs(currentMovement));
  const extent = largestMovement > 1e-12 ? largestMovement / (CONDITIONAL_SHARE * 2) : 1;
  const origin = beforeBound;
  const minimum = origin - extent;
  const maximum = origin + extent;
  const clippedLower = Math.max(minimum, Math.min(maximum, afterBand.lower));
  const clippedUpper = Math.max(minimum, Math.min(maximum, afterBand.upper));
  return {
    minimum, maximum, origin, extent, selectedBound, beforeBound, conditionalBound,
    currentBound, conditionalMovement, currentMovement, proportionalWeighting, afterBand,
    position: {
      left: (clippedLower - minimum) / (maximum - minimum) * 100,
      width: Math.max(0, (clippedUpper - clippedLower) / (maximum - minimum) * 100),
      center: (Math.max(minimum, Math.min(maximum, after.mean)) - minimum) / (maximum - minimum) * 100,
      clippedMinimum: afterBand.lower < minimum,
      clippedMaximum: afterBand.upper > maximum,
    },
  };
}
