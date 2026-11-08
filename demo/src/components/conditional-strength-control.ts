import {
  evidenceStrengthColor,
  jeffreysBand,
} from '@bycelium/evidence-diagrams';
import { readableMetricColor } from '../color.ts';
import { element } from '../html-element.ts';
import type { I18n } from '../i18n/index.ts';
import { signedNumber } from '../presentation.ts';
import { renderForceArrow, updateForceArrow } from './force-arrow.ts';
import { renderForceScaleRuler } from './force-scale.ts';

export interface ConditionalMessages {
  readonly thenEvidenceStrength: string;
  readonly thenEvidenceNoDirection: string;
  readonly conditionalMagnitude: string;
  readonly conditionalBand: {
    readonly anecdotal: string;
    readonly weak: string;
    readonly moderate: string;
    readonly strong: string;
    readonly very_strong: string;
    readonly decisive: string;
  };
  readonly conditionalBandSentence: {
    readonly anecdotal: string;
    readonly weak: string;
    readonly moderate: string;
    readonly strong: string;
    readonly very_strong: string;
    readonly decisive: string;
  };
  readonly conditionalRelationOpposition: string;
  readonly conditionalRelationSupport: string;
  readonly conditionalRelationNeutral: string;
  readonly conditionalRelationHeadingOpposition: string;
  readonly conditionalRelationHeadingSupport: string;
  readonly conditionalRelationHeadingNeutral: string;
  readonly conditionalScaleTick: string;
  readonly adaptedJeffreysScale: string;
  readonly conditionalStrengthHandle: string;
  readonly resetConditionalStrength: string;
  readonly conditionalOpposition: string;
  readonly conditionalSupport: string;
  readonly directionalStrengthNone: string;
}

type ConditionalStrengthControlOptions = {
  readonly messages: ConditionalMessages;
  readonly formatMessage: I18n['formatMessage'];
  readonly number: I18n['number'];
  readonly targetTitle: string;
  readonly value?: number;
  readonly defaultValue?: number;
  readonly saturationThresholdDecibans: number;
  readonly forceExtentDecibans?: number;
  readonly panelNarrative?: boolean;
  readonly panelTargetContent?: Node;
  readonly headingId?: string;
  readonly onInput?: (value: number) => void;
};

type ConditionalStrengthControl = {
  readonly element: HTMLDivElement;
  readonly targetSection?: HTMLElement;
  readonly value: () => number;
};

type ConditionalBandIdentifier = keyof ConditionalMessages['conditionalBand'];

function strengthAmount(number: I18n['number'], value: number): string {
  return `${signedNumber({ number }, value)}\u00a0dBan`;
}

function conditionalBandIdentifier(value: number): ConditionalBandIdentifier {
  switch (jeffreysBand({ weightDecibans: value })) {
    case 'anecdotal':
    case 'anecdotal against': return 'anecdotal';
    case 'weak':
    case 'weak against': return 'weak';
    case 'moderate':
    case 'moderate against': return 'moderate';
    case 'strong':
    case 'strong against': return 'strong';
    case 'very strong':
    case 'very strong against': return 'very_strong';
    case 'decisive':
    case 'decisive against': return 'decisive';
    case 'none': throw new RangeError('A directional strength must be non-zero.');
  }
}

function updateMetric(
  metric: HTMLElement,
  messages: ConditionalMessages,
  formatMessage: I18n['formatMessage'],
  number: I18n['number'],
  value: number,
  saturationThresholdDecibans: number,
): void {
  if (Math.abs(value) <= 1e-12) {
    metric.textContent = messages.directionalStrengthNone;
    return;
  }
  const amount = strengthAmount(number, value);
  const token = '__INQUIRY_AMOUNT__';
  const formatted = formatMessage(messages.conditionalMagnitude, {
    strength: messages.conditionalBand[conditionalBandIdentifier(value)], amount: token,
  });
  const index = formatted.indexOf(token);
  const numeric = element('strong', { className: 'inquiry-evidence-panel-metric-value', textContent: amount });
  numeric.style.setProperty('--metric-color', readableMetricColor(evidenceStrengthColor({
    netWeightDecibans: value,
    absoluteWeightDecibans: Math.abs(value),
    dissonance: 0,
  }, { saturationThresholdDecibans })));
  metric.replaceChildren(
    document.createTextNode(formatted.slice(0, index)), numeric,
    document.createTextNode(formatted.slice(index + token.length)),
  );
}

