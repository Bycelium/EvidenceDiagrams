import type { I18n } from '../i18n/index.ts';

function storedLocale(): string | undefined {
  try {
    return localStorage.getItem('evidence-diagrams.locale') ?? undefined;
  } catch {
    return undefined;
  }
}

function storeLocale(locale: string): void {
  try {
    localStorage.setItem('evidence-diagrams.locale', locale);
  } catch {
    // File privacy modes may disable storage.
  }
}

export function initialLocale(resolveInitialLocale: (stored: string | undefined, browserLanguages: readonly string[]) => string): string {
  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return resolveInitialLocale(storedLocale(), browserLanguages);
}

export function mountLanguageControl(i18n: I18n, { onLocaleChange }: { onLocaleChange: () => void }): void {
  const requireElement = <ElementType extends Element>(selector: string): ElementType => {
    const target = document.querySelector<ElementType>(selector);
    if (!target) throw new Error(`Missing language control element: ${selector}`);
    return target;
  };
  const container = requireElement<HTMLElement>('.language-control');
  const button = requireElement<HTMLButtonElement>('#language-menu-button');
  const menu = requireElement<HTMLElement>('#language-menu');
  const current = requireElement<HTMLElement>('#language-menu-current');

  function close({ focus = false }: { focus?: boolean } = {}): void {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  }

  function apply(locale: string): void {
    i18n.setLocale(locale);
    const options = menu.querySelectorAll<HTMLElement>('[data-locale]');
    for (const option of options) {
      option.setAttribute('aria-checked', String(option.dataset.locale === i18n.locale));
    }
    current.textContent = menu.querySelector<HTMLElement>(`[data-locale="${i18n.locale}"]`)?.textContent ?? i18n.locale;
    storeLocale(i18n.locale);
    onLocaleChange();
  }

  button.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector<HTMLElement>(`[data-locale="${i18n.locale}"]`)?.focus();
  });
  menu.addEventListener('click', (event: MouseEvent) => {
    const option = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-locale]') : null;
    if (!option) return;
    if (!option.dataset.locale) return;
    apply(option.dataset.locale);
    close({ focus: true });
  });
  menu.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const options = [...menu.querySelectorAll<HTMLElement>('[data-locale]')];
    const index = options.indexOf(document.activeElement as HTMLElement);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    options[(index + offset + options.length) % options.length]?.focus();
  });
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !menu.hidden) close({ focus: true });
  });
  document.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!menu.hidden && event.target instanceof Node && !container.contains(event.target)) close();
  });

  apply(i18n.locale);
}
