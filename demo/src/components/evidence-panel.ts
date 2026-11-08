import {
  DEFAULT_COLOR_OPTIONS,
  formatProbabilityDisplay,
  type Inquiry,
  type InquiryClaim,
  type InquiryClaimEvaluation,
  type InquiryContribution,
  type InquiryEvaluation,
  type InquiryEvaluationStep,
  type InquiryEvidence,
} from '@bycelium/evidence-diagrams';
import { applyImpact, gaussianToBand } from '@bycelium/evidence-diagrams/propagation-math';
import { element } from '../html-element.ts';
import { safeHttpUrl } from '../safe-http-url.ts';
import { readableMetricColor } from '../color.ts';
import type { I18n } from '../i18n/index.ts';
import type { StrengthMessages } from '../presentation.ts';
import { claimEvidenceSummary, renderClaimCredibility, type ClaimCardMessages } from './claim-card.ts';
import { renderClaimEvidencePreview } from './claim-evidence-preview.ts';
import { createConditionalStrengthControl, type ConditionalMessages } from './conditional-strength-control.ts';
import type { FormMessages } from './inquiry-forms.ts';
import { renderEvidenceImpactPreview } from './evidence-impact-preview.ts';
import { createPremiseConditionControl } from './premise-condition-control.ts';

export type PanelState = {
  inquiry: Inquiry;
  evaluation: InquiryEvaluation;
  evidenceId: string;
  saturationThresholdDecibans?: number;
  conditionalStrengthDefault?: number;
};

export interface EvidenceDetailMessages {
  readonly evidenceDetails: string;
  readonly closeEvidenceDetails: string;
  readonly basedOn: string;
  readonly premiseCondition: string;
  readonly premiseHeading: string;
  readonly premiseIs: string;
  readonly premiseConditionSuffix: string;
  readonly premiseTrue: string;
  readonly premiseFalse: string;
  readonly changeToTrue: string;
  readonly changeToFalse: string;
  readonly currentImpactIntro: string;
  readonly selectedEvidenceImpact: string;
  readonly conditionalImpactSentence: string;
  readonly premiseCredibilitySentence: string;
  readonly premiseFalseProbabilitySentence: string;
  readonly atPremiseCredibility: string;
  readonly atPremiseFalseProbability: string;
  readonly premiseCredibilityApplies: string;
  readonly premiseCredibilityTitle: string;
  readonly premiseFalseProbabilityTitle: string;
  readonly currentImpactSentence: string;
  readonly currentImpactUncertaintySentence: string;
  readonly selectedEvidenceImpactAria: string;
  readonly credibilityInterval: string;
  readonly premiseWeightingSentence: string;
  readonly andGivenClaimCredibility: string;
  readonly butGivenClaimCredibility: string;
  readonly investigateClaimNamed: string;
  readonly inspectEvidence: string;
  readonly removeEvidence: string;
}

export type EvidencePanelCallbacks = {
  onConditionalStrengthChange?: (evidenceId: string, deltaMean: number) => PanelState | undefined;
  onPremiseStateChange?: (input: {
    readonly evidenceId: string;
    readonly premiseState: 'true' | 'false';
  }) => PanelState | undefined;
  onInvestigate?: (claimId: string | undefined) => void;
  onEditEvidence?: (evidenceId: string | undefined) => void;
  onRemoveEvidence?: (evidenceId: string | undefined) => void;
};

function claimById(inquiry: Inquiry, id: string): InquiryClaim | undefined {
  return inquiry.claims.find((claim) => claim.id === id);
}

function contributionById(inquiry: Inquiry, id: string): InquiryContribution | undefined {
  return inquiry.contributions.find((contribution) => contribution.id === id);
}

function evidenceById(inquiry: Inquiry, id: string): InquiryEvidence | undefined {
  return inquiry.evidence.find((item) => item.id === id);
}

export function hasZeroAssignedImpact(item: InquiryEvidence): boolean {
  return item.impact.deltaMean === 0 && item.impact.deltaStandardDeviation === 0;
}

