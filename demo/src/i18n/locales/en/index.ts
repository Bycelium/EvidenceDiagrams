import { band } from './band.ts';
import { measure, palette, action, theme } from './interface.ts';
import { inquiry } from './inquiry.ts';
import { legal } from './legal.ts';
import type { LocaleDefinition } from '../../index.ts';

export const en = {
  meta: {
  "id": "en",
  "label": "English",
  "htmlLang": "en",
  "numberLocale": "en"
},
  messages: { band, measure, palette, action, theme, inquiry, legal },
} satisfies LocaleDefinition<'en'>;
