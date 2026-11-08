import { renderEvidenceImpactPreview as renderSharedEvidenceImpactPreview } from '@bycelium/evidence-diagrams-dom';
import type { Gaussian } from '@bycelium/evidence-diagrams/propagation-math';

import type { I18n } from '../i18n/index.ts';
import { formatJeffreysStrength } from '../presentation.ts';

type EvidenceImpactPreviewOptions = {
  readonly i18n: I18n;
  readonly before: Gaussian;
  readonly conditional: Gaussian;
  readonly after: Gaussian;
  readonly premiseWeight: number;
  readonly premiseState: 'true' | 'false';
  readonly saturationThresholdDecibans: number;
  readonly label: string;
};

/** Adapts demo localization to the shared one-step impact presentation. */
export function renderEvidenceImpactPreview({
  i18n,
  before,
  conditional,
  after,
  premiseWeight,
  premiseState,
  saturationThresholdDecibans,
  label,
}: EvidenceImpactPreviewOptions): HTMLDivElement {
  const messages = i18n.messages.inquiry.detail;
  const condition = premiseState === 'true' ? messages.premiseTrue : messages.premiseFalse;
  const premiseWeightText = premiseState === 'true'
    ? {
      proportionalWeight: messages.premiseCredibilitySentence,
      rearrangedWeight: messages.atPremiseCredibility,
      weightTitle: messages.premiseCredibilityTitle,
    }
    : {
      proportionalWeight: messages.premiseFalseProbabilitySentence,
      rearrangedWeight: messages.atPremiseFalseProbability,
      weightTitle: messages.premiseFalseProbabilityTitle,
    };
  return renderSharedEvidenceImpactPreview({
    before,
    conditional,
    after,
    premiseWeight,
    saturationThresholdDecibans,
    label,
    formatPercent: i18n.percent,
    texts: {
      conditional: i18n.formatMessage(messages.conditionalImpactSentence, { condition }),
      proportionalWeight: premiseWeightText.proportionalWeight,
      rearrangedWeight: premiseWeightText.rearrangedWeight,
      applies: messages.premiseCredibilityApplies,
      weightTitle: premiseWeightText.weightTitle,
    },
    formatConclusion: ({ meanShift, standardDeviationShift }) => {
      const strength = i18n.messages.inquiry.strength;
      if (Math.abs(meanShift) > 1e-12) {
        return {
          label: messages.currentImpactSentence,
          result: i18n.formatMessage(
            meanShift > 0 ? strength.strengthSupport : strength.strengthOpposition,
            { strength: formatJeffreysStrength(i18n, meanShift) },
          ),
        };
      }
      return {
        label: Math.abs(standardDeviationShift) > 1e-12
          ? messages.currentImpactUncertaintySentence
          : messages.currentImpactSentence,
        result: Math.abs(standardDeviationShift) > 1e-12
          ? strength.strengthWidth
          : strength.strengthNone,
      };
    },
    formatAriaLabel: ({
      selectedBound,
      beforeBound,
      conditionalBound,
      currentBound,
      conditionalMeanShift,
      currentMeanShift,
      conclusion,
    }) => i18n.formatMessage(messages.selectedEvidenceImpactAria, {
      label,
      condition,
      bound: selectedBound,
      before: i18n.number(beforeBound, { maximumFractionDigits: 2 }),
      conditional: i18n.number(conditionalBound, { maximumFractionDigits: 2 }),
      current: i18n.number(currentBound, { maximumFractionDigits: 2 }),
      conditionalMean: i18n.number(conditionalMeanShift, { maximumFractionDigits: 2 }),
      weight: i18n.percent(premiseWeight, { maximumFractionDigits: 1 }),
      currentMean: i18n.number(currentMeanShift, { maximumFractionDigits: 2 }),
      conclusion,
    }),
  });
}
