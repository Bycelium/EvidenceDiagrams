import {
  JEFFREYS_THRESHOLDS_DECIBANS,
  jeffreysBand,
} from '@bycelium/evidence-diagrams';
import type { I18n } from '../i18n/index.ts';
import { element } from '../html-element.ts';
import { signedNumber } from '../presentation.ts';
import type { ConditionalMessages } from './conditional-strength-control.ts';

type ConditionalBandIdentifier = 'anecdotal' | 'weak' | 'moderate' | 'strong' | 'very_strong' | 'decisive';

function bandIdentifier(value: number): ConditionalBandIdentifier {
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

function bandLabel(messages: ConditionalMessages, value: number): string {
  return messages.conditionalBand[bandIdentifier(value)];
}

export function renderForceScaleRuler(
  messages: ConditionalMessages,
  i18n: Pick<I18n, 'number'>,
  formatMessage: I18n['formatMessage'],
  extentDecibans: number,
): HTMLDivElement {
  const minimum = -extentDecibans;
  const maximum = extentDecibans;
  const values = new Set([minimum, 0, maximum]);
  for (const threshold of JEFFREYS_THRESHOLDS_DECIBANS) {
    if (threshold <= extentDecibans) values.add(threshold);
    if (-threshold >= minimum) values.add(-threshold);
  }
  return element('div', {
    className: 'inquiry-force-scale-ruler',
    title: messages.adaptedJeffreysScale,
    'aria-label': messages.adaptedJeffreysScale,
  }, [...values].sort((a, b) => a - b).map((value) => {
    const strength = value === 0 ? messages.directionalStrengthNone : bandLabel(messages, value);
    const amount = `${signedNumber(i18n, value, 1)}\u00a0dBan`;
    const showLabel = value === minimum || value === maximum || value === 0
      || Math.abs(value) === 10 || Math.abs(value) === 20;
    return element('span', {
      className: `inquiry-force-scale-tick${showLabel ? ' has-label' : ''}`,
      style: `left: ${(value - minimum) / (maximum - minimum) * 100}%`,
      role: 'img',
      title: formatMessage(messages.conditionalScaleTick, { strength, amount }),
      'aria-label': formatMessage(messages.conditionalScaleTick, { strength, amount }),
    }, [
      element('span', { className: 'inquiry-force-scale-tick-line' }),
      ...(showLabel ? [element('span', {
        className: 'inquiry-force-scale-tick-label',
        textContent: value === 0 ? amount : signedNumber(i18n, value, 1),
      })] : []),
    ]);
  }));
}
