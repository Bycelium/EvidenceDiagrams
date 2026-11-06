export type Gaussian = {
  readonly mean: number;
  readonly standardDeviation: number;
};

export type GaussianImpact = {
  readonly deltaMean: number;
  readonly deltaStandardDeviation: number;
};

export type GaussianBand = {
  readonly lower: number;
  readonly upper: number;
};

const DECIBAN_SCALE = Math.log(10) / 10;
const NORMAL_DENSITY_SCALE = 1 / Math.sqrt(2 * Math.PI);

function requireFinite(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number.`);
  }
}

function validateGaussian(gaussian: Gaussian, name: string): void {
  requireFinite(gaussian?.mean, `${name}.mean`);
  requireFinite(gaussian?.standardDeviation, `${name}.standardDeviation`);
  if (gaussian.standardDeviation < 0) {
    throw new RangeError(`${name}.standardDeviation must be non-negative.`);
  }
}

function validateImpact(impact: GaussianImpact): void {
  requireFinite(impact?.deltaMean, 'impact.deltaMean');
  requireFinite(impact?.deltaStandardDeviation, 'impact.deltaStandardDeviation');
}

function finiteGaussian(mean: number, standardDeviation: number, operation: string): Gaussian {
  if (!Number.isFinite(mean) || !Number.isFinite(standardDeviation)) {
    throw new RangeError(`${operation} produced an unrepresentable Gaussian.`);
  }
  return { mean, standardDeviation };
}

/** Converts a Gaussian to its exact three-standard-deviation display band. */
export function gaussianToBand(gaussian: Gaussian): GaussianBand {
  validateGaussian(gaussian, 'gaussian');
  const lower = gaussian.mean - 3 * gaussian.standardDeviation;
  const upper = gaussian.mean + 3 * gaussian.standardDeviation;
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    throw new RangeError('gaussianToBand produced an unrepresentable band.');
  }
  return { lower, upper };
}

/** Reconstructs a Gaussian from an exact three-standard-deviation display band. */
export function bandToGaussian(band: GaussianBand): Gaussian {
  requireFinite(band?.lower, 'band.lower');
  requireFinite(band?.upper, 'band.upper');
  if (band.lower > band.upper) {
    throw new RangeError('band.lower must not exceed band.upper.');
  }
  return finiteGaussian(
    band.lower / 2 + band.upper / 2,
    band.upper / 6 - band.lower / 6,
    'bandToGaussian',
  );
}

/** Applies a fixed signed impact at the premise probability q. */
export function applyImpact(before: Gaussian, impact: GaussianImpact, q: number): Gaussian {
  validateGaussian(before, 'before');
  validateImpact(impact);
  requireFinite(q, 'q');
  if (q < 0 || q > 1) {
    throw new RangeError('q must be between zero and one.');
  }
  return finiteGaussian(
    before.mean + q * impact.deltaMean,
    Math.abs(before.standardDeviation + q * impact.deltaStandardDeviation),
    'applyImpact',
  );
}

function probability(position: number): number {
  const scaled = DECIBAN_SCALE * position;
  if (scaled >= 0) return 1 / (1 + Math.exp(-scaled));
  const odds = Math.exp(scaled);
  return odds / (1 + odds);
}

function normalDensity(position: number): number {
  return NORMAL_DENSITY_SCALE * Math.exp(-position * position / 2);
}

function integrate(
  fn: (position: number) => number,
  left: number,
  right: number,
  tolerance: number,
): number {
  const middle = (left + right) / 2;
  const leftValue = fn(left);
  const middleValue = fn(middle);
  const rightValue = fn(right);
  const initial = (right - left) * (leftValue + 4 * middleValue + rightValue) / 6;

  function refine(
    low: number,
    high: number,
    lowValue: number,
    midValue: number,
    highValue: number,
    whole: number,
    error: number,
    depth: number,
  ): number {
    const mid = (low + high) / 2;
    const firstMidValue = fn((low + mid) / 2);
    const secondMidValue = fn((mid + high) / 2);
    const first = (mid - low) * (lowValue + 4 * firstMidValue + midValue) / 6;
    const second = (high - mid) * (midValue + 4 * secondMidValue + highValue) / 6;
    const delta = first + second - whole;
    if (Math.abs(delta) <= 15 * error) {
      return first + second + delta / 15;
    }
    if (depth === 0) {
      throw new ArithmeticError('Distribution integration did not reach the requested tolerance.');
    }
    return refine(
      low,
      mid,
      lowValue,
      firstMidValue,
      midValue,
      first,
      error / 2,
      depth - 1,
    ) + refine(
      mid,
      high,
      midValue,
      secondMidValue,
      highValue,
      second,
      error / 2,
      depth - 1,
    );
  }

  return refine(
    left,
    right,
    leftValue,
    middleValue,
    rightValue,
    initial,
    tolerance,
    30,
  );
}

class ArithmeticError extends Error {
  override name = 'ArithmeticError';
}

/** Returns the expected logistic probability of a Gaussian deciban belief. */
export function expectedProbability(gaussian: Gaussian): number {
  validateGaussian(gaussian, 'gaussian');
  if (gaussian.standardDeviation === 0) return probability(gaussian.mean);
  if (gaussian.mean === 0) return 0.5;

  const splitSet = new Set<number>();
  for (let value = -12; value <= 12; value += 1) splitSet.add(value);
  for (const scaled of [-40, -1, 0, 1, 40]) {
    const transition = (scaled / DECIBAN_SCALE - gaussian.mean)
      / gaussian.standardDeviation;
    if (transition > -12 && transition < 12) splitSet.add(transition);
  }
  const boundaries = [...splitSet].sort((left, right) => left - right);
  const tolerance = 1e-12 / (boundaries.length - 1);
  const values: number[] = [];
  for (let index = 1; index < boundaries.length; index += 1) {
    const left = boundaries[index - 1]!;
    const right = boundaries[index]!;
    values.push(integrate(
      (z) => probability(
        gaussian.mean + gaussian.standardDeviation * z,
      ) * normalDensity(z),
      left,
      right,
      tolerance,
    ));
  }

  // Sum from small to large to retain the tail contributions deterministically.
  values.sort((left, right) => Math.abs(left) - Math.abs(right));
  const result = values.reduce((sum, value) => sum + value, 0);
  return Math.min(1, Math.max(0, result));
}
