import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createI18n,
  localeRegistry,
  messageAtPath,
  resolveInitialLocale,
  resolveLocale,
} from './index.ts';

function messageLeaves(
  value: object,
  prefix = '',
  result = new Map<string, string>(),
): Map<string, string> {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') result.set(path, entry);
    else if (entry && typeof entry === 'object') messageLeaves(entry, path, result);
  }
  return result;
}

function placeholders(entry: string): string[] {
  return [...new Set(
    [...entry.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map((match) => match[1]!),
  )].sort();
}

test('translations preserve interpolation placeholders', () => {
  const english = messageLeaves(localeRegistry.en.messages);
  const french = messageLeaves(localeRegistry.fr.messages);
  for (const [key, message] of english) {
    assert.deepEqual(placeholders(french.get(key) ?? ''), placeholders(message), key);
  }
});

test('the HTML template only references declared message keys', async () => {
  const template = await readFile(new URL('../index.template.html', import.meta.url), 'utf8');
  const keys = [...template.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/gu)]
    .map((match) => match[1]!);
  assert.ok(keys.length > 0);
  for (const key of keys) assert.equal(typeof messageAtPath(localeRegistry.en.messages, key), 'string', key);
});

test('unsupported locales safely fall back to English', () => {
  assert.equal(resolveLocale('unknown'), 'en');
  const i18n = createI18n('unknown');
  assert.equal(i18n.locale, 'en');
  assert.equal(i18n.messages.inquiry.page.heading, 'Evidence inquiry');
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

test('translation handles interpolation and locale-aware numbers', () => {
  const i18n = createI18n('en');
  assert.equal(
    i18n.formatMessage(i18n.messages.inquiry.diagram.combinedEvidence, { strength: 'Strong' }),
    'Combined evidence: Strong',
  );
  i18n.setLocale('fr');
  assert.equal(i18n.number(12.5, { maximumFractionDigits: 1 }), '12,5');
  assert.equal(i18n.percent(.998, { maximumFractionDigits: 1 }), '99,8 %');
});
