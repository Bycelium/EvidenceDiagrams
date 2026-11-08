import type { InquiryClaimEvaluation } from '@bycelium/evidence-diagrams';
import {
  claimEvidenceSummary,
  renderClaimCredibility,
  type ClaimCardMessages,
} from '../components/claim-card.ts';
import { renderClaimEvidencePreview } from '../components/claim-evidence-preview.ts';
import { element } from '../html-element.ts';
import type { I18n } from '../i18n/index.ts';
import type { PresentationI18n } from '../presentation.ts';
import { inquiryClaimView, type InquirySession } from '../state.ts';
import { renderClaimDiagram, type ClaimDiagramMessages } from './claim-diagram.ts';
import { claimById } from './lookups.ts';

export type ClaimViewMessages = {
  readonly claim: ClaimCardMessages;
  readonly diagram: ClaimDiagramMessages;
};

type ClaimViewOptions = {
  readonly container: HTMLElement;
  readonly session: InquirySession;
  readonly evaluated: InquiryClaimEvaluation;
  readonly messages: ClaimViewMessages;
  readonly i18n: I18n & PresentationI18n;
  readonly saturationThresholdDecibans: number;
  readonly selectedEvidenceId?: string;
  readonly palette: { against: string; for: string };
  readonly dissonanceLabel: string;
  readonly onInspectEvidence: (evidenceId: string) => void;
  readonly onEditPriorEndpoint: Parameters<typeof renderClaimDiagram>[4]['onEditPriorEndpoint'];
  readonly onResetPrior: () => void;
};

export function renderClaimView(options: ClaimViewOptions): {
  evidenceSummary: ReturnType<typeof claimEvidenceSummary>;
  palette: ReturnType<typeof renderClaimCredibility>['palette'];
  plotWidth: number;
} {
  const {
    container,
    session,
    evaluated,
    messages,
    i18n,
    saturationThresholdDecibans,
    selectedEvidenceId,
    palette,
    dissonanceLabel,
    onInspectEvidence,
    onEditPriorEndpoint,
    onResetPrior,
  } = options;
  const claim = claimById(session.inquiry, session.focusClaimId);
  const items = session.inquiry.evidence.filter(({ targetClaimId }) => targetClaimId === claim.id);
  const evidenceSummary = claimEvidenceSummary(evaluated);
  const currentCredibility = renderClaimCredibility(
    i18n,
    messages.claim,
    evaluated,
    evidenceSummary,
    saturationThresholdDecibans,
  );
  const view = inquiryClaimView(session);
  const evidencePreview = renderClaimEvidencePreview(evaluated);
  const header = element('button', {
    type: 'button',
    className: `inquiry-focus-heading inquiry-claim-card${evidencePreview ? ' has-evidence-preview' : ''}`,
    dataset: { action: 'toggle-claim' },
    'aria-expanded': String(view.expanded),
  }, [
    evidencePreview,
    element('span', { className: 'inquiry-claim-toggle-chevron', 'aria-hidden': 'true' }),
    element('span', { className: 'inquiry-claim-title' }, [
      element('span', { className: 'inquiry-focus-title', textContent: claim.title }),
      currentCredibility.credibility,
    ]),
  ]);
  header.style.setProperty('--result-color', currentCredibility.palette.color);
  const plotWidth = Math.max(240, container.clientWidth - 28);
  if (!view.expanded) {
    container.replaceChildren(header);
    return { evidenceSummary, palette: currentCredibility.palette, plotWidth };
  }
  const diagram = renderClaimDiagram(
    evaluated,
    items,
    currentCredibility.palette.color,
    view,
    {
      messages: messages.diagram,
      presentationI18n: i18n,
      formatMessage: i18n.formatMessage,
      session,
      saturationThresholdDecibans,
      plotWidth,
      selectedEvidenceId,
      palette,
      dissonanceLabel,
      onInspectEvidence,
      onEditPriorEndpoint,
      onResetPrior,
    },
  );
  container.replaceChildren(
    header,
    ...(claim.description ? [element('p', {
      className: 'inquiry-claim-description',
      textContent: claim.description,
    })] : []),
    element('section', { className: 'inquiry-claim-summary' }, [diagram]),
  );
  return { evidenceSummary, palette: currentCredibility.palette, plotWidth };
}
