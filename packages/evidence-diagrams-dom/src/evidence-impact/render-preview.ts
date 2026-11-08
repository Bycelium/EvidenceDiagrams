import {
  credibilityBandBackground,
  evidenceStrengthColor,
} from '@bycelium/evidence-diagrams';
import type { Gaussian } from '@bycelium/evidence-diagrams/propagation-math';

import { CREDIBILITY_BAND_HEIGHT_REM, renderCredibilityAxis } from '../credibility/render-axis.ts';
import { element } from '../html-element.ts';
import {
  buildEvidenceImpactPreviewGeometry,
  IMPACT_LAYOUT,
  type EvidenceImpactPreviewGeometry,
  type EvidenceImpactPreviewGeometryInput,
} from './calculate-geometry.ts';
import { endpoint, renderImpactDrawing } from './draw-impact.ts';

export type EvidenceImpactPreviewTexts = {
  readonly conditional: string;
  readonly proportionalWeight: string;
  readonly rearrangedWeight: string;
  readonly applies: string;
  readonly weightTitle: string;
};

export type EvidenceImpactAriaValues = {
  readonly label: string;
  readonly selectedBound: 'lower' | 'upper';
  readonly beforeBound: number;
  readonly conditionalBound: number;
  readonly currentBound: number;
  readonly conditionalMeanShift: number;
  readonly premiseWeight: number;
  readonly currentMeanShift: number;
  readonly conclusion: string;
};

export type EvidenceImpactFormatValues = {
  readonly meanShift: number;
  readonly standardDeviationShift: number;
};

export type EvidenceImpactConclusion = {
  readonly label: string;
  readonly result: string;
};

export type EvidenceImpactPreviewOptions = {
  readonly before: Gaussian;
  readonly conditional: Gaussian;
  readonly after: Gaussian;
  readonly premiseWeight: number;
  readonly saturationThresholdDecibans: number;
  readonly formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  readonly formatConclusion: (values: EvidenceImpactFormatValues) => EvidenceImpactConclusion;
  readonly formatAriaLabel: (values: EvidenceImpactAriaValues) => string;
  readonly texts: EvidenceImpactPreviewTexts;
  readonly label?: string;
};

export {
  buildEvidenceImpactPreviewGeometry,
  type EvidenceImpactPreviewGeometry,
  type EvidenceImpactPreviewGeometryInput,
};

