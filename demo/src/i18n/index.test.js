import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createI18n,
  localeRegistry,
  resolveInitialLocale,
  resolveLocale,
  supportedLocales,
} from './index.js';

function placeholders(entry) {
  return [...new Set(
    [...entry.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map((match) => match[1]),
  )].sort();
}

test('all locale dictionaries expose the same schema', () => {
  const [first, ...rest] = supportedLocales;
  const referenceKeys = Object.keys(localeRegistry[first.id].messages).sort();
  for (const locale of rest) {
    assert.deepEqual(Object.keys(localeRegistry[locale.id].messages).sort(), referenceKeys);
    for (const key of referenceKeys) {
      const reference = localeRegistry[first.id].messages[key];
      const translation = localeRegistry[locale.id].messages[key];
      assert.equal(typeof translation, typeof reference, `${locale.id}:${key} has a compatible message shape`);
      assert.deepEqual(placeholders(translation), placeholders(reference), `${locale.id}:${key} preserves placeholders`);
    }
  }
});

test('unsupported locales safely fall back to English', () => {
  assert.equal(resolveLocale('unknown'), 'en');
  const i18n = createI18n('unknown');
  assert.equal(i18n.locale, 'en');
  assert.equal(i18n.t('inquiry.heading'), 'Evidence inquiry');
});

test('saved manual locale takes precedence over browser languages', () => {
  assert.equal(resolveInitialLocale('fr', ['en-US']), 'fr');
});

test('an invalid saved locale falls back to a supported browser language', () => {
  assert.equal(resolveInitialLocale('unknown', ['fr-FR']), 'fr');
});

test('browser BCP 47 language tags resolve supported base locales case-insensitively', () => {
  assert.equal(resolveInitialLocale(null, ['FR-ca']), 'fr');
});

test('the first supported browser language is selected after unsupported entries', () => {
  assert.equal(resolveInitialLocale(null, ['de-DE', 'fr-CA', 'en-US']), 'fr');
});

test('empty browser language lists fall back to English', () => {
  assert.equal(resolveInitialLocale(null, []), 'en');
});

test('a missing localized message falls back to English', () => {
  const previous = localeRegistry.fr.messages['inquiry.heading'];
  delete localeRegistry.fr.messages['inquiry.heading'];
  try {
    assert.equal(createI18n('fr').t('inquiry.heading'), 'Evidence inquiry');
  } finally {
    localeRegistry.fr.messages['inquiry.heading'] = previous;
  }
});

test('translation handles interpolation and locale-aware numbers', () => {
  const i18n = createI18n('en');
  assert.equal(
    i18n.t('inquiry.combinedEvidence', { strength: 'Strong' }),
    'Combined evidence: Strong',
  );
  i18n.setLocale('fr');
  assert.equal(i18n.number(12.5, { maximumFractionDigits: 1 }), '12,5');
  assert.equal(i18n.percent(.998, { maximumFractionDigits: 1 }), '99,8 %');
});
