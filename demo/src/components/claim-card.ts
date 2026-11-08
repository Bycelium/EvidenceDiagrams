import {
  aggregateEvidence,
  color,
  formatProbabilityDisplay,
  type EvidenceSummary,
  type InquiryClaimEvaluation,
} from '@bycelium/evidence-diagrams';
import { gaussianToBand, type Gaussian } from '@bycelium/evidence-diagrams/propagation-math';

import { credibilityDisplayBounds } from '../diagram/geometry.ts';
import { element } from '../html-element.ts';
import type { I18n } from '../i18n/index.ts';

export interface ClaimCardMessages {
  readonly currentCredibility: string;
}

function formatBoundProbability(
  i18n: I18n,
  decibans: number,
  direction: 'lower' | 'upper' | 'exact',
): string {
  const display = formatProbabilityDisplay(decibans, direction);
  const percentage = i18n.percent(display.value / 100, { maximumFractionDigits: 12 });
  const operator = display.operator
    ?? (direction === 'lower' ? '≥' : direction === 'upper' ? '≤' : '=');
  return `${operator}\u00a0${percentage}`;
}

export function claimEvidenceSummary(evaluated: {
  steps: readonly { before: Pick<Gaussian, 'mean'>; after: Pick<Gaussian, 'mean'> }[];
}): EvidenceSummary {
  return aggregateEvidence(evaluated.steps.map((step) => ({
    weightDecibans: step.after.mean - step.before.mean,
  })));
}

export function formatClaimCredibility(
  i18n: I18n,
  evaluated: Pick<InquiryClaimEvaluation, 'prior' | 'posterior'>,
): string {
  const band = gaussianToBand(evaluated.posterior);
  const meanShift = evaluated.posterior.mean - evaluated.prior.mean;
  return credibilityDisplayBounds(band, meanShift)
    .map(({ decibans, direction }) => formatBoundProbability(i18n, decibans, direction))
    .join(' – ');
}

export function renderClaimCredibility(
  i18n: I18n,
  messages: ClaimCardMessages,
  evaluated: InquiryClaimEvaluation,
  evidenceSummary: EvidenceSummary,
  saturationThresholdDecibans: number,
  compact = false,
): { credibility: HTMLSpanElement; palette: { color: string; colorOptions: { saturationThresholdDecibans: number; minPriorDecibans: number; maxPriorDecibans: number } } } {
  const priorBand = gaussianToBand(evaluated.prior);
  const colorOptions = {
    saturationThresholdDecibans,
    minPriorDecibans: priorBand.lower,
    maxPriorDecibans: priorBand.upper,
  };
  const resultColor = color(evidenceSummary, colorOptions);
  return {
    credibility: element('span', {
      className: `inquiry-current-credibility${compact ? ' is-compact' : ''}`,
    }, [
      element('span', {
        className: 'inquiry-current-label',
        textContent: messages.currentCredibility,
      }),
      element('strong', { textContent: formatClaimCredibility(i18n, evaluated) }),
    ]),
    palette: { color: resultColor, colorOptions },
  };
}