export function renderEvidenceImpactPreview({
  before,
  conditional,
  after,
  premiseWeight,
  saturationThresholdDecibans,
  formatPercent,
  formatConclusion,
  formatAriaLabel,
  texts,
  label = 'Selected Evidence impact',
}: EvidenceImpactPreviewOptions): HTMLDivElement {
  const geometry = buildEvidenceImpactPreviewGeometry({ before, conditional, after, premiseWeight });
  const {
    afterBand, position, extent, selectedBound, beforeBound, conditionalBound, currentBound,
    conditionalMovement, currentMovement, proportionalWeighting,
  } = geometry;
  const meanShift = after.mean - before.mean;
  const conditionalMeanShift = conditional.mean - before.mean;
  const widthShift = after.standardDeviation - before.standardDeviation;
  const formattedConclusion = formatConclusion({
    meanShift,
    standardDeviationShift: widthShift,
  });
  const formattedConditionalConclusion = formatConclusion({
    meanShift: conditionalMeanShift,
    standardDeviationShift: conditional.standardDeviation - before.standardDeviation,
  });
  const arrowColor = evidenceStrengthColor({
    netWeightDecibans: meanShift,
    absoluteWeightDecibans: Math.abs(meanShift),
    dissonance: 0,
  }, { saturationThresholdDecibans });
  const conditionalOffset = conditionalMovement / extent * 50;
  const currentOffset = currentMovement / extent * 50;
  const weightedOffset = proportionalWeighting ? conditionalOffset * premiseWeight : currentOffset;
  const conditionalEnd = endpoint(50, conditionalOffset);
  const weightedEnd = endpoint(50, weightedOffset);
  const currentEnd = endpoint(50, currentOffset);
  const direction = conditionalMeanShift < 0 ? ' is-opposition' : conditionalMeanShift > 0 ? ' is-support' : '';
  const movementDirection = conditionalMovement < 0 ? ' is-leftward' : ' is-rightward';
  const weightPercent = formatPercent(premiseWeight, { maximumFractionDigits: 1 });
  const weightCopy = proportionalWeighting ? texts.proportionalWeight : texts.rearrangedWeight;
  const weightLabel = element('span', {
    className: `inquiry-impact-weight-label${direction}${movementDirection}`,
    title: texts.weightTitle,
  }, [
    element('span', { className: 'inquiry-impact-weight-copy', textContent: weightCopy }),
    ' ',
    element('span', { className: 'inquiry-impact-weight-applied' }, [
      element('strong', {
        className: 'inquiry-impact-weight-percent',
        textContent: weightPercent,
      }),
      proportionalWeighting ? ` ${texts.applies}` : '',
    ]),
  ]);
  const overlay = element('span', {
    className: `inquiry-impact-overlay${direction}${movementDirection}${proportionalWeighting ? '' : ' is-rearranged'}`,
    'aria-hidden': 'true',
  }, [
    renderImpactDrawing({
      conditionalEnd,
      weightedEnd,
      currentEnd,
      direction: `${direction}${movementDirection}${proportionalWeighting ? '' : ' is-rearranged'}`,
      conditionalMeanShift,
      currentMeanShift: meanShift,
      proportionalWeighting,
    }),
    element('span', {
      className: `inquiry-impact-conditional-label${direction}${movementDirection}`,
      textContent: `${texts.conditional} ${formattedConditionalConclusion.result}`,
    }),
    weightLabel,
  ]);
  const axis = renderCredibilityAxis({
    band: afterBand,
    position,
    domain: { minimum: geometry.minimum, maximum: geometry.maximum },
    className: 'is-current inquiry-evidence-impact-axis',
    saturationThresholdDecibans,
    plotWidth: 400,
    formatPercent,
    background: credibilityBandBackground(afterBand, {
      minimum: geometry.minimum,
      maximum: geometry.maximum,
      saturationThresholdDecibans,
    }),
    overlay,
    ruler: { kind: 'relative-decibans', origin: geometry.origin },
    secondaryRuler: { kind: 'probability', positions: [beforeBound, currentBound] },
    showValue: false,
  });
  axis.style.setProperty('--impact-track-height', `${IMPACT_LAYOUT.trackHeightRem}rem`);
  axis.style.setProperty('--impact-band-height', `${CREDIBILITY_BAND_HEIGHT_REM}rem`);
  axis.style.setProperty('--impact-conditional-center', `${IMPACT_LAYOUT.conditionalCenterRem}rem`);
  axis.style.setProperty('--impact-weight-center', `${IMPACT_LAYOUT.weightTopRem + IMPACT_LAYOUT.weightHeightRem / 2}rem`);
  axis.style.setProperty('--impact-axis-top', `${IMPACT_LAYOUT.currentCenterRem - CREDIBILITY_BAND_HEIGHT_REM / 2}rem`);
  const conclusion = element('p', {
    className: 'inquiry-impact-conclusion',
  }, [
    element('span', {
      className: 'inquiry-impact-conclusion-label',
      textContent: formattedConclusion.label,
    }),
    ' ',
    element('strong', {
      className: 'inquiry-impact-conclusion-result',
      textContent: formattedConclusion.result,
    }),
  ]);
  conclusion.style.setProperty('--impact-result-color', arrowColor);
  const ariaLabel = formatAriaLabel({
    label,
    selectedBound,
    beforeBound,
    conditionalBound,
    currentBound,
    conditionalMeanShift,
    premiseWeight,
    currentMeanShift: meanShift,
    conclusion: formattedConclusion.result,
  });
  const visual = element('div', {
    className: 'inquiry-evidence-impact-visual',
    role: 'img',
    'aria-label': ariaLabel,
  }, [axis, conclusion]);
  return element('div', {
    className: 'inquiry-evidence-impact-preview',
    'data-selected-bound': selectedBound,
    'data-before-bound': String(beforeBound),
    'data-conditional-bound': String(conditionalBound),
    'data-current-bound': String(currentBound),
    'data-proportional-weighting': String(proportionalWeighting),
  }, [visual]);
}
