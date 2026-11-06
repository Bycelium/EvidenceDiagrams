import {
  aggregateEvidence,
  credibilityBandBackground,
  evidenceStrengthColor,
  type InquiryClaimEvaluation,
} from '@bycelium/evidence-diagrams';
import type { Gaussian } from '@bycelium/evidence-diagrams/propagation-math';
import { renderCollapsedEvidenceSummary } from '../diagram/evidence-summary.ts';
import {
  inquiryConnectionGeometry,
  inquiryStepTone,
  renderInquiryConnections,
  renderInquiryResultant,
  renderInquiryTrajectory,
} from '../diagram/renderer.ts';
import {
  renderCredibilityAxis,
  type CredibilityAxisMessages,
} from '../diagram/credibility-axis.ts';
import { element } from '../dom.ts';
import type { InterpolationValues } from '../i18n/index.ts';
import {
  formatDissonance,
  formatJeffreysStrength,
  formatStrengthChange,
  type PresentationI18n,
} from '../presentation.ts';
import { inquiryInitialPrior, type ClaimView, type DemoEvidence, type InquirySession } from '../state.ts';
import { claimById } from './lookups.ts';

export interface ClaimDiagramMessages extends CredibilityAxisMessages {
  readonly prior: string;
  readonly current: string;
  readonly trajectoryAria: string;
  readonly evidenceDisclosure: string;
  readonly combinedEvidence: string;
  readonly hideEvidencePath: string;
  readonly showEvidencePath: string;
  readonly evidenceNumber: string;
  readonly addDirectionalEvidence: string;
}

type ClaimDiagramOptions = {
  messages: ClaimDiagramMessages;
  presentationI18n: PresentationI18n;
  formatMessage: (template: string, values?: InterpolationValues) => string;
  session: InquirySession;
  saturationThresholdDecibans: number;
  plotWidth: number;
  selectedEvidenceId?: string;
  palette: { against: string; for: string };
  dissonanceLabel: string;
  onInspectEvidence: (evidenceId: string) => void;
  onEditPriorEndpoint: Parameters<typeof renderCredibilityAxis>[0]['onEditEndpoint'];
  onResetPrior: () => void;
};

function centerY(node: Element, containerRect: DOMRect): number {
  const bounds = node.getBoundingClientRect();
  return bounds.top + bounds.height / 2 - containerRect.top;
}

function drawConnections(
  diagram: HTMLElement,
  evaluation: InquiryClaimEvaluation,
  geometry: ReturnType<typeof renderInquiryTrajectory>['geometry'],
  plotWidth: number,
  expanded: boolean,
): void {
  if (!diagram.isConnected || evaluation.steps.length === 0) return;
  const diagramBounds = diagram.getBoundingClientRect();
  const currentTrack = diagram.querySelector('.inquiry-flow-axis.is-current .inquiry-flow-axis-track');
  const priorTrack = diagram.querySelector('.inquiry-flow-axis.is-prior .inquiry-flow-axis-track');
  if (!currentTrack || !priorTrack || diagramBounds.width <= 0 || diagramBounds.height <= 0) return;

  let trajectoryCurrentY: number | undefined;
  let trajectoryPriorY: number | undefined;
  if (expanded) {
    const trajectoryBands = [...diagram.querySelectorAll('.inquiry-flow-band')];
    const trajectoryCurrent = trajectoryBands.at(-1);
    const trajectoryPrior = diagram.querySelector('.inquiry-flow-band.is-prior');
    if (!trajectoryCurrent || !trajectoryPrior) return;
    trajectoryCurrentY = centerY(trajectoryCurrent, diagramBounds);
    trajectoryPriorY = centerY(trajectoryPrior, diagramBounds);
  }

  const resultantStarts = [...diagram.querySelectorAll('.inquiry-resultant-line')]
    .map((line) => Number(line.getAttribute('x1')))
    .filter(Number.isFinite)
    .map((coordinate) => (
      geometry.minimum + coordinate / plotWidth * (geometry.maximum - geometry.minimum)
    ));
  const connectionGeometry = inquiryConnectionGeometry({
    width: diagramBounds.width,
    currentPosition: geometry.bands.at(-1)!,
    priorPosition: geometry.bands[0]!,
    currentY: centerY(currentTrack, diagramBounds),
    priorY: centerY(priorTrack, diagramBounds),
    expanded,
    trajectoryCurrentY,
    trajectoryPriorY,
    resultantStarts,
    minimum: geometry.minimum,
    maximum: geometry.maximum,
  });
  diagram.prepend(renderInquiryConnections(
    connectionGeometry,
    diagramBounds.width,
    diagramBounds.height,
  ));
}

function formatEvidenceListStrength(
  i18n: PresentationI18n,
  before: Gaussian,
  after: Gaussian,
): string {
  const { strength } = i18n.messages.inquiry;
  const meanShift = after.mean - before.mean;
  if (Math.abs(meanShift) > 1e-12) {
    return i18n.formatMessage(
      meanShift > 0 ? strength.strengthSupport : strength.strengthOpposition,
      { strength: formatJeffreysStrength(i18n, meanShift) },
    );
  }
  return Math.abs(after.standardDeviation - before.standardDeviation) > 1e-12
    ? strength.strengthWidth
    : strength.strengthNone;
}

