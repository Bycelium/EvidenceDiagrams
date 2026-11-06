import { color, DEFAULT_COLOR_OPTIONS } from './color.js';
import type { EvidenceSummary } from '../types.js';
import type { ColorOptions } from './color.js';

export type PaletteOptions = Pick<ColorOptions, 'saturationThresholdDecibans' | 'anchors'>;

export type CredibilityBand = {
  readonly lower: number;
  readonly upper: number;
};

export type CredibilityBandColorOptions = PaletteOptions & {
  readonly minimum: number;
  readonly maximum: number;
};

/** Colors an absolute credibility coordinate on the shared red–gray–green axis. */
export function credibilityAxisColor(
  decibans: number,
  options: PaletteOptions = {},
): string {
  return color({
    netWeightDecibans: decibans,
    absoluteWeightDecibans: Math.abs(decibans),
    dissonance: 0,
  }, exactNeutralOptions(options));
}

/** Builds the shared credibility-axis gradient clipped to a band. */
export function credibilityBandBackground(
  band: CredibilityBand,
  options: CredibilityBandColorOptions,
): string {
  const { lower, upper } = readBand(band);
  const { minimum, maximum } = readAxis(options);
  const clippedLower = Math.max(minimum, Math.min(maximum, lower));
  const clippedUpper = Math.max(minimum, Math.min(maximum, upper));
  if (clippedLower === clippedUpper) return credibilityAxisColor(clippedLower, options);

  const threshold = readThreshold(options);
  const values = [...new Set([
    clippedLower,
    clippedUpper,
    Math.max(clippedLower, Math.min(clippedUpper, -threshold)),
    Math.max(clippedLower, Math.min(clippedUpper, 0)),
    Math.max(clippedLower, Math.min(clippedUpper, threshold)),
  ])].sort((left, right) => left - right);
  const stops = values.map((value) => (
    `${credibilityAxisColor(value, options)} ${(value - clippedLower) / (clippedUpper - clippedLower) * 100}%`
  ));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Colors an evidence effect independently of a claim's prior interval. */
export function evidenceStrengthColor(
  summary: EvidenceSummary,
  options: PaletteOptions = {},
): string {
  return color(summary, exactNeutralOptions(options));
}

function exactNeutralOptions(options: PaletteOptions): ColorOptions {
  return {
    ...options,
    minPriorDecibans: 0,
    maxPriorDecibans: 0,
  };
}

function readThreshold(options: PaletteOptions): number {
  const threshold = options.saturationThresholdDecibans
    ?? DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans;
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new RangeError('The saturation threshold must be a finite positive number.');
  }
  return threshold;
}

function readBand(band: CredibilityBand): CredibilityBand {
  const lower = band?.lower;
  const upper = band?.upper;
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) {
    throw new RangeError('The credibility band must be a finite ordered interval.');
  }
  return { lower, upper };
}

function readAxis(options: CredibilityBandColorOptions): { minimum: number; maximum: number } {
  const minimum = options?.minimum;
  const maximum = options?.maximum;
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
    throw new RangeError('The credibility axis must be a finite increasing interval.');
  }
  return { minimum, maximum };
}
