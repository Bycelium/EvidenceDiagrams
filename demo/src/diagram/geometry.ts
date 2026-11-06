import type { GaussianBand } from '@bycelium/evidence-diagrams/propagation-math';

export type PositionedBand = {
  left: number;
  width: number;
  center: number;
  clippedMinimum: boolean;
  clippedMaximum: boolean;
};

export type InquiryBandGeometry = {
  minimum: number;
  maximum: number;
  bands: PositionedBand[];
};

export function buildInquiryBandGeometry(
  bands: readonly GaussianBand[],
  saturationThresholdDecibans: number,
): InquiryBandGeometry {
  const minimum = -2 * saturationThresholdDecibans;
  const maximum = 2 * saturationThresholdDecibans;
  const domain = maximum - minimum;
  return {
    minimum,
    maximum,
    bands: bands.map(({ lower, upper }) => ({
      left: (Math.max(minimum, Math.min(maximum, lower)) - minimum) / domain * 100,
      width: Math.max(0, (Math.min(maximum, upper) - Math.max(minimum, lower)) / domain * 100),
      center: (Math.max(minimum, Math.min(maximum, (lower + upper) / 2)) - minimum) / domain * 100,
      clippedMinimum: lower < minimum,
      clippedMaximum: upper > maximum,
    })),
  };
}

export function editBandEndpoint(
  band: GaussianBand,
  bound: 'lower' | 'upper',
  value: number,
  minimum: number,
  maximum: number,
): GaussianBand {
  const proposed = Math.max(minimum, Math.min(maximum, value));
  if (bound === 'lower') {
    return { ...band, lower: Math.min(band.upper, proposed) };
  }
  if (bound === 'upper') {
    return { ...band, upper: Math.max(band.lower, proposed) };
  }
  throw new RangeError(`Unknown band endpoint: ${bound}`);
}

export type CredibilityDisplayBound = {
  decibans: number;
  direction: 'exact' | 'lower' | 'upper';
};

export function credibilityDisplayBounds(
  band: GaussianBand,
  meanShift: number,
): CredibilityDisplayBound[] {
  if (band.lower === band.upper) return [{ decibans: band.lower, direction: 'exact' }];
  if (meanShift > 1e-12) return [{ decibans: band.lower, direction: 'lower' }];
  if (meanShift < -1e-12) return [{ decibans: band.upper, direction: 'upper' }];
  return [
    { decibans: band.lower, direction: 'lower' },
    { decibans: band.upper, direction: 'upper' },
  ];
}
