import type { EvidenceWeight } from '../types.js';

type PositiveJeffreysBand =
  | 'anecdotal'
  | 'weak'
  | 'moderate'
  | 'strong'
  | 'very strong'
  | 'decisive';

export type JeffreysBand =
  | 'none'
  | PositiveJeffreysBand
  | `${PositiveJeffreysBand} against`;

/** Positive deciban boundaries between the named adapted Jeffreys evidence bands. */
export const JEFFREYS_THRESHOLDS_DECIBANS = Object.freeze([2.5, 5, 10, 15, 20] as const);

/** Names a weight-of-evidence band on the adapted deciban Jeffreys scale. */
export function jeffreysBand(weight: EvidenceWeight): JeffreysBand {
  const weightDecibans: unknown = weight?.weightDecibans;
  if (typeof weightDecibans !== 'number' || Number.isNaN(weightDecibans)) {
    throw new RangeError('Weight in decibans must be defined.');
  }
  const absoluteWeight = Math.abs(weightDecibans);
  if (absoluteWeight === 0) return 'none';

  const [weak, moderate, strong, veryStrong, decisive] = JEFFREYS_THRESHOLDS_DECIBANS;
  let band: PositiveJeffreysBand;
  if (absoluteWeight < weak) band = 'anecdotal';
  else if (absoluteWeight < moderate) band = 'weak';
  else if (absoluteWeight < strong) band = 'moderate';
  else if (absoluteWeight < veryStrong) band = 'strong';
  else if (absoluteWeight < decisive) band = 'very strong';
  else band = 'decisive';

  return weightDecibans < 0 ? `${band} against` : band;
}
