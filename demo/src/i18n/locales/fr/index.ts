import { band } from './band.ts';
import { measure, palette, action, theme } from './interface.ts';
import { inquiry } from './inquiry.ts';
import { legal } from './legal.ts';
import type { LocaleDefinition } from '../../index.ts';

export const fr = {
  meta: {
  "id": "fr",
  "label": "Français",
  "htmlLang": "fr",
  "numberLocale": "fr-FR"
},
  messages: { band, measure, palette, action, theme, inquiry, legal },
} satisfies LocaleDefinition<'fr'>;
