import {
  addInquiryEvidence,
  claimsAvailableAsPremises,
  editInquiryEvidence,
  type DemoContribution,
  type InquirySession,
} from '../state.ts';
import { claimById, contributionById } from '../inquiry/lookups.ts';
import { element, safeHttpUrl } from '../dom.ts';
import type { I18n } from '../i18n/index.ts';
import { createConditionalStrengthControl, type ConditionalMessages } from './conditional-strength-control.ts';

export interface FormMessages {
  readonly requiredText: string;
  readonly invalidRelationship: string;
  readonly source: string;
  readonly sourceReference: string;
  readonly sourceTitle: string;
  readonly sourceUrl: string;
  readonly sourceUrlError: string;
  readonly sourceLocator: string;
  readonly premise: string;
  readonly newPremise: string;
  readonly premiseAssertion: string;
  readonly useExistingPremise: string;
  readonly premiseDescription: string;
  readonly addEvidence: string;
  readonly editDetails: string;
  readonly save: string;
  readonly cancel: string;
  readonly rootAssertion: string;
  readonly rootDescription: string;
}

type TextFieldOptions = { type?: string; required?: boolean; value?: string };
type TextareaFieldOptions = { required?: boolean; value?: string; rows?: number };
type ValidityTarget = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export type InquiryFormsOptions = {
  readonly messages: () => FormMessages;
  readonly conditionalMessages: () => ConditionalMessages;
  readonly formatMessage: I18n['formatMessage'];
  readonly number: I18n['number'];
  readonly addRootLabel: () => string;
  readonly dialogForm: HTMLFormElement;
  readonly getSession: () => InquirySession;
  readonly getSaturationThresholdDecibans: () => number;
  readonly showDialog: (
    title: string,
    submitLabel: string,
    body: readonly Node[],
    handler: () => boolean,
  ) => void;
  readonly candidateSession: () => InquirySession;
  readonly commitCandidate: (candidate: InquirySession, validityTarget?: ValidityTarget) => boolean;
  readonly onCreateRoot: (root: { title: string; description: string }) => void;
};

export type InquiryForms = {
  readonly openAddEvidence: () => void;
  readonly openAddRoot: () => void;
  readonly openSource: (evidenceId: string) => void;
};

function textField(
  label: string,
  name: string,
  { type = 'text', required = false, value = '' }: TextFieldOptions = {},
): { input: HTMLInputElement; label: HTMLLabelElement } {
  const input = element('input', { name, type, value, ...(required ? { required: '' } : {}) });
  return { input, label: element('label', {}, [element('span', { textContent: label }), input]) };
}

function textareaField(
  label: string,
  name: string,
  { required = false, value = '', rows = 2 }: TextareaFieldOptions = {},
): { input: HTMLTextAreaElement; label: HTMLLabelElement } {
  const input = element('textarea', { name, rows, ...(required ? { required: '' } : {}) });
  input.value = value;
  return { input, label: element('label', {}, [element('span', { textContent: label }), input]) };
}

function formInput(form: HTMLFormElement, name: string): HTMLInputElement {
  const control = form.elements.namedItem(name);
  if (!(control instanceof HTMLInputElement)) throw new Error(`Missing form input: ${name}`);
  return control;
}