function updatePanelHeading(
  heading: HTMLElement,
  messages: ConditionalMessages,
  formatMessage: I18n['formatMessage'],
  value: number,
): void {
  if (Math.abs(value) <= 1e-12) {
    heading.textContent = messages.thenEvidenceNoDirection;
    return;
  }
  heading.textContent = formatMessage(messages.thenEvidenceStrength, {
    strength: messages.conditionalBandSentence[conditionalBandIdentifier(value)],
  });
}

export function createConditionalStrengthControl({
  messages,
  formatMessage,
  number,
  targetTitle,
  value = 0,
  defaultValue = value,
  saturationThresholdDecibans,
  forceExtentDecibans = 2 * saturationThresholdDecibans,
  panelNarrative = false,
  panelTargetContent,
  headingId,
  onInput,
}: ConditionalStrengthControlOptions): ConditionalStrengthControl {
  const minimum = -forceExtentDecibans;
  const maximum = forceExtentDecibans;
  let current = value;
  const metric = element('span', { className: 'inquiry-conditional-strength-metric' });
  const input = element('input', {
    type: 'range', className: 'inquiry-conditional-strength-input', min: minimum, max: maximum, step: 1,
    'aria-label': formatMessage(messages.conditionalStrengthHandle, { target: targetTitle }),
  });
  const arrow = renderForceArrow(0, forceExtentDecibans);
  const visual = element('div', {
    className: 'inquiry-force-arrow-layer inquiry-conditional-strength-visual', 'aria-hidden': 'true',
  }, [arrow]);
  const heading = panelNarrative ? element('h3', {
    id: headingId, className: 'inquiry-conditional-strength-heading',
  }) : undefined;
  const relation = element(panelNarrative ? 'h3' : 'p', {
    id: panelNarrative ? `${headingId}-target` : undefined,
    className: 'inquiry-conditional-strength-relation',
  });
  const reset = element('button', {
    type: 'button', className: 'inquiry-conditional-strength-reset',
    title: messages.resetConditionalStrength, 'aria-label': messages.resetConditionalStrength, textContent: '↺',
  });

  function setValue(next: number): void {
    current = next;
    const visibleValue = Math.max(minimum, Math.min(maximum, current));
    input.value = String(visibleValue);
    input.classList.toggle('is-clipped', visibleValue !== current);
    reset.disabled = Math.abs(current - defaultValue) <= 1e-12;
    updateForceArrow(arrow, visibleValue, forceExtentDecibans);
    updateMetric(metric, messages, formatMessage, number, current, saturationThresholdDecibans);
    if (heading) updatePanelHeading(heading, messages, formatMessage, current);
    relation.textContent = current < 0
      ? (panelNarrative ? messages.conditionalRelationHeadingOpposition : messages.conditionalRelationOpposition)
      : current > 0
        ? (panelNarrative ? messages.conditionalRelationHeadingSupport : messages.conditionalRelationSupport)
        : (panelNarrative ? messages.conditionalRelationHeadingNeutral : messages.conditionalRelationNeutral);
    input.setAttribute('aria-valuetext', metric.textContent ?? '');
  }

  input.addEventListener('input', () => { setValue(Number(input.value)); onInput?.(current); });
  reset.addEventListener('click', () => {
    if (Math.abs(current - defaultValue) <= 1e-12) return;
    setValue(defaultValue); onInput?.(current); input.focus();
  });
  setValue(current);

  const control = element('div', { className: 'inquiry-conditional-strength-control' }, [
    visual, input, renderForceScaleRuler(messages, { number }, formatMessage, forceExtentDecibans),
    element('div', { className: 'inquiry-conditional-strength-legend', 'aria-hidden': 'true' }, [
      element('span', { textContent: messages.conditionalOpposition }),
      element('span', { textContent: messages.conditionalSupport }),
    ]),
  ]);
  const target = element('p', { className: 'inquiry-conditional-strength-target', textContent: targetTitle });
  const children = panelNarrative ? [reset, heading, control] : [reset, metric, control, relation, target];
  const targetSection = panelNarrative ? element('section', {
    className: 'inquiry-evidence-panel-target', 'aria-labelledby': relation.id,
  }, [relation, panelTargetContent ?? target]) : undefined;
  return {
    element: element('div', { className: `inquiry-conditional-strength${panelNarrative ? ' is-panel-narrative' : ''}` }, children),
    targetSection, value: () => current,
  };
}
