import {
  JEFFREYS_THRESHOLDS_DECIBANS,
  jeffreysBand,
} from '@bycelium/evidence-diagrams';
import { element } from '../dom.js';
import { signedNumber } from '../presentation.js';

function bandLabel(i18n, value) {
  const band = jeffreysBand({ weightDecibans: value }).replace(' against', '');
  return i18n.t(`inquiry.conditionalBand.${band}`);
}

export function renderForceScaleRuler(i18n, extentDecibans) {
  const minimum = -extentDecibans;
  const maximum = extentDecibans;
  const values = new Set([minimum, 0, maximum]);
  for (const threshold of JEFFREYS_THRESHOLDS_DECIBANS) {
    if (threshold <= extentDecibans) values.add(threshold);
    if (-threshold >= minimum) values.add(-threshold);
  }
  return element('div', {
    className: 'inquiry-force-scale-ruler',
    title: i18n.t('inquiry.adaptedJeffreysScale'),
    'aria-label': i18n.t('inquiry.adaptedJeffreysScale'),
  }, [...values].sort((a, b) => a - b).map((value) => {
    const strength = value === 0
      ? i18n.t('inquiry.directionalStrengthNone')
      : bandLabel(i18n, value);
    const amount = `${signedNumber(i18n, value, 1)}\u00a0dBan`;
    const showLabel = value === minimum || value === maximum || value === 0
      || Math.abs(value) === 10 || Math.abs(value) === 20;
    return element('span', {
      className: `inquiry-force-scale-tick${showLabel ? ' has-label' : ''}`,
      style: `left: ${(value - minimum) / (maximum - minimum) * 100}%`,
      role: 'img',
      title: i18n.t('inquiry.conditionalScaleTick', { strength, amount }),
      'aria-label': i18n.t('inquiry.conditionalScaleTick', { strength, amount }),
    }, [
      element('span', { className: 'inquiry-force-scale-tick-line' }),
      ...(showLabel ? [element('span', {
        className: 'inquiry-force-scale-tick-label',
        textContent: value === 0 ? amount : signedNumber(i18n, value, 1),
      })] : []),
    ]);
  }));
}
