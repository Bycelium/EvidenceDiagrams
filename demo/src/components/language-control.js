function storedLocale() {
  try {
    return localStorage.getItem('evidence-diagrams.locale');
  } catch {
    return undefined;
  }
}

function storeLocale(locale) {
  try {
    localStorage.setItem('evidence-diagrams.locale', locale);
  } catch {
    // File privacy modes may disable storage.
  }
}

export function initialLocale(resolveInitialLocale) {
  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return resolveInitialLocale(storedLocale(), browserLanguages);
}

export function mountLanguageControl(i18n, { onLocaleChange }) {
  const container = document.querySelector('.language-control');
  const button = document.querySelector('#language-menu-button');
  const menu = document.querySelector('#language-menu');
  const current = document.querySelector('#language-menu-current');

  function close({ focus = false } = {}) {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  }

  function apply(locale) {
    i18n.setLocale(locale);
    const options = menu.querySelectorAll('[data-locale]');
    for (const option of options) {
      option.setAttribute('aria-checked', String(option.dataset.locale === i18n.locale));
    }
    current.textContent = menu.querySelector(`[data-locale="${i18n.locale}"]`).textContent;
    storeLocale(i18n.locale);
    onLocaleChange();
  }

  button.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector(`[data-locale="${i18n.locale}"]`).focus();
  });
  menu.addEventListener('click', (event) => {
    const option = event.target.closest('[data-locale]');
    if (!option) return;
    apply(option.dataset.locale);
    close({ focus: true });
  });
  menu.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const options = [...menu.querySelectorAll('[data-locale]')];
    const index = options.indexOf(document.activeElement);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    options[(index + offset + options.length) % options.length].focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) close({ focus: true });
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !container.contains(event.target)) close();
  });

  apply(i18n.locale);
}
