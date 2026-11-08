import { element } from '../html-element.ts';
import type { I18n } from '../i18n/index.ts';

const REGISTRY_URL = 'https://annuaire-entreprises.data.gouv.fr/entreprise/bycelium-919837187';
const CNIL_URL = 'https://www.cnil.fr/en/contact-us';
const VERCEL_PRIVACY_URL = 'https://vercel.com/legal/privacy-policy';
const VERCEL_DPA_URL = 'https://vercel.com/legal/dpa';

export interface LegalMessages {
  readonly navigation: string;
  readonly terms: string;
  readonly privacy: string;
  readonly contact: string;
  readonly noticePrompt: string;
  readonly close: string;
  readonly termsTitle: string;
  readonly termsIntro: string;
  readonly termsIllustrativeHeading: string;
  readonly termsIllustrativeBody: string;
  readonly termsAccessHeading: string;
  readonly termsAccessBody: string;
  readonly termsResponsibilityHeading: string;
  readonly termsResponsibilityBody: string;
  readonly termsAvailabilityHeading: string;
  readonly termsAvailabilityBody: string;
  readonly termsLicenseHeading: string;
  readonly termsLicenseBody: string;
  readonly privacyTitle: string;
  readonly privacyIntro: string;
  readonly privacyInquiryHeading: string;
  readonly privacyInquiryBody: string;
  readonly privacyStorageHeading: string;
  readonly privacyStorageBody: string;
  readonly privacyExternalHeading: string;
  readonly privacyExternalBody: string;
  readonly privacyLogsHeading: string;
  readonly privacyLogsBody: string;
  readonly vercelPrivacy: string;
  readonly vercelDpa: string;
  readonly privacyControllerHeading: string;
  readonly privacyControllerBody: string;
  readonly companyRegistry: string;
  readonly privacyRightsHeading: string;
  readonly privacyRightsBody: string;
  readonly cnil: string;
  readonly privacyContact: string;
  readonly generalContact: string;
}

type LegalSection = 'terms' | 'privacy';
type LegalI18n = Pick<I18n, 'messages'>;

function link(label: string, href: string, attributes: Record<string, string> = {}): HTMLAnchorElement {
  return element('a', { href, ...attributes }, [label]);
}

function section(heading: string, body: string): HTMLElement {
  return element('section', {}, [
    element('h3', { textContent: heading }),
    element('p', { textContent: body }),
  ]);
}

function legalArticle(i18n: LegalI18n, activeSection: LegalSection): HTMLElement {
  const text = i18n.messages.legal;
  if (activeSection === 'terms') {
    return element('article', { className: 'inquiry-legal-article' }, [
      element('p', { className: 'inquiry-legal-lead', textContent: text.termsIntro }),
      section(text.termsIllustrativeHeading, text.termsIllustrativeBody),
      section(text.termsAccessHeading, text.termsAccessBody),
      section(text.termsResponsibilityHeading, text.termsResponsibilityBody),
      section(text.termsAvailabilityHeading, text.termsAvailabilityBody),
      section(text.termsLicenseHeading, text.termsLicenseBody),
    ]);
  }
  return element('article', { className: 'inquiry-legal-article' }, [
    element('p', { className: 'inquiry-legal-lead', textContent: text.privacyIntro }),
    section(text.privacyInquiryHeading, text.privacyInquiryBody),
    section(text.privacyStorageHeading, text.privacyStorageBody),
    section(text.privacyExternalHeading, text.privacyExternalBody),
    element('section', {}, [
      element('h3', { textContent: text.privacyLogsHeading }),
      element('p', { textContent: text.privacyLogsBody }),
      element('p', {}, [
        link(text.vercelPrivacy, VERCEL_PRIVACY_URL, { target: '_blank', rel: 'noreferrer' }),
        element('span', { 'aria-hidden': 'true', textContent: ' · ' }),
        link(text.vercelDpa, VERCEL_DPA_URL, { target: '_blank', rel: 'noreferrer' }),
      ]),
    ]),
    element('section', {}, [
      element('h3', { textContent: text.privacyControllerHeading }),
      element('p', { textContent: text.privacyControllerBody }),
      element('p', {}, [link(text.companyRegistry, REGISTRY_URL, { target: '_blank', rel: 'noreferrer' })]),
    ]),
    element('section', {}, [
      element('h3', { textContent: text.privacyRightsHeading }),
      element('p', { textContent: text.privacyRightsBody }),
      element('p', {}, [link(text.cnil, CNIL_URL, { target: '_blank', rel: 'noreferrer' })]),
    ]),
  ]);
}

