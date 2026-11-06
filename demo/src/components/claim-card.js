import {
  aggregateEvidence,
  color,
  formatProbabilityDisplay,
} from '@bycelium/evidence-diagrams';
import { gaussianToBand } from '@bycelium/evidence-diagrams/propagation-math';

import { credibilityDisplayBounds } from '../diagram/geometry.js';
import { element } from '../dom.js';

function formatBoundProbability(i18n, decibans, direction) {
  const display = formatProbabilityDisplay(decibans, direction);
  const percentage = i18n.percent(display.value / 100, { maximumFractionDigits: 12 });
  const operator = display.operator
    ?? (direction === 'lower' ? '≥' : direction === 'upper' ? '≤' : '=');
  return `${operator}\u00a0${percentage}`;
}

export function claimEvidenceSummary(evaluated) {
  return aggregateEvidence(evaluated.steps.map((step) => ({
    weightDecibans: step.after.mean - step.before.mean,
  })));
}

export function formatClaimCredibility(i18n, evaluated) {
  const band = gaussianToBand(evaluated.posterior);
  const meanShift = evaluated.posterior.mean - evaluated.prior.mean;
  return credibilityDisplayBounds(band, meanShift)
    .map(({ decibans, direction }) => formatBoundProbability(i18n, decibans, direction))
    .join(' – ');
}

export function renderClaimCredibility(
  i18n, evaluated, evidenceSummary, saturationThresholdDecibans, compact = false,
) {
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
        textContent: i18n.t('inquiry.currentCredibility'),
      }),
      element('strong', { textContent: formatClaimCredibility(i18n, evaluated) }),
    ]),
    palette: { color: resultColor, colorOptions },
  };
}