export function createInquiryForms(options: InquiryFormsOptions): InquiryForms {
  const { formatMessage, number, dialogForm, getSession, getSaturationThresholdDecibans, showDialog, candidateSession, commitCandidate, onCreateRoot } = options;
  function sourceForm(source: Partial<DemoContribution> = {}): HTMLLabelElement[] {
    const messages = options.messages();
    const title = textField(messages.sourceTitle, 'sourceTitle', { required: true, value: source.title ?? '' });
    const url = textField(messages.sourceUrl, 'sourceUrl', {
      type: 'url', required: true, value: source.url ?? '',
    });
    const locator = textField(messages.sourceLocator, 'sourceLocator', { value: source.locator ?? '' });
    return [title.label, url.label, locator.label];
  }

  function sourceFromForm(form: HTMLFormElement): Omit<DemoContribution, 'id'> {
    return {
      title: formInput(form, 'sourceTitle').value.trim(),
      url: formInput(form, 'sourceUrl').value.trim(),
      locator: formInput(form, 'sourceLocator').value.trim(),
    };
  }

  function validateSource(form: HTMLFormElement): boolean {
    const messages = options.messages();
    const input = formInput(form, 'sourceUrl');
    const value = input.value.trim();
    input.setCustomValidity(value && safeHttpUrl(value) ? '' : messages.sourceUrlError);
    return input.validationMessage === '';
  }

  function validateTrimmed(input: HTMLInputElement | HTMLTextAreaElement): boolean {
    input.setCustomValidity(input.value.trim() ? '' : options.messages().requiredText);
    return input.validationMessage === '';
  }

  function openAddEvidence(): void {
    const messages = options.messages();
    const conditionalMessages = options.conditionalMessages();
    const session = getSession();
    const premiseSelect = element('select', { name: 'premiseChoice' });
    premiseSelect.append(element('option', { value: '', textContent: messages.newPremise }));
    for (const claim of claimsAvailableAsPremises(session)) {
      premiseSelect.append(element('option', { value: claim.id, textContent: claim.title }));
    }
    const premiseTitle = textareaField(messages.premiseAssertion, 'premiseTitle', { required: true, rows: 2 });
    const premiseDescription = textareaField(messages.premiseDescription, 'premiseDescription', { required: true, rows: 2 });
    const sourceTitle = textField(messages.sourceReference, 'sourceTitle', { required: true });
    const sourceUrl = textField(messages.sourceUrl, 'sourceUrl', { type: 'url', required: true });
    const sourceLocator = textField(messages.sourceLocator, 'sourceLocator');
    const conditionalControl = createConditionalStrengthControl({
      messages: conditionalMessages,
      formatMessage,
      number,
      targetTitle: claimById(session.inquiry, session.focusClaimId).title,
      value: 0,
      saturationThresholdDecibans: getSaturationThresholdDecibans(),
    });
    const reuse = element('details', { className: 'inquiry-add-reuse' }, [
      element('summary', { textContent: messages.useExistingPremise }),
      element('label', {}, [
        element('span', { className: 'visually-hidden', textContent: messages.premise }),
        premiseSelect,
      ]),
    ]);
    const premiseSection = element('section', { className: 'inquiry-add-section inquiry-add-premise' }, [
      element('h3', { textContent: messages.premise }), premiseTitle.label, premiseDescription.label, reuse,
    ]);
    const effectSection = element('section', { className: 'inquiry-add-section inquiry-add-effect' }, [
      element('h3', { textContent: conditionalMessages.ifThisWereTrue }), conditionalControl.element,
    ]);
    const sourceSection = element('section', { className: 'inquiry-add-section inquiry-add-source' }, [
      element('h3', { textContent: messages.source }), sourceTitle.label, sourceUrl.label, sourceLocator.label,
    ]);
    showDialog(messages.addEvidence, messages.addEvidence, [premiseSection, effectSection, sourceSection], () => {
      if (!validateSource(dialogForm) || !validateTrimmed(formInput(dialogForm, 'sourceTitle'))) return false;
      if (!premiseSelect.value && (!validateTrimmed(premiseTitle.input) || !validateTrimmed(premiseDescription.input))) return false;
      const candidate = candidateSession();
      addInquiryEvidence(candidate, {
        contribution: {
          title: sourceTitle.input.value.trim(),
          url: sourceUrl.input.value.trim(),
          locator: sourceLocator.input.value.trim(),
        },
        premiseClaimId: premiseSelect.value || undefined,
        premiseTitle: premiseTitle.input.value,
        premiseDescription: premiseDescription.input.value,
        impact: { deltaMean: conditionalControl.value(), deltaStandardDeviation: 0 },
      });
      return commitCandidate(candidate, premiseSelect);
    });
    let newPremiseDraft = { title: '', description: '' };
    let usingExistingPremise = false;
    premiseSelect.addEventListener('change', () => {
      const creating = premiseSelect.value === '';
      if (!creating) {
        if (!usingExistingPremise) newPremiseDraft = { title: premiseTitle.input.value, description: premiseDescription.input.value };
        const selected = claimById(getSession().inquiry, premiseSelect.value);
        premiseTitle.input.value = selected.title;
        premiseDescription.input.value = selected.description ?? '';
      } else {
        premiseTitle.input.value = newPremiseDraft.title;
        premiseDescription.input.value = newPremiseDraft.description;
      }
      premiseTitle.input.disabled = !creating;
      premiseDescription.input.disabled = !creating;
      premiseTitle.input.required = creating;
      premiseDescription.input.required = creating;
      premiseTitle.label.classList.toggle('is-reused', !creating);
      usingExistingPremise = !creating;
    });
    requestAnimationFrame(() => premiseTitle.input.focus());
  }

  function openAddRoot(): void {
    const messages = options.messages();
    const addRootLabel = options.addRootLabel();
    const title = textareaField(messages.rootAssertion, 'rootTitle', { required: true, rows: 2 });
    const description = textareaField(messages.rootDescription, 'rootDescription', { required: true, rows: 2 });
    showDialog(addRootLabel, addRootLabel, [title.label, description.label], () => {
      if (!validateTrimmed(title.input) || !validateTrimmed(description.input)) return false;
      onCreateRoot({ title: title.input.value, description: description.input.value });
      return true;
    });
    requestAnimationFrame(() => title.input.focus());
  }

  function openSource(evidenceId: string): void {
    const messages = options.messages();
    const session = getSession();
    const item = session.inquiry.evidence.find(({ id }) => id === evidenceId);
    if (!item) throw new Error(`Unknown evidence: ${evidenceId}`);
    const source = contributionById(session.inquiry, item.contributionId);
    showDialog(messages.editDetails, messages.save, sourceForm(source), () => {
      if (!validateSource(dialogForm) || !validateTrimmed(formInput(dialogForm, 'sourceTitle'))) return false;
      const candidate = candidateSession();
      editInquiryEvidence(candidate, evidenceId, { contribution: sourceFromForm(dialogForm) });
      return commitCandidate(candidate, formInput(dialogForm, 'sourceTitle'));
    });
  }

  return { openAddEvidence, openAddRoot, openSource };
}
