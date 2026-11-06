import { en } from './locales/en/index.ts';
import { fr } from './locales/fr/index.ts';
import type { LegalMessages } from '../components/legal-information.ts';
import type { ClaimCardMessages } from '../components/claim-card.ts';
import type { ConditionalMessages } from '../components/conditional-strength-control.ts';
import type { EvidenceDetailMessages } from '../components/evidence-panel.ts';
import type { FormMessages } from '../components/inquiry-forms.ts';
import type { MeasureMessages } from '../diagram/evidence-summary.ts';
import type { PaletteMessages } from '../diagram/color-legend.ts';
import type { BandMessages, StrengthMessages } from '../presentation.ts';
import type { ClaimDiagramMessages } from '../inquiry/claim-diagram.ts';
import type { NavigationMessages } from '../inquiry/claim-navigation.ts';
import type { ActionMessages, PageMessages } from '../main.ts';

export interface InquiryMessages {
  readonly page: PageMessages;
  readonly navigation: NavigationMessages;
  readonly claim: ClaimCardMessages;
  readonly diagram: ClaimDiagramMessages;
  readonly strength: StrengthMessages;
  readonly detail: EvidenceDetailMessages;
  readonly conditional: ConditionalMessages;
  readonly form: FormMessages;
}

export type LocaleMessages = {
  readonly band: BandMessages;
  readonly measure: MeasureMessages;
  readonly palette: PaletteMessages;
  readonly action: ActionMessages;
  readonly inquiry: InquiryMessages;
  readonly legal: LegalMessages;
};

export type LocaleDefinition<Id extends string> = {
  readonly meta: {
    readonly id: Id;
    readonly label: string;
    readonly htmlLang: string;
    readonly numberLocale: string;
  };
  readonly messages: LocaleMessages;
};

export const localeRegistry = Object.freeze({ en, fr });
export type LocaleId = keyof typeof localeRegistry;
export const DEFAULT_LOCALE: LocaleId = 'en';

export type InterpolationValues = Readonly<Record<string, unknown>>;

export type I18n = {
  readonly locale: LocaleId;
  readonly meta: (typeof localeRegistry)[LocaleId]['meta'];
  readonly messages: LocaleMessages;
  setLocale(nextLocale: unknown): LocaleId;
  formatMessage(template: string, values?: InterpolationValues): string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  percent(value: number, options?: Intl.NumberFormatOptions): string;
};

export function formatMessage(
  template: string,
  values: InterpolationValues = {},
): string {
  return template.replace(/\{([a-zA-Z][\w]*)\}/g, (match, key: string) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

export function messageAtPath(messages: object, path: string): string | undefined {
  let current: unknown = messages;
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

export function resolveLocale(locale: unknown): LocaleId {
  return typeof locale === 'string' && Object.hasOwn(localeRegistry, locale)
    ? locale as LocaleId
    : DEFAULT_LOCALE;
}

function localeForPreference(preference: unknown): LocaleId | undefined {
  if (typeof preference !== 'string') return undefined;
  const baseLocale = preference.trim().split('-')[0]?.toLowerCase();
  return (Object.keys(localeRegistry) as LocaleId[])
    .find((locale) => locale.toLowerCase() === baseLocale);
}

export function resolveInitialLocale(
  storageValue: unknown,
  browserLanguages: readonly string[] | string = [],
): LocaleId {
  const storedLocale = localeForPreference(storageValue);
  if (storedLocale) return storedLocale;

  const preferences = Array.isArray(browserLanguages) ? browserLanguages : [browserLanguages];
  for (const preference of preferences) {
    const locale = localeForPreference(preference);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function createI18n(initialLocale: unknown = DEFAULT_LOCALE): I18n {
  let locale = resolveLocale(initialLocale);
  return {
    get locale() { return locale; },
    get meta() { return localeRegistry[locale].meta; },
    get messages() { return localeRegistry[locale].messages; },
    setLocale(nextLocale) { locale = resolveLocale(nextLocale); return locale; },
    formatMessage,
    number(value, options = {}) {
      return new Intl.NumberFormat(localeRegistry[locale].meta.numberLocale, options).format(value);
    },
    percent(value, options = {}) {
      return new Intl.NumberFormat(localeRegistry[locale].meta.numberLocale, {
        style: 'percent',
        maximumFractionDigits: 1,
        ...options,
      }).format(value);
    },
  };
}
