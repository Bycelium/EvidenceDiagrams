import {
  DEFAULT_COLOR_OPTIONS,
  evaluateInquiry,
  type InquiryClaimEvaluation,
} from '@bycelium/evidence-diagrams';
import { bandToGaussian, gaussianToBand, type Gaussian } from '@bycelium/evidence-diagrams/propagation-math';
import { claimEvidenceSummary, renderClaimCredibility } from '../components/claim-card.ts';
import { createInquiryEvidencePanel } from '../components/evidence-panel.ts';
import { createFormDialog } from '../components/form-dialog.ts';
import { createInquiryForms } from '../components/inquiry-forms.ts';
import { editBandEndpoint, type InquiryBandGeometry } from '../diagram/geometry.ts';
import type { PriorBound } from '@bycelium/evidence-diagrams-dom';
import type { I18n, LocaleId } from '../i18n/index.ts';
import { createInquiryPreset } from '../presets/index.ts';
import {
  cloneInquirySession,
  createBlankInquirySession,
  createInquirySession,
  editInquiryClaim,
  editInquiryEvidence,
  inquiryClaimView,
  inquiryInitialDeltaMean,
  inquiryInitialPrior,
  openInquiryClaim,
  removeInquiryEvidence,
  setInquiryClaimExpanded,
  setInquiryClaimMode,
  setInquiryClaimTrailExpanded,
  type InquirySession,
} from '../state.ts';
import { renderClaimView } from './claim-view.ts';
import { createLegendController } from './legend-controller.ts';
import { claimById, resultForClaim } from './lookups.ts';
import { renderBreadcrumbs, renderRootList } from './claim-navigation.ts';
import { installPriorDrag } from './prior-drag.ts';
import { localizePresetSession } from './preset-localization.ts';

const EVIDENCE_ORDER = { evidenceOrder: 'weakest-first' } as const;
const ACTIVE_PRESET_ID = 'nuclear';

function requiredElement<ElementType extends Element>(selector: string): ElementType {
  const node = document.querySelector<ElementType>(selector);
  if (!node) throw new Error(`Missing demo element: ${selector}`);
  return node;
}

