import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvedTheme, storedTheme } from './theme-control.ts';

test('theme preferences override the system and unknown values use it', () => {
  assert.equal(storedTheme('light'), 'light');
  assert.equal(storedTheme('dark'), 'dark');
  assert.equal(storedTheme('system'), undefined);
  assert.equal(resolvedTheme(undefined, false), 'light');
  assert.equal(resolvedTheme(undefined, true), 'dark');
  assert.equal(resolvedTheme('light', true), 'light');
  assert.equal(resolvedTheme('dark', false), 'dark');
});
