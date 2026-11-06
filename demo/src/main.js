import { mountLanguageControl, initialLocale } from './components/language-control.js';
import { createI18n, resolveInitialLocale } from './i18n/index.js';
import { mountInquiryUI } from './ui.js';

const i18n = createI18n(initialLocale(resolveInitialLocale));

function translateStaticUi() {
  document.documentElement.lang = i18n.meta.htmlLang;
  const title = i18n.t('inquiry.pageTitle');
  const description = i18n.t('inquiry.intro');
  document.title = title;
  for (const selector of ['#og-title', '#twitter-title']) {
    document.querySelector(selector).setAttribute('content', title);
  }
  for (const selector of ['#meta-description', '#og-description', '#twitter-description']) {
    document.querySelector(selector).setAttribute('content', description);
  }
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = i18n.t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', i18n.t(element.dataset.i18nAriaLabel));
  }
}

function applyLocale() {
  translateStaticUi();
  inquiryUi.setLocale();
}

translateStaticUi();
const inquiryUi = mountInquiryUI(i18n);
mountLanguageControl(i18n, { onLocaleChange: applyLocale });