export function mountInquiryController(i18n: I18n): { setLocale(): void } {
  const saturationThreshold = requiredElement<HTMLInputElement>('#inquiry-saturation-threshold');
  const saturationThresholdValue = requiredElement<HTMLOutputElement>('#inquiry-saturation-threshold-value');
  const breadcrumbs = requiredElement<HTMLElement>('#inquiry-breadcrumbs');
  const rootList = requiredElement<HTMLElement>('#inquiry-root-list');
  const focus = requiredElement<HTMLElement>('#inquiry-focus');
  const dialog = requiredElement<HTMLDialogElement>('#inquiry-dialog');
  const dialogForm = requiredElement<HTMLFormElement>('#inquiry-dialog-form');
  const sessionNotice = requiredElement<HTMLDialogElement>('#inquiry-session-notice');
  const presetSession = createInquirySession(createInquiryPreset(ACTIVE_PRESET_ID, i18n.locale));
  const presetRootId = presetSession.inquiry.rootClaimId;
  let session = presetSession;
  const rootSessions = new Map<string, InquirySession>([[presetRootId, session]]);
  const customRootDefaults = new Map<string, { id: string; title: string; description: string }>();
  let renderedLocale: LocaleId = i18n.locale;
  let saturationThresholdDecibans: number = DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans;
  let selectedEvidenceId: string | undefined;
  let renderedPlotWidth = 0;
  let resizeFrame: number | undefined;

  const legend = createLegendController({
    dialog: requiredElement('#inquiry-legend-dialog'),
    openButton: requiredElement('#inquiry-legend-open'),
    container: requiredElement('#inquiry-color-legend'),
    canvas: requiredElement('#inquiry-legend-canvas'),
  });
  requiredElement<HTMLButtonElement>('#inquiry-legend-close')
    .addEventListener('click', () => legend.setOpen(false));

  const formDialog = createFormDialog({
    dialog,
    form: dialogForm,
    title: requiredElement('#inquiry-dialog-title'),
    body: requiredElement('#inquiry-dialog-body'),
    submitButton: requiredElement('#inquiry-dialog-submit'),
    cancelButtons: [
      requiredElement('#inquiry-dialog-cancel'),
      requiredElement('#inquiry-dialog-cancel-secondary'),
    ],
    afterSubmit: () => render(),
  });

  function activeRootId(): string {
    return session.inquiry.rootClaimId;
  }

  function nextCustomRootId(): string {
    let number = rootSessions.size + 1;
    while (rootSessions.has(`inquiry-root-${number}`)) number += 1;
    return `inquiry-root-${number}`;
  }

  function candidateSession(): InquirySession {
    return cloneInquirySession(session);
  }

  function commitCandidate(
    candidate: InquirySession,
    validityTarget?: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ): boolean {
    try {
      evaluateInquiry(candidate.inquiry, EVIDENCE_ORDER);
      validityTarget?.setCustomValidity('');
      session = candidate;
      rootSessions.set(activeRootId(), session);
      return true;
    } catch {
      validityTarget?.setCustomValidity(i18n.messages.inquiry.form.invalidRelationship);
      return false;
    }
  }

  const forms = createInquiryForms({
      messages: () => i18n.messages.inquiry.form,
      conditionalMessages: () => i18n.messages.inquiry.conditional,
      formatMessage: i18n.formatMessage,
      number: i18n.number,
      addRootLabel: () => i18n.messages.inquiry.navigation.addRoot,
      dialogForm,
      getSession: () => session,
      getSaturationThresholdDecibans: () => saturationThresholdDecibans,
      showDialog: formDialog.show,
      candidateSession,
      commitCandidate,
      onCreateRoot({ title, description }) {
        const rootId = nextCustomRootId();
        const rootSession = createBlankInquirySession({ id: rootId, title, description });
        setInquiryClaimMode(rootSession, 'graph');
        rootSessions.set(rootId, rootSession);
        customRootDefaults.set(rootId, {
          id: rootId,
          title: rootSession.inquiry.claims[0]!.title,
          description: rootSession.inquiry.claims[0]!.description ?? '',
        });
        session = rootSession;
        selectedEvidenceId = undefined;
        evidencePanel.close();
      },
  });

  function panelState(evidenceId: string) {
    return {
      inquiry: session.inquiry,
      evaluation: evaluateInquiry(session.inquiry, EVIDENCE_ORDER),
      evidenceId,
      saturationThresholdDecibans,
      conditionalStrengthDefault: inquiryInitialDeltaMean(session, evidenceId),
    };
  }

  const evidencePanel = createInquiryEvidencePanel({
    i18n,
    messages: () => i18n.messages.inquiry.detail,
    strengthMessages: () => i18n.messages.inquiry.strength,
    conditionalMessages: () => i18n.messages.inquiry.conditional,
    formMessages: () => i18n.messages.inquiry.form,
    claimCardMessages: () => i18n.messages.inquiry.claim,
    callbacks: {
    onEditEvidence(evidenceId) {
      if (evidenceId) forms.openSource(evidenceId);
    },
    onRemoveEvidence(evidenceId) {
      if (!evidenceId) return;
      removeInquiryEvidence(session, evidenceId);
      selectedEvidenceId = undefined;
      render();
    },
    onInvestigate(claimId) {
      if (!claimId) return;
      openInquiryClaim(session, claimId, { mode: 'graph' });
      selectedEvidenceId = undefined;
      render();
    },
    onConditionalStrengthChange(evidenceId, deltaMean) {
      const candidate = candidateSession();
      const item = candidate.inquiry.evidence.find(({ id }) => id === evidenceId);
      if (!item) return undefined;
      editInquiryEvidence(candidate, evidenceId, {
        impact: { ...item.impact, deltaMean },
      });
      if (!commitCandidate(candidate)) return undefined;
      render();
      return panelState(evidenceId);
    },
    onPremiseStateChange({ evidenceId, premiseState }) {
      const candidate = candidateSession();
      const item = candidate.inquiry.evidence.find(({ id }) => id === evidenceId);
      if (!item) return undefined;
      editInquiryEvidence(candidate, evidenceId, { premiseState });
      if (!commitCandidate(candidate)) return undefined;
      render();
      return panelState(evidenceId);
    },
    },
  });

  function openEvidencePanel(evidenceId: string): void {
    selectedEvidenceId = evidenceId;
    evidencePanel.open(panelState(evidenceId));
  }

  function commitPriorEndpoint({
    bound,
    value,
    domain,
    restoreFocus,
  }: {
    readonly bound: PriorBound;
    readonly value: number;
    readonly domain: Pick<InquiryBandGeometry, 'minimum' | 'maximum'>;
    readonly restoreFocus: boolean;
  }): void {
    const claim = claimById(session.inquiry, session.focusClaimId);
    const band = editBandEndpoint(
      gaussianToBand(claim.prior),
      bound,
      value,
      domain.minimum,
      domain.maximum,
    );
    const candidate = candidateSession();
    editInquiryClaim(candidate, claim.id, { prior: bandToGaussian(band) });
    if (!commitCandidate(candidate)) return;
    render();
    if (restoreFocus) {
      document.querySelector<HTMLElement>(`[data-prior-bound="${bound}"]`)?.focus();
    }
  }

  function restorePrior(claimId: string, prior: Gaussian): void {
    const candidate = candidateSession();
    editInquiryClaim(candidate, claimId, { prior });
    if (commitCandidate(candidate)) render();
  }

  function resetPrior(): void {
    const claim = claimById(session.inquiry, session.focusClaimId);
    const prior = inquiryInitialPrior(session, claim.id);
    if (claim.prior.mean === prior.mean && claim.prior.standardDeviation === prior.standardDeviation) return;
    const candidate = candidateSession();
    editInquiryClaim(candidate, claim.id, { prior });
    if (commitCandidate(candidate)) render();
  }

  function renderCredibility(evaluated: InquiryClaimEvaluation, compact: boolean) {
    return renderClaimCredibility(
      i18n,
      i18n.messages.inquiry.claim,
      evaluated,
      claimEvidenceSummary(evaluated),
      saturationThresholdDecibans,
      compact,
    );
  }

  function render(): void {
    const result = evaluateInquiry(session.inquiry, EVIDENCE_ORDER);
    const evaluated = resultForClaim(result, session.focusClaimId);
    renderRootList(rootList, {
      messages: i18n.messages.inquiry.navigation,
      formatMessage: i18n.formatMessage,
      evidenceOrder: EVIDENCE_ORDER,
      rootSessions,
      session,
      renderCredibility,
    });
    renderBreadcrumbs(breadcrumbs, result, {
      messages: i18n.messages.inquiry.navigation,
      session,
      renderCredibility,
    });
    const rendered = renderClaimView({
      container: focus,
      session,
      evaluated,
      messages: {
        claim: i18n.messages.inquiry.claim,
        diagram: i18n.messages.inquiry.diagram,
      },
      i18n,
      saturationThresholdDecibans,
      selectedEvidenceId,
      palette: { against: i18n.messages.palette.against, for: i18n.messages.palette.for },
      dissonanceLabel: i18n.messages.measure.dissonance,
      onInspectEvidence: openEvidencePanel,
      onEditPriorEndpoint: commitPriorEndpoint,
      onResetPrior: resetPrior,
    });
    renderedPlotWidth = rendered.plotWidth;
    legend.render(rendered.evidenceSummary, rendered.palette);
  }

  function activateRoot(rootId: string): void {
    const next = rootSessions.get(rootId);
    if (!next || next === session) return;
    session = next;
    selectedEvidenceId = undefined;
    evidencePanel.close();
    render();
  }

  function resetActiveRoot(): void {
    const rootId = activeRootId();
    if (rootId === presetRootId) {
      session = createInquirySession(createInquiryPreset(ACTIVE_PRESET_ID, i18n.locale));
    } else {
      const initial = customRootDefaults.get(rootId);
      if (!initial) throw new Error(`Missing initial values for custom root: ${rootId}`);
      session = createBlankInquirySession(initial);
    }
    rootSessions.set(rootId, session);
    selectedEvidenceId = undefined;
    evidencePanel.close();
    renderedLocale = i18n.locale;
    render();
  }

  installPriorDrag({
    focus,
    getSession: () => session,
    restorePrior,
    commitEndpoint: commitPriorEndpoint,
  });
  focus.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-action]')
      : null;
    if (!button) return;
    const { action } = button.dataset;
    if (action === 'add-evidence') forms.openAddEvidence();
    else if (action === 'inspect-evidence' && button.dataset.evidenceId) {
      openEvidencePanel(button.dataset.evidenceId);
    } else if (action === 'toggle-claim') {
      const restoreFocus = document.activeElement === button;
      setInquiryClaimExpanded(session, !inquiryClaimView(session).expanded);
      render();
      if (restoreFocus) focus.querySelector<HTMLElement>('.inquiry-focus-heading')?.focus({ preventScroll: true });
    } else if (action === 'toggle-graph') {
      const restoreFocus = document.activeElement === button;
      setInquiryClaimMode(session, inquiryClaimView(session).mode === 'graph' ? 'summary' : 'graph');
      render();
      if (restoreFocus) focus.querySelector<HTMLElement>('.inquiry-graph-toggle')?.focus({ preventScroll: true });
    } else if (action === 'toggle-trail') {
      const restoreFocus = document.activeElement === button;
      setInquiryClaimTrailExpanded(session, !inquiryClaimView(session).trailExpanded);
      render();
      if (restoreFocus) focus.querySelector<HTMLElement>('.inquiry-trail-toggle')?.focus({ preventScroll: true });
    }
  });
  rootList.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-action]')
      : null;
    if (button?.dataset.action === 'add-root') forms.openAddRoot();
    else if (button?.dataset.action === 'select-root' && button.dataset.rootId) {
      activateRoot(button.dataset.rootId);
    }
  });
  breadcrumbs.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-action="open-claim"]')
      : null;
    if (!button?.dataset.claimId) return;
    openInquiryClaim(session, button.dataset.claimId);
    render();
  });
  saturationThreshold.value = String(saturationThresholdDecibans);
  saturationThresholdValue.textContent = i18n.number(saturationThresholdDecibans);
  saturationThreshold.addEventListener('input', () => {
    saturationThresholdDecibans = Number(saturationThreshold.value);
    saturationThresholdValue.textContent = i18n.number(saturationThresholdDecibans);
    evidencePanel.setSaturationThreshold(saturationThresholdDecibans);
    render();
  });
  requiredElement<HTMLButtonElement>('#inquiry-reset').addEventListener('click', resetActiveRoot);
  sessionNotice.addEventListener('cancel', (event) => event.preventDefault());
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const nextWidth = Math.max(240, focus.clientWidth - 28);
      if (Math.abs(nextWidth - renderedPlotWidth) < 2) return;
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(render);
    }).observe(focus);
  }

  resetActiveRoot();
  sessionNotice.showModal();
  requiredElement<HTMLInputElement>('#inquiry-session-notice-acknowledge').focus();
  return {
    setLocale() {
      const previousPreset = createInquiryPreset(ACTIVE_PRESET_ID, renderedLocale);
      const localizedPreset = createInquiryPreset(ACTIVE_PRESET_ID, i18n.locale);
      const preset = rootSessions.get(presetRootId);
      if (preset) localizePresetSession(preset, previousPreset, localizedPreset);
      renderedLocale = i18n.locale;
      saturationThresholdValue.textContent = i18n.number(saturationThresholdDecibans);
      evidencePanel.setLocale();
      render();
    },
  };
}
