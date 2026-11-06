export function buildInquiryBandGeometry(bands, saturationThresholdDecibans) {
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

export function editBandEndpoint(band, bound, value, minimum, maximum) {
  const proposed = Math.max(minimum, Math.min(maximum, value));
  if (bound === 'lower') {
    return { ...band, lower: Math.min(band.upper, proposed) };
  }
  if (bound === 'upper') {
    return { ...band, upper: Math.max(band.lower, proposed) };
  }
  throw new RangeError(`Unknown band endpoint: ${bound}`);
}

export function credibilityDisplayBounds(band, meanShift) {
  if (band.lower === band.upper) return [{ decibans: band.lower, direction: 'exact' }];
  if (meanShift > 1e-12) return [{ decibans: band.lower, direction: 'lower' }];
  if (meanShift < -1e-12) return [{ decibans: band.upper, direction: 'upper' }];
  return [
    { decibans: band.lower, direction: 'lower' },
    { decibans: band.upper, direction: 'upper' },
  ];
}