export function renderClaimDiagram(
  evaluated: InquiryClaimEvaluation,
  items: DemoEvidence[],
  resultantColor: string,
  claimView: ClaimView,
  options: ClaimDiagramOptions,
): HTMLDivElement {
  const {
    messages,
    presentationI18n,
    formatMessage,
    session,
    saturationThresholdDecibans,
    plotWidth,
    selectedEvidenceId,
    palette,
    dissonanceLabel,
    onInspectEvidence,
    onEditPriorEndpoint,
    onResetPrior,
  } = options;
  const { mode: viewMode, trailExpanded } = claimView;
  const labels = evaluated.steps.map((step) => {
    const item = items.find(({ id }) => id === step.evidenceId);
    const premise = item && claimById(session.inquiry, item.premiseClaimId);
    return {
      title: premise?.title ?? formatMessage(messages.evidenceNumber, { number: 1 }),
      strength: item && item.impact.deltaMean === 0 && item.impact.deltaStandardDeviation === 0
        ? presentationI18n.messages.inquiry.strength.noAdditionalEffectShort
        : formatEvidenceListStrength(presentationI18n, step.before, step.after),
      strengthColor: evidenceStrengthColor({
        netWeightDecibans: step.after.mean - step.before.mean,
        absoluteWeightDecibans: Math.abs(step.after.mean - step.before.mean),
        dissonance: 0,
      }, { saturationThresholdDecibans }),
    };
  });
  const { svg, geometry, bands } = renderInquiryTrajectory(
    messages.trajectoryAria,
    evaluated,
    saturationThresholdDecibans,
    plotWidth,
    labels,
  );
  for (const selectable of svg.querySelectorAll<SVGElement>('.inquiry-flow-evidence[data-evidence-id]')) {
    selectable.classList.toggle('is-selected', selectable.dataset.evidenceId === selectedEvidenceId);
    selectable.addEventListener('pointerenter', () => selectable.classList.add('is-hovered'));
    selectable.addEventListener('pointerleave', () => selectable.classList.remove('is-hovered'));
    selectable.addEventListener('focusin', () => selectable.classList.add('is-focused'));
    selectable.addEventListener('focusout', () => selectable.classList.remove('is-focused'));
    const labelButton = selectable.querySelector('.inquiry-flow-label-button');
    labelButton?.addEventListener('pointerenter', () => selectable.classList.add('is-hovered'));
    labelButton?.addEventListener('pointerleave', () => selectable.classList.remove('is-hovered'));
    labelButton?.addEventListener('focus', () => selectable.classList.add('is-focused'));
    labelButton?.addEventListener('blur', () => selectable.classList.remove('is-focused'));
  }
  const inspectEvidence = (evidenceId: string) => {
    for (const selectable of svg.querySelectorAll<SVGElement>('.inquiry-flow-evidence[data-evidence-id]')) {
      selectable.classList.toggle('is-selected', selectable.dataset.evidenceId === evidenceId);
    }
    onInspectEvidence(evidenceId);
  };
  svg.addEventListener('click', (event) => {
    const selectable = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-evidence-id]')
      : null;
    if (selectable?.dataset.evidenceId) inspectEvidence(selectable.dataset.evidenceId);
  });
  svg.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const eventElement = event.target instanceof Element ? event.target : null;
    const selectable = eventElement?.closest<HTMLElement>('[data-evidence-id]');
    if (!selectable?.dataset.evidenceId || eventElement?.closest('button')) return;
    event.preventDefault();
    inspectEvidence(selectable.dataset.evidenceId);
  });
  const detail = viewMode === 'graph' && trailExpanded
    ? element('div', { className: 'inquiry-trail' }, [
      element('figure', { className: 'inquiry-flow-figure' }, [
        element('div', { className: 'inquiry-flow-canvas' }, [svg]),
      ]),
    ])
    : undefined;
  const resultTone = inquiryStepTone(evaluated.prior, evaluated.posterior);
  const meanSummary = aggregateEvidence(evaluated.steps.map((step) => ({
    weightDecibans: step.after.mean - step.before.mean,
  })));
  const resultantArrow = renderInquiryResultant(evaluated, geometry, plotWidth, resultantColor);
  const summary = renderCollapsedEvidenceSummary({
    weights: evaluated.steps.map((step) => step.after.mean - step.before.mean),
    displayExtent: 2 * saturationThresholdDecibans,
    formatWeight: (value) => formatJeffreysStrength(presentationI18n, value),
    oppositionLabel: palette.against,
    supportLabel: palette.for,
    dissonanceLabel,
    formatDissonance: (value) => formatDissonance(presentationI18n, value),
    ariaLabel: `${palette.against}: ${presentationI18n.number((meanSummary.absoluteWeightDecibans - meanSummary.netWeightDecibans) / 2, { maximumFractionDigits: 0 })}. ${dissonanceLabel}: ${formatDissonance(presentationI18n, meanSummary.dissonance)}. ${palette.for}: ${presentationI18n.number((meanSummary.absoluteWeightDecibans + meanSummary.netWeightDecibans) / 2, { maximumFractionDigits: 0 })}.`,
  });
  const trailToggle = element('button', {
    type: 'button',
    className: 'inquiry-trail-toggle',
    dataset: { action: 'toggle-trail' },
    'aria-expanded': String(trailExpanded),
    'aria-label': trailExpanded ? messages.hideEvidencePath : messages.showEvidencePath,
  }, [element('span', { className: 'inquiry-graph-toggle-chevron', 'aria-hidden': 'true' })]);
  const addEvidence = element('div', { className: 'inquiry-flow-add' }, [
    element('button', {
      type: 'button',
      dataset: { action: 'add-evidence' },
      'aria-label': messages.addDirectionalEvidence,
      title: messages.addDirectionalEvidence,
    }, [
      element('span', { className: 'inquiry-flow-add-icon', 'aria-hidden': 'true', textContent: '+' }),
      element('span', { textContent: messages.addDirectionalEvidence }),
    ]),
  ]);
  detail?.prepend(addEvidence);
  const combinedStrength = formatStrengthChange(
    presentationI18n,
    evaluated.prior,
    evaluated.posterior,
    presentationI18n.messages.inquiry.strength.combinedNone,
  );
  const combinedStrengthTag = element('strong', {
    className: 'inquiry-resultant-strength',
    textContent: combinedStrength,
  });
  combinedStrengthTag.style.setProperty('--result-color', resultantColor);
  summary.setAttribute('aria-hidden', 'true');
  const graphToggle = element('button', {
    type: 'button',
    className: 'inquiry-graph-toggle',
    dataset: { action: 'toggle-graph' },
    'aria-expanded': String(viewMode === 'graph'),
    'aria-label': `${messages.evidenceDisclosure}. ${formatMessage(messages.combinedEvidence, { strength: combinedStrength })}. ${summary.getAttribute('aria-label')}`,
  }, [
    element('span', { className: 'inquiry-graph-toggle-heading' }, [
      element('span', { className: 'inquiry-graph-toggle-chevron', 'aria-hidden': 'true' }),
      element('span', {
        className: 'inquiry-graph-toggle-title',
        textContent: formatMessage(messages.combinedEvidence, { strength: '' }).replace(/\s*:\s*$/, ''),
      }),
      combinedStrengthTag,
    ]),
    summary,
  ]);
  const trailStage = element('div', { className: `inquiry-trail-stage is-${viewMode}` }, [graphToggle]);
  const graphDetails: HTMLElement[] = [];
  if (viewMode === 'graph') {
    const initialPrior = inquiryInitialPrior(session);
    const currentPrior = claimById(session.inquiry, session.focusClaimId).prior;
    const resetVisible = initialPrior.mean !== currentPrior.mean
      || initialPrior.standardDeviation !== currentPrior.standardDeviation;
    const currentAxis = renderCredibilityAxis({
      label: messages.current,
      band: bands.at(-1)!,
      position: geometry.bands.at(-1)!,
      domain: geometry,
      className: `is-current is-${resultTone}`,
      saturationThresholdDecibans,
      plotWidth,
      messages,
      formatPercent: presentationI18n.percent,
      background: credibilityBandBackground(bands.at(-1)!, {
        minimum: geometry.minimum,
        maximum: geometry.maximum,
        saturationThresholdDecibans,
      }),
      overlay: resultantArrow,
    });
    const priorAxis = renderCredibilityAxis({
      label: messages.prior,
      band: bands[0]!,
      position: geometry.bands[0]!,
      domain: geometry,
      className: 'is-prior',
      saturationThresholdDecibans,
      plotWidth,
      messages,
      formatPercent: presentationI18n.percent,
      editable: true,
      resetVisible,
      onReset: onResetPrior,
      onEditEndpoint: onEditPriorEndpoint,
      background: credibilityBandBackground(bands[0]!, {
        minimum: geometry.minimum,
        maximum: geometry.maximum,
        saturationThresholdDecibans,
      }),
    });
    currentAxis.classList.add('has-trail-toggle');
    currentAxis.append(trailToggle);
    if (!trailExpanded) {
      currentAxis.classList.add('is-compact-pair');
      priorAxis.classList.add('is-compact-pair');
    }
    graphDetails.push(currentAxis, ...(detail ? [detail] : []), priorAxis);
  }
  const diagram = element('div', { className: 'inquiry-diagram' }, [trailStage, ...graphDetails]);
  requestAnimationFrame(() => drawConnections(
    diagram,
    evaluated,
    geometry,
    plotWidth,
    viewMode === 'graph' && trailExpanded,
  ));
  return diagram;
}
