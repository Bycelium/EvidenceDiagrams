import { jeffreysBand } from '@bycelium/evidence-diagrams';

export function signedNumber(i18n, value, maximumFractionDigits = 0) {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${i18n.number(Math.abs(value), { maximumFractionDigits })}`;
}

export function formatDissonance(i18n, value) {
  return i18n.percent(value, { maximumFractionDigits: 0 });
}

export function formatJeffreysStrength(i18n, weightDecibans) {
  const band = jeffreysBand({ weightDecibans }).replace(' against', '');
  return i18n.t(`band.${band}`);
}

function formatDecibans(i18n, value) {
  return `${signedNumber(i18n, value)}\u00a0dBan`;
}

export function formatStrengthChange(
  i18n,
  before,
  after,
  noneKey = 'inquiry.strengthNone',
) {
  const meanShift = after.mean - before.mean;
  const widthShift = after.standardDeviation - before.standardDeviation;
  if (Math.abs(meanShift) > 1e-12) {
    return i18n.t(
      meanShift > 0 ? 'inquiry.strengthSupportDetail' : 'inquiry.strengthOppositionDetail',
      {
        strength: formatJeffreysStrength(i18n, meanShift),
        amount: formatDecibans(i18n, meanShift),
      },
    );
  }
  if (Math.abs(widthShift) > 1e-12) {
    return i18n.t('inquiry.strengthWidthDetail', { amount: formatDecibans(i18n, widthShift) });
  }
  return i18n.t(noneKey);
}
