import { en } from './locales/en.js';
import { fr } from './locales/fr.js';

export const localeRegistry = Object.freeze({ en, fr });
export const supportedLocales = Object.freeze(Object.values(localeRegistry).map(({ meta }) => meta));
export const DEFAULT_LOCALE = 'en';

function interpolate(template, values) {
  return template.replace(/\{([a-zA-Z][\w]*)\}/g, (match, key) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

export function resolveLocale(locale) {
  return Object.hasOwn(localeRegistry, locale) ? locale : DEFAULT_LOCALE;
}

function localeForPreference(preference) {
  if (typeof preference !== 'string') return undefined;
  const baseLocale = preference.trim().split('-')[0]?.toLowerCase();
  return Object.keys(localeRegistry).find((locale) => locale.toLowerCase() === baseLocale);
}

export function resolveInitialLocale(storageValue, browserLanguages = []) {
  const storedLocale = localeForPreference(storageValue);
  if (storedLocale) return storedLocale;

  const preferences = Array.isArray(browserLanguages) ? browserLanguages : [browserLanguages];
  for (const preference of preferences) {
    const locale = localeForPreference(preference);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function createI18n(initialLocale = DEFAULT_LOCALE) {
  let locale = resolveLocale(initialLocale);
  return {
    get locale() { return locale; },
    get meta() { return localeRegistry[locale].meta; },
    setLocale(nextLocale) { locale = resolveLocale(nextLocale); return locale; },
    t(key, values = {}) {
      const localizedEntry = localeRegistry[locale].messages[key];
      const entry = localizedEntry ?? localeRegistry[DEFAULT_LOCALE].messages[key];
      return interpolate(typeof entry === 'string' ? entry : key, values);
    },
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
