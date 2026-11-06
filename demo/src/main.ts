import { mountLanguageControl, initialLocale } from './components/language-control.ts';
import { mountLegalInformation } from './components/legal-information.ts';
import {
  createI18n,
  messageAtPath,
  resolveInitialLocale,
} from './i18n/index.ts';
import { mountInquiryController } from './inquiry/controller.ts';

export interface ActionMessages {
  readonly reset: string;
}

export interface PageMessages {
  readonly pageTitle: string;
  readonly heading: string;
  readonly intro: string;
  readonly temporaryChangesTitle: string;
  readonly temporaryChangesBody: string;
  readonly temporaryChangesAcknowledge: string;
  readonly temporaryChangesContact: string;
  readonly temporaryChangesDismiss: string;
}

const i18n = createI18n(initialLocale(resolveInitialLocale));
const legalInformation = mountLegalInformation(i18n);

function translateStaticUi() {
  document.documentElement.lang = i18n.meta.htmlLang;
  const title = i18n.messages.inquiry.page.pageTitle;
  const description = i18n.messages.inquiry.page.intro;
  document.title = title;
  for (const selector of ['#og-title', '#twitter-title']) {
    document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', title);
  }
  for (const selector of ['#meta-description', '#og-description', '#twitter-description']) {
    document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', description);
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (key) element.textContent = messageAtPath(i18n.messages, key) ?? key;
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]')) {
    const key = element.dataset.i18nAriaLabel;
    if (key) element.setAttribute('aria-label', messageAtPath(i18n.messages, key) ?? key);
  }
}

function applyLocale() {
  translateStaticUi();
  legalInformation.setLocale();
  inquiryUi.setLocale();
}

translateStaticUi();
const inquiryUi = mountInquiryController(i18n);
mountLanguageControl(i18n, { onLocaleChange: applyLocale });
