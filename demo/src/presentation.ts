import {
  jeffreysBand,
  type JeffreysBand,
} from '@bycelium/evidence-diagrams';
import type { Gaussian } from '@bycelium/evidence-diagrams/propagation-math';

export interface BandMessages {
  readonly none: string;
  readonly anecdotal: string;
  readonly weak: string;
  readonly moderate: string;
  readonly strong: string;
  readonly very_strong: string;
  readonly decisive: string;
  readonly anecdotal_against: string;
  readonly weak_against: string;
  readonly moderate_against: string;
  readonly strong_against: string;
  readonly very_strong_against: string;
  readonly decisive_against: string;
}

export interface StrengthMessages {
  readonly combinedNone: string;
  readonly strengthSupport: string;
  readonly strengthOpposition: string;
  readonly strengthWidth: string;
  readonly strengthSupportDetail: string;
  readonly strengthOppositionDetail: string;
  readonly strengthWidthDetail: string;
  readonly strengthNone: string;
  readonly noAdditionalEffectShort: string;
}

export interface PresentationI18n {
  readonly messages: {
    readonly band: BandMessages;
    readonly inquiry: {
      readonly strength: StrengthMessages;
    };
  };
  formatMessage(template: string, values?: Readonly<Record<string, unknown>>): string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  percent(value: number, options?: Intl.NumberFormatOptions): string;
}

const POSITIVE_BAND_FIELDS = {
  none: 'none',
  anecdotal: 'anecdotal',
  weak: 'weak',
  moderate: 'moderate',
  strong: 'strong',
  'very strong': 'very_strong',
  decisive: 'decisive',
  'anecdotal against': 'anecdotal',
  'weak against': 'weak',
  'moderate against': 'moderate',
  'strong against': 'strong',
  'very strong against': 'very_strong',
  'decisive against': 'decisive',
} as const satisfies Record<JeffreysBand, keyof BandMessages>;

export function signedNumber(
  i18n: Pick<PresentationI18n, 'number'>,
  value: number,
  maximumFractionDigits = 0,
): string {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${i18n.number(Math.abs(value), { maximumFractionDigits })}`;
}

export function formatDissonance(
  i18n: Pick<PresentationI18n, 'percent'>,
  value: number,
): string {
  return i18n.percent(value, { maximumFractionDigits: 0 });
}

export function formatJeffreysStrength(
  i18n: Pick<PresentationI18n, 'messages'>,
  weightDecibans: number,
): string {
  const field = POSITIVE_BAND_FIELDS[jeffreysBand({ weightDecibans })];
  return i18n.messages.band[field];
}

function formatDecibans(i18n: Pick<PresentationI18n, 'number'>, value: number): string {
  return `${signedNumber(i18n, value)}\u00a0dBan`;
}

export function formatStrengthChange(
  i18n: PresentationI18n,
  before: Gaussian,
  after: Gaussian,
  noneMessage: string = i18n.messages.inquiry.strength.strengthNone,
): string {
  const meanShift = after.mean - before.mean;
  const widthShift = after.standardDeviation - before.standardDeviation;
  if (Math.abs(meanShift) > 1e-12) {
    return i18n.formatMessage(
      meanShift > 0
        ? i18n.messages.inquiry.strength.strengthSupportDetail
        : i18n.messages.inquiry.strength.strengthOppositionDetail,
      {
        strength: formatJeffreysStrength(i18n, meanShift),
        amount: formatDecibans(i18n, meanShift),
      },
    );
  }
  if (Math.abs(widthShift) > 1e-12) {
    return i18n.formatMessage(
      i18n.messages.inquiry.strength.strengthWidthDetail,
      { amount: formatDecibans(i18n, widthShift) },
    );
  }
  return noneMessage;
}