function evaluationForClaim(evaluation: InquiryEvaluation, id: string): InquiryClaimEvaluation | undefined {
  return evaluation.claims[id];
}

function stepForEvidence(evaluation: InquiryEvaluation, item: InquiryEvidence): InquiryEvaluationStep | undefined {
  return evaluationForClaim(evaluation, item.targetClaimId)?.steps
    .find((step) => step.evidenceId === item.id);
}

function narrativeHeading(messages: EvidenceDetailMessages, premiseWeight: number): string {
  return premiseWeight < .5 ? messages.butGivenClaimCredibility : messages.andGivenClaimCredibility;
}

function formattedPremiseWeight(i18n: I18n, premiseWeight: number): string {
  return `≈ ${i18n.percent(premiseWeight)}`;
}

function metricValue(text: string, color: string, dataset: Record<string, string> = {}): HTMLElement {
  const value = element('strong', {
    className: 'inquiry-evidence-panel-metric-value',
    dataset,
    textContent: text,
  });
  value.style.setProperty('--metric-color', readableMetricColor(color));
  return value;
}

function localizedNodeParts(
  formatMessage: I18n['formatMessage'],
  template: string,
  values: Record<string, unknown>,
  nodes: Record<string, Node>,
): Node[] {
  const tokens: Record<string, string> = Object.fromEntries(
    Object.keys(nodes).map((field) => [field, `__INQUIRY_${field.toUpperCase()}__`]),
  );
  const sentence = formatMessage(template, { ...values, ...tokens });
  const positions = Object.entries(tokens)
    .map(([field, token]) => ({ field, token, index: sentence.indexOf(token) }))
    .sort((first, second) => first.index - second.index);
  if (positions.some(({ index }) => index < 0)) return [document.createTextNode(sentence)];
  const parts = [];
  let cursor = 0;
  for (const { field, token, index } of positions) {
    parts.push(document.createTextNode(sentence.slice(cursor, index)), nodes[field]);
    cursor = index + token.length;
  }
  parts.push(document.createTextNode(sentence.slice(cursor)));
  return parts;
}

function formatEndpointProbability(i18n: I18n, decibans: number, direction: 'lower' | 'upper' | 'exact' = 'exact'): string {
  const display = formatProbabilityDisplay(decibans, direction);
  const probability = i18n.percent(display.value / 100, { maximumFractionDigits: 12 });
  return display.operator ? `${display.operator}\u00a0${probability}` : probability;
}

function credibilityInterval(
  i18n: I18n,
  formatMessage: I18n['formatMessage'],
  messages: EvidenceDetailMessages,
  evaluated: InquiryClaimEvaluation,
  color: string,
  dataset: Record<string, string> = {},
): HTMLSpanElement {
  const band = gaussianToBand(evaluated.posterior);
  const lowerToken = '__INQUIRY_LOWER_CREDIBILITY__';
  const upperToken = '__INQUIRY_UPPER_CREDIBILITY__';
  const sentence = formatMessage(messages.credibilityInterval, { lower: lowerToken, upper: upperToken });
  const lowerIndex = sentence.indexOf(lowerToken);
  const upperIndex = sentence.indexOf(upperToken);
  if (lowerIndex < 0 || upperIndex < lowerIndex) {
    return element('span', { dataset }, [
      metricValue(formatEndpointProbability(i18n, band.lower, 'lower'), color),
      document.createTextNode(' – '),
      metricValue(formatEndpointProbability(i18n, band.upper, 'upper'), color),
    ]);
  }
  return element('span', { dataset }, [
    document.createTextNode(sentence.slice(0, lowerIndex)),
    metricValue(formatEndpointProbability(i18n, band.lower, 'lower'), color),
    document.createTextNode(sentence.slice(
      lowerIndex + lowerToken.length, upperIndex,
    )),
    metricValue(formatEndpointProbability(i18n, band.upper, 'upper'), color),
    document.createTextNode(sentence.slice(upperIndex + upperToken.length)),
  ]);
}

