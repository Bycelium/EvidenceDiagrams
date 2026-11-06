import assert from 'node:assert/strict';
import test from 'node:test';
import { createInquiryPreset } from '../presets/index.ts';
import { createInquirySession } from '../state.ts';
import { localizePresetSession } from './preset-localization.ts';

test('preset localization preserves user additions and edited canonical text', () => {
  const english = createInquiryPreset('nuclear', 'en');
  const french = createInquiryPreset('nuclear', 'fr');
  const session = createInquirySession(english);
  const canonical = session.inquiry.claims[0]!;
  const localizedCanonical = session.inquiry.claims[1]!;
  canonical.title = 'My edited title';
  session.inquiry.claims.push({
    id: 'user-claim', title: 'User claim', description: 'User description',
    prior: { mean: 0, standardDeviation: 5 },
  });
  session.inquiry.contributions.push({
    id: 'user-source', title: 'User source', url: 'https://example.com', locator: 'p. 1',
  });

  localizePresetSession(session, english, french);

  assert.equal(canonical.title, 'My edited title');
  assert.equal(localizedCanonical.title, french.claims[1]!.title);
  assert.equal(session.inquiry.claims.at(-1)!.title, 'User claim');
  assert.equal(session.inquiry.contributions.at(-1)!.title, 'User source');
  assert.equal(session.inquiry.claims.at(-1)!.description, 'User description');
});
