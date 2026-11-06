import type { I18n } from '../i18n/index.ts';

export interface ThemeMessages {
  readonly switchToLight: string;
  readonly switchToDark: string;
}

export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'evidence-diagrams.theme';

export function storedTheme(value: unknown): Theme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}

export function resolvedTheme(preference: unknown, systemDark: boolean): Theme {
  return storedTheme(preference) ?? (systemDark ? 'dark' : 'light');
}

function readStoredTheme(): Theme | undefined {
  try { return storedTheme(localStorage.getItem(THEME_STORAGE_KEY)); } catch { return undefined; }
}

function saveTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Privacy modes may disable storage. */ }
}

export function mountThemeControls(i18n: I18n): { setLocale(): void } {
  const controls = [...document.querySelectorAll<HTMLButtonElement>('.theme-toggle')];
  if (controls.length === 0) throw new Error('Missing theme controls');
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = readStoredTheme();

  function apply(): void {
    const theme = resolvedTheme(preference, query.matches);
    document.documentElement.dataset.theme = theme;
    const switchTo = theme === 'dark' ? 'light' : 'dark';
    const label = switchTo === 'light' ? i18n.messages.theme.switchToLight : i18n.messages.theme.switchToDark;
    for (const control of controls) {
      control.dataset.switchTo = switchTo;
      control.setAttribute('aria-label', label);
      control.title = label;
    }
  }

  for (const control of controls) control.addEventListener('click', () => {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    saveTheme(preference);
    apply();
  });
  query.addEventListener('change', () => { if (!preference) apply(); });
  apply();
  return { setLocale: apply };
}