function conditionalStrengthView(
  i18n: I18n,
  messages: ConditionalMessages,
  formatMessage: I18n['formatMessage'],
  item: InquiryEvidence,
  defaultValue: number,
  saturationThresholdDecibans: number,
  forceExtentDecibans: number,
  target: InquiryClaim,
  targetContent: Node,
  onInput: (deltaMean: number) => void,
): { primarySection: HTMLElement; targetSection?: HTMLElement } {
  const primarySection = element('section', {
    className: 'inquiry-evidence-panel-conditional',
    'aria-labelledby': 'inquiry-evidence-panel-conditional-title',
  });
  const control = createConditionalStrengthControl({
    messages,
    formatMessage,
    number: i18n.number,
    targetTitle: target.title,
    value: item.impact.deltaMean,
    defaultValue,
    saturationThresholdDecibans,
    forceExtentDecibans,
    panelNarrative: true,
    panelTargetContent: targetContent,
    headingId: 'inquiry-evidence-panel-conditional-title',
    onInput,
  });
  primarySection.append(control.element);
  return { primarySection, targetSection: control.targetSection };
}

function targetClaimCard(
  i18n: I18n,
  messages: EvidenceDetailMessages,
  claimCardMessages: ClaimCardMessages,
  formatMessage: I18n['formatMessage'],
  target: InquiryClaim,
  evaluated: InquiryClaimEvaluation,
  saturationThresholdDecibans: number,
): HTMLButtonElement {
  const rendered = renderClaimCredibility(
    i18n,
    claimCardMessages,
    evaluated,
    claimEvidenceSummary(evaluated),
    saturationThresholdDecibans,
    true,
  );
  const card = element('button', {
    type: 'button',
    className: 'inquiry-evidence-panel-target-card inquiry-claim-card',
    dataset: { action: 'investigate-target', claimId: target.id },
    'aria-label': formatMessage(messages.investigateClaimNamed, { claim: target.title }),
  }, [
    element('span', {
      className: 'inquiry-evidence-panel-target-title',
      textContent: target.title,
    }),
    rendered.credibility,
  ]);
  card.style.setProperty('--result-color', rendered.palette.color);
  return card;
}

function sourceReference(source: InquiryContribution): HTMLElement {
  const url = safeHttpUrl(source.url ?? '');
  return url
    ? element('a', { href: url, target: '_blank', rel: 'noreferrer', textContent: source.title })
    : element('span', { textContent: source.title });
}

function sourceBlock(messages: EvidenceDetailMessages, source: InquiryContribution): HTMLElement {
  return element('section', {
    className: 'inquiry-evidence-panel-source',
    'aria-labelledby': 'inquiry-evidence-panel-source-title',
  }, [
    element('h3', {
      id: 'inquiry-evidence-panel-source-title',
      className: 'inquiry-evidence-panel-source-sentence',
      textContent: messages.basedOn,
    }),
    element('ul', { className: 'inquiry-evidence-panel-source-list' }, [
      element('li', {}, [sourceReference(source)]),
    ]),
  ]);
}

export type EvidencePanelOptions = {
  readonly i18n: I18n;
  readonly messages: () => EvidenceDetailMessages;
  readonly strengthMessages: () => StrengthMessages;
  readonly conditionalMessages: () => ConditionalMessages;
  readonly formMessages: () => Pick<FormMessages, 'editDetails'>;
  readonly claimCardMessages: () => ClaimCardMessages;
  readonly callbacks?: EvidencePanelCallbacks;
};