function contactLine(i18n: LegalI18n): HTMLParagraphElement {
  const text = i18n.messages.legal;
  return element('p', { className: 'inquiry-legal-contacts' }, [
    element('span', { textContent: `${text.privacyContact} ` }),
    link('gdpr@bycelium.com', 'mailto:gdpr@bycelium.com'),
    element('span', { textContent: ` · ${text.generalContact} ` }),
    link('contact@bycelium.com', 'mailto:contact@bycelium.com'),
  ]);
}

export function mountLegalInformation(i18n: LegalI18n): { setLocale: () => void } {
  const dialog = element('dialog', { className: 'inquiry-legal-dialog', 'aria-labelledby': 'inquiry-legal-title' });
  const footer = element('footer', { className: 'inquiry-legal-footer' });
  const noticeNavigation = element('nav', { className: 'inquiry-legal-notice-links' });
  const noticeAcknowledgment = document.querySelector<HTMLElement>('.inquiry-session-notice-acknowledgment');
  let activeSection: LegalSection = 'privacy';
  let returnFocus: HTMLElement | undefined;

  function legalButton(sectionName: LegalSection, className = ''): HTMLButtonElement {
    const button = element('button', {
      type: 'button', className, dataset: { legalSection: sectionName },
      textContent: i18n.messages.legal[sectionName],
    });
    button.addEventListener('click', () => open(sectionName, button));
    return button;
  }

  function renderDialog(): void {
    const text = i18n.messages.legal;
    const close = element('button', {
      type: 'button', className: 'inquiry-legal-close', 'aria-label': text.close, textContent: '×',
    });
    close.addEventListener('click', () => dialog.close());
    const terms = legalButton('terms', 'inquiry-legal-tab');
    const privacy = legalButton('privacy', 'inquiry-legal-tab');
    terms.setAttribute('aria-pressed', String(activeSection === 'terms'));
    privacy.setAttribute('aria-pressed', String(activeSection === 'privacy'));
    dialog.replaceChildren(
      element('header', { className: 'inquiry-legal-heading' }, [
        element('h2', { id: 'inquiry-legal-title', tabindex: '-1', textContent: activeSection === 'terms' ? text.termsTitle : text.privacyTitle }),
        close,
      ]),
      element('nav', { className: 'inquiry-legal-tabs', 'aria-label': text.navigation }, [terms, privacy]),
      legalArticle(i18n, activeSection),
      element('footer', { className: 'inquiry-legal-dialog-footer' }, [contactLine(i18n)]),
    );
  }

  function renderEntryPoints(): void {
    const text = i18n.messages.legal;
    footer.replaceChildren(element('nav', { 'aria-label': text.navigation }, [
      legalButton('terms'), element('span', { 'aria-hidden': 'true', textContent: '·' }),
      legalButton('privacy'), element('span', { 'aria-hidden': 'true', textContent: '·' }),
      link(text.contact, 'mailto:contact@bycelium.com'),
    ]));
    noticeNavigation.replaceChildren(
      element('span', { textContent: text.noticePrompt }), legalButton('terms'),
      element('span', { 'aria-hidden': 'true', textContent: '·' }), legalButton('privacy'),
    );
    noticeNavigation.setAttribute('aria-label', text.navigation);
  }

  function open(sectionName: LegalSection, trigger: HTMLElement): void {
    activeSection = sectionName;
    if (!dialog.open) returnFocus = trigger;
    renderDialog();
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('#inquiry-legal-title')?.focus();
  }

  dialog.addEventListener('cancel', (event) => { event.preventDefault(); dialog.close(); });
  dialog.addEventListener('close', () => returnFocus?.focus());
  document.querySelector('main')?.after(footer);
  document.body.append(dialog);
  if (noticeAcknowledgment) noticeAcknowledgment.before(noticeNavigation);
  renderEntryPoints();
  renderDialog();
  return { setLocale: () => { renderEntryPoints(); renderDialog(); } };
}
