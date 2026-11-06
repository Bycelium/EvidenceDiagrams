import type { I18n, LocaleId } from '../i18n/index.ts';

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

type LanguageControl = {
  readonly container: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly menu: HTMLElement;
  readonly current: HTMLElement;
};

function requiredChild<ElementType extends Element>(
  container: ParentNode,
  selector: string,
): ElementType {
  const target = container.querySelector<ElementType>(selector);
  if (!target) throw new Error(`Missing language control element: ${selector}`);
  return target;
}

export function mountLanguageControls(
  i18n: I18n,
  { onLocaleChange }: { onLocaleChange: () => void },
): void {
  const controls = [...document.querySelectorAll<HTMLElement>('.language-control')]
    .map((container): LanguageControl => ({
      container,
      button: requiredChild(container, '.language-menu-button'),
      menu: requiredChild(container, '.language-menu'),
      current: requiredChild(container, '.language-menu-current'),
    }));
  if (controls.length === 0) throw new Error('Missing language controls');

  function close(control: LanguageControl, { focus = false }: { focus?: boolean } = {}): void {
    control.menu.hidden = true;
    control.button.setAttribute('aria-expanded', 'false');
    if (focus) control.button.focus();
  }

  function synchronize(): void {
    for (const control of controls) {
      control.current.textContent = i18n.meta.label;
      for (const option of control.menu.querySelectorAll<HTMLElement>('[data-locale]')) {
        option.setAttribute('aria-checked', String(option.dataset.locale === i18n.locale));
      }
    }
  }

  function apply(locale: LocaleId): void {
    i18n.setLocale(locale);
    synchronize();
    storeLocale(i18n.locale);
    onLocaleChange();
  }

  for (const control of controls) {
    control.button.addEventListener('click', () => {
      const open = control.menu.hidden;
      for (const candidate of controls) close(candidate);
      control.menu.hidden = !open;
      control.button.setAttribute('aria-expanded', String(open));
      if (open) {
        control.menu.querySelector<HTMLElement>(`[data-locale="${i18n.locale}"]`)?.focus();
      }
    });
    control.menu.addEventListener('click', (event: MouseEvent) => {
      const option = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-locale]')
        : null;
      const locale = option?.dataset.locale;
      if (locale !== 'en' && locale !== 'fr') return;
      apply(locale);
      close(control, { focus: true });
    });
    control.menu.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      const options = [...control.menu.querySelectorAll<HTMLElement>('[data-locale]')];
      const index = options.indexOf(document.activeElement as HTMLElement);
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      options[(index + offset + options.length) % options.length]?.focus();
    });
  }
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    for (const control of controls) {
      if (!control.menu.hidden) close(control, { focus: true });
    }
  });
  document.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!(event.target instanceof Node)) return;
    for (const control of controls) {
      if (!control.menu.hidden && !control.container.contains(event.target)) close(control);
    }
  });

  synchronize();
  storeLocale(i18n.locale);
}