/** Creates the evidence detail surface used by clickable Inquiry diagram steps. */
export function createInquiryEvidencePanel(options: EvidencePanelOptions) {
  const { i18n, callbacks = {} } = options;
  const dialog = element('dialog', {
    id: 'inquiry-evidence-panel',
    className: 'inquiry-evidence-panel',
    'aria-labelledby': 'inquiry-evidence-panel-title',
  });
  document.body.append(dialog);

  let current: PanelState | undefined;
  let backdropPointerDown = false;

  function requireSelection(state: PanelState) {
    const item = evidenceById(state.inquiry, state.evidenceId);
    if (!item) throw new Error(`Missing evidence for panel: ${state.evidenceId}`);
    const premise = claimById(state.inquiry, item.premiseClaimId);
    if (!premise) throw new Error(`Missing premise for panel evidence: ${state.evidenceId}`);
    const source = contributionById(state.inquiry, item.contributionId);
    if (!source) throw new Error(`Missing source for panel evidence: ${state.evidenceId}`);
    const step = stepForEvidence(state.evaluation, item);
    if (!step) throw new Error(`Missing evaluated step for panel evidence: ${state.evidenceId}`);
    const premiseEvaluation = evaluationForClaim(state.evaluation, premise.id);
    if (!premiseEvaluation) throw new Error(`Missing premise evaluation for panel evidence: ${state.evidenceId}`);
    const target = claimById(state.inquiry, item.targetClaimId);
    if (!target) throw new Error(`Missing target claim for panel evidence: ${state.evidenceId}`);
    const targetEvaluation = evaluationForClaim(state.evaluation, target.id);
    if (!targetEvaluation) throw new Error(`Missing target evaluation for panel evidence: ${state.evidenceId}`);
    return { item, premise, source, step, premiseEvaluation, target, targetEvaluation };
  }

  function render() {
    if (!current) return;
    const messages = options.messages();
    const strengthMessages = options.strengthMessages();
    const conditionalMessages = options.conditionalMessages();
    const formMessages = options.formMessages();
    const claimCardMessages = options.claimCardMessages();
    const {
      item, premise, source, step, premiseEvaluation, target, targetEvaluation,
    } = requireSelection(current);
    const saturationThresholdDecibans = current.saturationThresholdDecibans
      ?? DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans;
    const conditionalStrengthDefault = current.conditionalStrengthDefault
      ?? item.impact.deltaMean;
    const forceExtentDecibans = Math.max(
      2 * saturationThresholdDecibans,
      Math.abs(item.impact.deltaMean),
      Math.abs(conditionalStrengthDefault),
    );
    const premiseSummary = claimEvidenceSummary(premiseEvaluation);
    const premiseCredibility = renderClaimCredibility(
      i18n,
      claimCardMessages,
      premiseEvaluation,
      premiseSummary,
      saturationThresholdDecibans,
    );
    const impactPreview = renderEvidenceImpactPreview({
      i18n,
      before: step.before,
      conditional: applyImpact(step.before, item.impact, 1),
      after: step.after,
      premiseWeight: step.premiseWeight,
      premiseState: step.premiseState,
      saturationThresholdDecibans,
      label: i18n.formatMessage(messages.selectedEvidenceImpact, { target: target.title }),
    });
    const title = element('h2', {
      id: 'inquiry-evidence-panel-title',
      className: 'visually-hidden',
      textContent: messages.evidenceDetails,
    });
    const closeButton = element('button', {
      type: 'button',
      className: 'inquiry-evidence-panel-close',
      dataset: { action: 'close' },
      'aria-label': messages.closeEvidenceDetails,
      textContent: '×',
    });
    const premiseBlock = element('section', {
      className: 'inquiry-evidence-panel-premise',
      'aria-labelledby': 'inquiry-evidence-panel-premise-title',
    }, [
      element('h3', {
        id: 'inquiry-evidence-panel-premise-title',
        textContent: messages.premiseHeading,
      }),
      element('p', {
        className: 'inquiry-evidence-panel-premise-title',
        textContent: premise.title,
      }),
      element('div', { className: 'inquiry-evidence-panel-premise-condition' }, [
        element('span', { textContent: messages.premiseIs }),
        element('span', { className: 'inquiry-evidence-panel-premise-choice' }, [
          createPremiseConditionControl({
            label: messages.premiseCondition,
            initialState: step.premiseState,
            trueLabel: messages.premiseTrue,
            falseLabel: messages.premiseFalse,
            changeToTrue: messages.changeToTrue,
            changeToFalse: messages.changeToFalse,
            onChange: ({ premiseState }) => changePremiseState(premiseState),
          }).element,
          element('span', { textContent: messages.premiseConditionSuffix }),
        ]),
      ]),
    ]);
    const premiseCredibilityValue = credibilityInterval(
      i18n,
      i18n.formatMessage,
      messages,
      premiseEvaluation,
      premiseCredibility.palette.color,
    );
    const estimatedProbability = metricValue(
      formattedPremiseWeight(i18n, step.premiseWeight),
      premiseCredibility.palette.color,
    );
    const premiseTitleValue = element('span', {
      className: 'inquiry-evidence-panel-premise-link-title',
      textContent: premise.title,
    });
    const premiseWeightingSentence = localizedNodeParts(
      i18n.formatMessage,
      messages.premiseWeightingSentence,
      { condition: step.premiseState === 'true' ? messages.premiseTrue : messages.premiseFalse },
      {
        claim: premiseTitleValue,
        interval: premiseCredibilityValue,
        weight: estimatedProbability,
      },
    );
    const premiseEvidencePreview = renderClaimEvidencePreview(premiseEvaluation);
    const premiseLink = element('button', {
      type: 'button',
      className: `inquiry-evidence-panel-premise-link${premiseEvidencePreview ? ' has-evidence-preview' : ''}`,
      dataset: { action: 'investigate-premise', claimId: premise.id },
      'aria-label': [
        i18n.formatMessage(messages.investigateClaimNamed, { claim: premise.title }),
        premiseWeightingSentence.map((part) => part.textContent).join(''),
      ].join('. '),
    }, [
      premiseEvidencePreview,
      element('span', { className: 'inquiry-evidence-panel-premise-link-content' }, [
        element('span', {
          className: 'inquiry-evidence-panel-premise-link-sentence',
        }, premiseWeightingSentence),
      ]),
      element('span', {
        className: 'inquiry-evidence-panel-premise-link-arrow',
        'aria-hidden': 'true',
        textContent: '↗',
      }),
    ]);
    premiseLink.style.setProperty('--result-color', premiseCredibility.palette.color);
    const effectBlock = element('section', {
      className: 'inquiry-evidence-panel-effect',
      'aria-labelledby': 'inquiry-evidence-panel-effect-title',
    }, [
      element('h3', {
        id: 'inquiry-evidence-panel-effect-title',
        dataset: { narrativeHeading: '' },
        textContent: narrativeHeading(messages, step.premiseWeight),
      }),
      premiseLink,
    ]);
    const conclusionBlock = element('section', {
      className: 'inquiry-evidence-panel-conclusion',
      'aria-labelledby': 'inquiry-evidence-panel-conclusion-title',
    }, [
      element('h3', {
        id: 'inquiry-evidence-panel-conclusion-title',
        textContent: messages.currentImpactIntro,
      }),
      element('div', { className: 'inquiry-evidence-panel-conclusion-content' }, [
        impactPreview,
        hasZeroAssignedImpact(item) ? element('p', {
          className: 'inquiry-evidence-panel-no-additional-effect',
          textContent: strengthMessages.noAdditionalEffectShort,
        }) : undefined,
      ]),
    ]);
    const conditional = conditionalStrengthView(
      i18n, conditionalMessages, i18n.formatMessage, item, conditionalStrengthDefault,
      saturationThresholdDecibans, forceExtentDecibans,
      target,
      targetClaimCard(i18n, messages, claimCardMessages, i18n.formatMessage, target, targetEvaluation, saturationThresholdDecibans),
      changeConditionalStrength,
    );
    const body = element('div', { className: 'inquiry-evidence-panel-body' }, [
      premiseBlock,
      sourceBlock(messages, source),
      conditional.primarySection,
      conditional.targetSection,
      effectBlock,
      conclusionBlock,
    ]);
    const footer = element('footer', { className: 'inquiry-evidence-panel-actions' }, [
      element('button', {
        type: 'button',
        dataset: { action: 'edit-evidence', evidenceId: item.id },
        textContent: formMessages.editDetails,
      }),
      element('button', {
        type: 'button',
        className: 'is-danger',
        dataset: { action: 'remove-evidence', evidenceId: item.id },
        textContent: messages.removeEvidence,
      }),
    ]);
    dialog.replaceChildren(title, closeButton, body, footer);
  }

  function close(): void {
    if (dialog.open) dialog.close();
  }

  function selectedState(): PanelState {
    if (!current) throw new Error('Evidence panel has no current selection.');
    return current;
  }

  function acceptPanelState(next: PanelState | undefined): boolean {
    if (!next) return false;
    const previous = selectedState();
    current = { ...previous, ...next, evidenceId: previous.evidenceId };
    return true;
  }

  function updateLiveEffect(): void {
    const messages = options.messages();
    const claimCardMessages = options.claimCardMessages();
    const state = selectedState();
    const { item, step, target, targetEvaluation } = requireSelection(state);
    const threshold = state.saturationThresholdDecibans
      ?? DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans;
    const impactPreview = dialog.querySelector('.inquiry-evidence-impact-preview');
    impactPreview?.replaceWith(renderEvidenceImpactPreview({
      i18n,
      before: step.before,
      conditional: applyImpact(step.before, item.impact, 1),
      after: step.after,
      premiseWeight: step.premiseWeight,
      premiseState: step.premiseState,
      saturationThresholdDecibans: threshold,
      label: i18n.formatMessage(messages.selectedEvidenceImpact, { target: target.title }),
    }));
    dialog.querySelector('.inquiry-evidence-panel-target-card')?.replaceWith(
      targetClaimCard(i18n, messages, claimCardMessages, i18n.formatMessage, target, targetEvaluation, threshold),
    );
  }

  function changeConditionalStrength(deltaMean: number): boolean {
    const state = selectedState();
    const { item } = requireSelection(state);
    if (deltaMean === item.impact.deltaMean) return false;
    const next = callbacks.onConditionalStrengthChange?.(state.evidenceId, deltaMean);
    if (!acceptPanelState(next)) return false;
    updateLiveEffect();
    return true;
  }

  function changePremiseState(premiseState: 'true' | 'false'): void {
    const state = selectedState();
    const { item } = requireSelection(state);
    if ((item.premiseState ?? 'true') === premiseState) return;
    const next = callbacks.onPremiseStateChange?.({ evidenceId: state.evidenceId, premiseState });
    if (!acceptPanelState(next)) return;
    render();
    requestAnimationFrame(() => {
      dialog.querySelector<HTMLButtonElement>(`button[data-premise-state="${premiseState}"]`)?.focus();
    });
  }

  dialog.addEventListener('click', (event: MouseEvent) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-action]')
      : null;
    if (!button) return;
    const { action, evidenceId, claimId } = button.dataset;
    if (action === 'close') close();
    else if (action === 'investigate-premise' || action === 'investigate-target') {
      close();
      callbacks.onInvestigate?.(claimId);
    } else if (action === 'edit-evidence') {
      close();
      callbacks.onEditEvidence?.(evidenceId);
    } else if (action === 'remove-evidence') {
      close();
      callbacks.onRemoveEvidence?.(evidenceId);
    }
  });
  dialog.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  });
  document.addEventListener('pointerdown', (event: PointerEvent) => {
    backdropPointerDown = dialog.open && event.target instanceof Node && !dialog.contains(event.target);
  });
  document.addEventListener('click', (event: MouseEvent) => {
    if (!dialog.open || !backdropPointerDown) return;
    backdropPointerDown = false;
    // Selecting another plotted evidence replaces this drawer's contents.
    if (event.target instanceof Element && event.target.closest('.inquiry-flow-evidence[data-evidence-id]')) return;
    if (event.target instanceof Node && !dialog.contains(event.target)) close();
  });
  return {
    element: dialog,
    open(state: PanelState): void {
      requireSelection(state);
      current = state;
      render();
      if (!dialog.open) dialog.show();
    },
    close,
    setSaturationThreshold(saturationThresholdDecibans: number): void {
      if (!current) return;
      current = { ...current, saturationThresholdDecibans };
      render();
    },
    setLocale() { render(); },
  };
}
