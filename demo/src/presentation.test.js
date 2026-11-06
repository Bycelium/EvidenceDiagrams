import assert from 'node:assert/strict';
import test from 'node:test';

import { createI18n } from './i18n/index.js';
import { formatStrengthChange } from './presentation.js';

test('strength amounts keep their localized number and dBan unit together', () => {
  const before = { mean: 0, standardDeviation: 2 };
  assert.match(
    formatStrengthChange(
      createI18n('fr'), before, { mean: -10 / 3, standardDeviation: 2 },
    ),
    /\(−3\u00a0dBan\)$/u,
  );
  assert.match(
    formatStrengthChange(
      createI18n('en'), before, { mean: 0, standardDeviation: 1 },
    ),
    /\(Δσ −1\u00a0dBan\)$/u,
  );
});
