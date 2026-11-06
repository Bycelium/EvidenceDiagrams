import {
  aggregateEvidence,
  credibilityAxisColor,
  credibilityBandBackground,
  DEFAULT_COLOR_OPTIONS,
  evidenceStrengthColor,
  evaluateInquiry,
  formatProbabilityDisplay,
} from '@bycelium/evidence-diagrams';
import {
  bandToGaussian,
  gaussianToBand,
} from '@bycelium/evidence-diagrams/propagation-math';
import { createInquiryPreset } from './presets.js';
import {
  createInquiryEvidencePanel,
  hasZeroAssignedImpact,
} from './components/evidence-panel.js';
import {
  claimEvidenceSummary,
  renderClaimCredibility,
} from './components/claim-card.js';
import { createConditionalStrengthControl } from './components/conditional-strength-control.js';
import { renderCollapsedEvidenceSummary } from './diagram/evidence-summary.js';
import { drawColorLegend, legendThemeForPreference } from './diagram/color-legend.js';
import {
  inquiryConnectionGeometry,
  inquiryStepTone,
  renderInquiryConnections,
  renderInquiryResultant,
  renderInquiryTrajectory,
} from './diagram/renderer.js';
import { editBandEndpoint } from './diagram/geometry.js';
import { element, safeHttpUrl } from './dom.js';
import {
  formatJeffreysStrength,
  formatDissonance,
  formatStrengthChange,
} from './presentation.js';
import {
  addInquiryEvidence,
  claimsAvailableAsPremises,
  createBlankInquirySession,
  cloneInquirySession,
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
} from './state.js';

function placeEndpointHandle(handle, bound, percent) {
  const inward = (bound === 'lower' && percent <= 12)
    || (bound === 'upper' && percent >= 88);
  handle.classList.toggle('is-inward', inward);
  handle.style.left = `${percent}%`;
  handle.style.setProperty(
    '--prior-anchor', inward === (bound === 'lower') ? '0%' : '100%',
  );
}

function formatEvidenceListStrength(i18n, before, after) {
  const meanShift = after.mean - before.mean;
  if (Math.abs(meanShift) > 1e-12) {
    return i18n.t(
      meanShift > 0 ? 'inquiry.strengthSupport' : 'inquiry.strengthOpposition',
      { strength: formatJeffreysStrength(i18n, meanShift) },
    );
  }
  return i18n.t(
    Math.abs(after.standardDeviation - before.standardDeviation) > 1e-12
      ? 'inquiry.strengthWidth'
      : 'inquiry.strengthNone',
  );
}

const $ = (selector) => document.querySelector(selector);
const weakestFirst = { evidenceOrder: 'weakest-first' };

function centerY(node, containerRect) {
  const bounds = node.getBoundingClientRect();
  return bounds.top + bounds.height / 2 - containerRect.top;
}

function drawInquiryConnections(diagram, evaluation, geometry, plotWidth, expanded) {
  if (!diagram.isConnected || evaluation.steps.length === 0) return;
  const diagramBounds = diagram.getBoundingClientRect();
  const currentTrack = diagram.querySelector(
    '.inquiry-flow-axis.is-current .inquiry-flow-axis-track',
  );
  const priorTrack = diagram.querySelector(
    '.inquiry-flow-axis.is-prior .inquiry-flow-axis-track',
  );
  if (!currentTrack || !priorTrack || diagramBounds.width <= 0 || diagramBounds.height <= 0) return;

  let trajectoryCurrentY;
  let trajectoryPriorY;
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
      geometry.minimum
      + coordinate / plotWidth * (geometry.maximum - geometry.minimum)
    ));
  const connectionGeometry = inquiryConnectionGeometry({
    width: diagramBounds.width,
    currentPosition: geometry.bands.at(-1),
    priorPosition: geometry.bands[0],
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

function claimById(inquiry, id) {
  return inquiry.claims.find((claim) => claim.id === id);
}

function contributionById(inquiry, id) {
  return inquiry.contributions.find((contribution) => contribution.id === id);
}

function textField(label, name, { type = 'text', required = false, value = '' } = {}) {
  const input = element('input', { name, type, value, ...(required ? { required: '' } : {}) });
  return { input, label: element('label', {}, [element('span', { textContent: label }), input]) };
}

function textareaField(label, name, { required = false, value = '', rows = 2 } = {}) {
  const input = element('textarea', {
    name,
    rows,
    ...(required ? { required: '' } : {}),
  });
  input.value = value;
  return { input, label: element('label', {}, [element('span', { textContent: label }), input]) };
}

export function mountInquiryUI(i18n) {
  const saturationThreshold = $('#inquiry-saturation-threshold');
  const saturationThresholdValue = $('#inquiry-saturation-threshold-value');
  const colorLegend = $('#inquiry-color-legend');
  const legendCanvas = $('#inquiry-legend-canvas');
  const legendDialog = $('#inquiry-legend-dialog');
  const legendOpenButton = $('#inquiry-legend-open');
  const breadcrumbs = $('#inquiry-breadcrumbs');
  const rootList = $('#inquiry-root-list');
  const focus = $('#inquiry-focus');
  const dialog = $('#inquiry-dialog');
  const dialogTitle = $('#inquiry-dialog-title');
  const dialogBody = $('#inquiry-dialog-body');
  const dialogForm = $('#inquiry-dialog-form');
  const dialogSubmit = $('#inquiry-dialog-submit');
  const activePresetId = 'nuclear';
  let session = createInquirySession(createInquiryPreset(activePresetId, i18n.locale));
  const presetRootId = session.inquiry.rootClaimId;
  const rootSessions = new Map([[presetRootId, session]]);
  const customRootDefaults = new Map();
  let renderedLocale = i18n.locale;
  let submitDialog = null;
  let saturationThresholdDecibans = DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans;
  let selectedEvidenceId;
  let renderedPlotWidth = 0;
  let resizeFrame;
  let priorDrag;
  let legendRenderState;
  const darkModeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

  const evidencePanel = createInquiryEvidencePanel(i18n, {
    onEditEvidence(evidenceId) {
      openSourceDialog(evidenceId);
    },
    onRemoveEvidence(evidenceId) {
      removeInquiryEvidence(session, evidenceId);
      selectedEvidenceId = undefined;
      render();
    },
    onInvestigate(claimId) {
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
  });

  function openEvidencePanel(evidenceId) {
    selectedEvidenceId = evidenceId;
    evidencePanel.open(panelState(evidenceId));
  }

  function activeRootId() {
    return session.inquiry.rootClaimId;
  }

  function nextCustomRootId() {
    let number = rootSessions.size + 1;
    let id = `inquiry-root-${number}`;
    while (rootSessions.has(id)) {
      number += 1;
      id = `inquiry-root-${number}`;
    }
    return id;
  }

  function activateRoot(rootId) {
    const next = rootSessions.get(rootId);
    if (!next || next === session) return;
    session = next;
    selectedEvidenceId = undefined;
    legendRenderState = undefined;
    evidencePanel.close();
    render();
  }

  function panelState(evidenceId) {
    return {
      inquiry: session.inquiry,
      evaluation: evaluateInquiry(session.inquiry, weakestFirst),
      evidenceId,
      saturationThresholdDecibans,
      conditionalStrengthDefault: inquiryInitialDeltaMean(session, evidenceId),
    };
  }

  function formatAxisProbability(decibans) {
    const display = formatProbabilityDisplay(decibans, 'exact');
    if (Math.abs(display.value - 50) < .05) return i18n.percent(.5, { maximumFractionDigits: 0 });
    const percentage = i18n.percent(display.value / 100, { maximumFractionDigits: 12 });
    return `${display.operator ?? '~'}\u00a0${percentage}`;
  }

  function combinedStrengthFor(evaluated) {
    return formatStrengthChange(
      i18n,
      evaluated.prior,
      evaluated.posterior,
      'inquiry.combinedNone',
    );
  }

  function renderLegend(evidenceSummary, currentCredibility) {
    if (evidenceSummary && currentCredibility) {
      legendRenderState = { evidenceSummary, currentCredibility };
    }
    if (!legendDialog.open || !legendRenderState) return;
    const width = Math.max(200, Math.min(360, colorLegend.clientWidth));
    drawColorLegend(legendCanvas, {
      width,
      summary: legendRenderState.evidenceSummary,
      resultantColor: legendRenderState.currentCredibility.palette.color,
      colorOptions: legendRenderState.currentCredibility.palette.colorOptions,
      labels: {
        uncertain: i18n.t('palette.uncertain'),
        against: i18n.t('palette.against'),
        dissonance: i18n.t('palette.dissonance'),
        for: i18n.t('palette.for'),
      },
      theme: legendThemeForPreference(darkModeQuery?.matches),
    });
  }

  function setLegendOpen(open) {
    if (open) {
      legendDialog.show();
      legendOpenButton.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => renderLegend());
      return;
    }
    if (legendDialog.open) legendDialog.close();
    legendOpenButton.setAttribute('aria-expanded', 'false');
  }

  function commitPriorEndpoint(bound, value, geometry, restoreFocus = false) {
    const claim = claimById(session.inquiry, session.focusClaimId);
    const band = editBandEndpoint(
      gaussianToBand(claim.prior),
      bound,
      value,
      geometry.minimum,
      geometry.maximum,
    );
    const candidate = candidateSession();
    editInquiryClaim(candidate, claim.id, { prior: bandToGaussian(band) });
    if (commitCandidate(candidate)) {
      render();
      if (restoreFocus) {
        document.querySelector(`[data-prior-bound="${bound}"]`)?.focus();
      }
    }
  }

  function restorePriorDrag() {
    if (!priorDrag?.moved) return;
    const candidate = candidateSession();
    editInquiryClaim(candidate, priorDrag.claimId, { prior: priorDrag.originalPrior });
    if (commitCandidate(candidate)) render();
  }

  function resetPrior() {
    const claim = claimById(session.inquiry, session.focusClaimId);
    const initialPrior = inquiryInitialPrior(session, claim.id);
    if (
      claim.prior.mean === initialPrior.mean
      && claim.prior.standardDeviation === initialPrior.standardDeviation
    ) return;
    const candidate = candidateSession();
    editInquiryClaim(candidate, claim.id, { prior: initialPrior });
    if (commitCandidate(candidate)) render();
  }

  function candidateSession() {
    return cloneInquirySession(session);
  }

  function commitCandidate(candidate, validityTarget) {
    try {
      evaluateInquiry(candidate.inquiry, weakestFirst);
      validityTarget?.setCustomValidity('');
      session = candidate;
      rootSessions.set(activeRootId(), session);
      return true;
    } catch {
      validityTarget?.setCustomValidity(i18n.t('inquiry.invalidRelationship'));
      return false;
    }
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
    submitDialog = null;
  }

  function showDialog(title, submitLabel, body, handler) {
    dialogTitle.textContent = title;
    dialogSubmit.textContent = submitLabel;
    dialogBody.replaceChildren(...body);
    for (const control of dialogBody.querySelectorAll('input, select, textarea')) {
      control.addEventListener('input', () => control.setCustomValidity(''));
      control.addEventListener('change', () => control.setCustomValidity(''));
    }
    submitDialog = handler;
    dialog.showModal();
  }

  function resultForClaim(result, claimId) {
    const claim = result.claims[claimId];
    if (!claim) throw new Error(`Missing evaluation for claim: ${claimId}`);
    return claim;
  }

  function evidenceSummaryFor(evaluated) {
    return claimEvidenceSummary(evaluated);
  }

  function renderCurrentCredibility(evaluated, evidenceSummary, compact = false) {
    return renderClaimCredibility(
      i18n, evaluated, evidenceSummary, saturationThresholdDecibans, compact,
    );
  }

  function renderBreadcrumbs(result) {
    const ancestorIds = session.breadcrumbs.slice(0, -1);
    breadcrumbs.hidden = ancestorIds.length === 0;
    if (breadcrumbs.hidden) {
      breadcrumbs.replaceChildren();
      return;
    }
    const list = element('ol');
    ancestorIds.forEach((claimId) => {
      const claim = claimById(session.inquiry, claimId);
      const evaluated = resultForClaim(result, claim.id);
      const currentCredibility = renderCurrentCredibility(
        evaluated, evidenceSummaryFor(evaluated), true,
      );
      const button = element('button', {
        type: 'button',
        className: 'inquiry-ancestor-link',
        dataset: { action: 'open-claim', claimId },
      }, [
        element('span', { className: 'inquiry-ancestor-title', textContent: claim.title }),
        currentCredibility.credibility,
      ]);
      button.style.setProperty('--result-color', currentCredibility.palette.color);
      list.append(element('li', {}, [button]));
    });
    breadcrumbs.replaceChildren(list);
  }

  function renderRootList() {
    const items = [element('div', { className: 'inquiry-root-add' }, [
      element('button', {
        type: 'button',
        dataset: { action: 'add-root' },
        'aria-label': i18n.t('inquiry.addRoot'),
      }, [
        element('span', { className: 'inquiry-flow-add-icon', 'aria-hidden': 'true', textContent: '+' }),
        element('span', { textContent: i18n.t('inquiry.addRoot') }),
      ]),
    ])];
    for (const [rootId, rootSession] of rootSessions) {
      if (rootId === activeRootId()) continue;
      const root = claimById(rootSession.inquiry, rootId);
      const evaluated = resultForClaim(evaluateInquiry(rootSession.inquiry, weakestFirst), rootId);
      const rendered = renderCurrentCredibility(
        evaluated, evidenceSummaryFor(evaluated), true,
      );
      const card = element('button', {
        type: 'button',
        className: 'inquiry-root-card inquiry-claim-card',
        dataset: { action: 'select-root', rootId },
        'aria-label': i18n.t('inquiry.openRootNamed', { root: root.title }),
      }, [
        element('span', { className: 'inquiry-root-card-title', textContent: root.title }),
        rendered.credibility,
      ]);
      card.style.setProperty('--result-color', rendered.palette.color);
      items.push(card);
    }
    rootList.replaceChildren(...items);
  }

  function formatBandEndpoint(decibans, direction) {
    const display = formatProbabilityDisplay(decibans, direction);
    const percentage = i18n.percent(display.value / 100, { maximumFractionDigits: 12 });
    return display.operator === undefined ? percentage : `${display.operator}\u00a0${percentage}`;
  }

  function renderBandValue(band) {
    const exact = band.lower === band.upper;
    const value = element('span', {
      className: `inquiry-flow-axis-value${exact ? ' is-exact' : ''}`,
    });
    const lower = element('span', {
      className: 'inquiry-flow-axis-endpoint is-lower',
      textContent: formatBandEndpoint(band.lower, exact ? 'exact' : 'lower'),
    });
    lower.style.color = credibilityAxisColor(band.lower, { saturationThresholdDecibans });
    if (exact) {
      value.append(lower);
      return value;
    }
    const upper = element('span', {
      className: 'inquiry-flow-axis-endpoint is-upper',
      textContent: formatBandEndpoint(band.upper, 'upper'),
    });
    upper.style.color = credibilityAxisColor(band.upper, { saturationThresholdDecibans });
    value.append(lower, element('span', {
      className: 'inquiry-flow-axis-separator',
      textContent: '–',
    }), upper);
    return value;
  }

  function renderFlowAxis(
    label, band, position, geometry, className, editable = false, background, overlay,
  ) {
    const current = className.split(' ').includes('is-current');
    let reset;
    const track = element('div', {
      className: `inquiry-flow-axis-track${current ? ' posterior-track' : ''}`,
      'aria-hidden': 'true',
    });
    const shape = element('span', {
      className: `inquiry-flow-axis-band${current ? ' posterior-band' : ''} ${className}`,
    });
    shape.style.left = `${position.left}%`;
    shape.style.width = `${Math.max(position.width, .3)}%`;
    if (background) shape.style.background = background;
    if (current) {
      const visible = band.upper >= geometry.minimum && band.lower <= geometry.maximum;
      const exact = band.lower === band.upper;
      shape.hidden = !visible || exact;
      track.classList.toggle('is-exact', exact && visible);
      track.classList.toggle('is-clipped-minimum', position.clippedMinimum);
      track.classList.toggle('is-clipped-maximum', position.clippedMaximum);
      track.style.setProperty('--posterior-x', `${position.center}%`);
      track.style.setProperty(
        '--posterior-minimum-color',
        credibilityAxisColor(band.lower, { saturationThresholdDecibans }),
      );
      track.style.setProperty(
        '--posterior-maximum-color',
        credibilityAxisColor(band.upper, { saturationThresholdDecibans }),
      );
    }
    track.append(shape);
    if (overlay) track.append(overlay);
    if (position.clippedMinimum) track.append(element('span', { className: 'inquiry-flow-clipped is-minimum', 'aria-hidden': 'true', textContent: '←' }));
    if (position.clippedMaximum) track.append(element('span', { className: 'inquiry-flow-clipped is-maximum', 'aria-hidden': 'true', textContent: '→' }));
    if (editable) {
      track.classList.add('prior-track');
      track.removeAttribute('aria-hidden');
      const toPercent = (value) => Math.max(0, Math.min(100,
        (value - geometry.minimum) / (geometry.maximum - geometry.minimum) * 100));
      const exact = band.lower === band.upper;
      track.classList.toggle('is-exact', exact);
      track.style.setProperty('--caret-x', `${toPercent(band.lower)}%`);
      track.style.setProperty('--prior-color', credibilityAxisColor(band.lower, { saturationThresholdDecibans }));
      const handles = ['lower', 'upper'].map((bound) => {
        const value = band[bound];
        const handle = element('button', {
          type: 'button',
          className: `prior-handle inquiry-prior-handle prior-handle-${bound === 'lower' ? 'min' : 'max'} is-${bound}`,
          dataset: { priorBound: bound },
          role: 'slider',
          'aria-label': i18n.t(bound === 'lower' ? 'inquiry.priorLowerHandle' : 'inquiry.priorUpperHandle'),
          'aria-valuemin': geometry.minimum,
          'aria-valuemax': geometry.maximum,
          'aria-valuenow': Math.max(geometry.minimum, Math.min(geometry.maximum, value)),
          'aria-valuetext': formatAxisProbability(value),
        });
        placeEndpointHandle(handle, bound, toPercent(value));
        handle.style.setProperty('--prior-color', credibilityAxisColor(value, { saturationThresholdDecibans }));
        handle.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const step = event.shiftKey ? 5 : 1;
          const current = Number(handle.getAttribute('aria-valuenow'));
          const next = event.key === 'Home' ? geometry.minimum
            : event.key === 'End' ? geometry.maximum
              : current + (event.key === 'ArrowRight' ? step : -step);
          commitPriorEndpoint(bound, next, geometry, true);
        });
        return handle;
      });
      track.append(...handles);
      const initialPrior = inquiryInitialPrior(session);
      const currentPrior = claimById(session.inquiry, session.focusClaimId).prior;
      if (
        initialPrior.mean !== currentPrior.mean
        || initialPrior.standardDeviation !== currentPrior.standardDeviation
      ) {
        reset = element('button', {
          type: 'button',
          className: 'inquiry-prior-reset',
          dataset: { action: 'reset-prior' },
          'aria-label': i18n.t('inquiry.resetPrior'),
          title: i18n.t('inquiry.resetPrior'),
          textContent: '↺',
        });
      }
    }
    const ruler = element('div', { className: 'inquiry-flow-ruler', 'aria-hidden': 'true' });
    const firstTick = Math.ceil(geometry.minimum / 5) * 5;
    const values = new Set([geometry.minimum, geometry.maximum, 0]);
    for (let value = firstTick; value <= geometry.maximum; value += 5) values.add(value);
    const tickValues = [...values]
      .filter((value) => value >= geometry.minimum && value <= geometry.maximum)
      .sort((left, right) => left - right);
    const width = renderedPlotWidth || 600;
    const labels = new Map();
    const placements = [];
    const priority = [0, geometry.minimum, geometry.maximum, ...tickValues]
      .filter((value, index, all) => all.indexOf(value) === index);
    for (const value of priority) {
      const text = formatAxisProbability(value);
      const estimatedWidth = Math.max(22, text.length * 6.8);
      const center = (value - geometry.minimum) / (geometry.maximum - geometry.minimum) * width;
      const left = Math.max(1, Math.min(width - estimatedWidth - 1, center - estimatedWidth / 2));
      const right = left + estimatedWidth;
      if (placements.some(([start, end]) => left <= end + 5 && right >= start - 5)) continue;
      placements.push([left, right]);
      labels.set(value, text);
    }
    for (const value of tickValues) {
      const text = labels.get(value) ?? '';
      const tick = element('span', {
        className: [
          text ? '' : 'is-unlabelled',
          value === geometry.minimum ? 'is-first' : '',
          value === geometry.maximum ? 'is-last' : '',
        ].filter(Boolean).join(' '),
        textContent: text,
      });
      tick.style.left = `${(value - geometry.minimum) / (geometry.maximum - geometry.minimum) * 100}%`;
      ruler.append(tick);
    }
    return element('div', {
      className: `inquiry-flow-axis ${className}${reset ? ' has-prior-reset' : ''}`,
    }, [
      element('strong', { textContent: label }),
      renderBandValue(band),
      ruler,
      track,
      ...(reset ? [reset] : []),
    ]);
  }

  function renderClaimDiagram(evaluated, items, resultantColor, claimView) {
    const { mode: viewMode, trailExpanded } = claimView;
    const plotWidth = Math.max(240, focus.clientWidth - 28);
    renderedPlotWidth = plotWidth;
    const labels = evaluated.steps.map((step) => {
      const item = items.find(({ id }) => id === step.evidenceId);
      const premise = item && claimById(session.inquiry, item.premiseClaimId);
      return {
        title: premise?.title ?? i18n.t('inquiry.evidenceNumber', { number: 1 }),
        strength: item && hasZeroAssignedImpact(item)
          ? i18n.t('inquiry.noAdditionalEffectShort')
          : formatEvidenceListStrength(i18n, step.before, step.after),
        strengthColor: evidenceStrengthColor({
          netWeightDecibans: step.after.mean - step.before.mean,
          absoluteWeightDecibans: Math.abs(step.after.mean - step.before.mean),
          dissonance: 0,
        }, { saturationThresholdDecibans }),
      };
    });
    const { svg, geometry, bands } = renderInquiryTrajectory(
      i18n, evaluated, saturationThresholdDecibans, plotWidth, labels,
    );
    for (const selectable of svg.querySelectorAll('.inquiry-flow-evidence[data-evidence-id]')) {
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
    const inspectEvidence = (evidenceId) => {
      for (const selectable of svg.querySelectorAll('.inquiry-flow-evidence[data-evidence-id]')) {
        selectable.classList.toggle('is-selected', selectable.dataset.evidenceId === evidenceId);
      }
      openEvidencePanel(evidenceId);
    };
    svg.addEventListener('click', (event) => {
      const selectable = event.target.closest('[data-evidence-id]');
      if (selectable) inspectEvidence(selectable.dataset.evidenceId);
    });
    svg.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const selectable = event.target.closest('[data-evidence-id]');
      if (!selectable || event.target.closest('button')) return;
      event.preventDefault();
      inspectEvidence(selectable.dataset.evidenceId);
    });
    let detail;
    if (viewMode === 'graph' && trailExpanded) {
      detail = element('div', { className: 'inquiry-trail' }, [
        element('figure', { className: 'inquiry-flow-figure' }, [
          element('div', { className: 'inquiry-flow-canvas' }, [svg]),
        ]),
      ]);
    }
    const resultTone = inquiryStepTone(evaluated.prior, evaluated.posterior);
    const meanSummary = aggregateEvidence(evaluated.steps.map((step) => ({
      weightDecibans: step.after.mean - step.before.mean,
    })));
    const resultantArrow = renderInquiryResultant(evaluated, geometry, plotWidth, resultantColor);
    const summary = renderCollapsedEvidenceSummary({
        weights: evaluated.steps.map((step) => step.after.mean - step.before.mean),
        displayExtent: 2 * saturationThresholdDecibans,
        formatWeight: (value) => formatJeffreysStrength(i18n, value),
        oppositionLabel: i18n.t('palette.against'),
        supportLabel: i18n.t('palette.for'),
        dissonanceLabel: i18n.t('measure.dissonance'),
        formatDissonance: (value) => formatDissonance(i18n, value),
        ariaLabel: `${i18n.t('palette.against')}: ${i18n.number((meanSummary.absoluteWeightDecibans - meanSummary.netWeightDecibans) / 2, { maximumFractionDigits: 0 })}. ${i18n.t('measure.dissonance')}: ${formatDissonance(i18n, meanSummary.dissonance)}. ${i18n.t('palette.for')}: ${i18n.number((meanSummary.absoluteWeightDecibans + meanSummary.netWeightDecibans) / 2, { maximumFractionDigits: 0 })}.`,
      });
    const trailToggle = element('button', {
      type: 'button',
      className: 'inquiry-trail-toggle',
      dataset: { action: 'toggle-trail' },
      'aria-expanded': String(trailExpanded),
      'aria-label': i18n.t(trailExpanded ? 'inquiry.hideEvidencePath' : 'inquiry.showEvidencePath'),
    }, [
      element('span', { className: 'inquiry-graph-toggle-chevron', 'aria-hidden': 'true' }),
    ]);
    const addEvidence = element('div', { className: 'inquiry-flow-add' }, [
      element('button', {
        type: 'button',
        dataset: { action: 'add-evidence' },
        'aria-label': i18n.t('inquiry.addDirectionalEvidence'),
        title: i18n.t('inquiry.addDirectionalEvidence'),
      }, [
        element('span', { className: 'inquiry-flow-add-icon', 'aria-hidden': 'true', textContent: '+' }),
        element('span', { textContent: i18n.t('inquiry.addDirectionalEvidence') }),
      ]),
    ]);
    if (detail) detail.prepend(addEvidence);
    const combinedStrength = combinedStrengthFor(evaluated);
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
      'aria-label': `${i18n.t('inquiry.evidenceDisclosure')}. ${i18n.t('inquiry.combinedEvidence', { strength: combinedStrength })}. ${summary.getAttribute('aria-label')}`,
    }, [
      element('span', { className: 'inquiry-graph-toggle-heading' }, [
        element('span', { className: 'inquiry-graph-toggle-chevron', 'aria-hidden': 'true' }),
        element('span', {
          className: 'inquiry-graph-toggle-title',
          textContent: i18n.t('inquiry.combinedEvidence', { strength: '' }).replace(/\s*:\s*$/, ''),
        }),
        combinedStrengthTag,
      ]),
      summary,
    ]);
    const trailStage = element('div', { className: `inquiry-trail-stage is-${viewMode}` }, [
      graphToggle,
    ]);
    const graphDetails = [];
    if (viewMode === 'graph') {
      const currentAxis = renderFlowAxis(
        i18n.t('inquiry.current'),
        bands.at(-1),
        geometry.bands.at(-1),
        geometry,
        `is-current is-${resultTone}`,
        false,
        credibilityBandBackground(bands.at(-1), {
          minimum: geometry.minimum,
          maximum: geometry.maximum,
          saturationThresholdDecibans,
        }),
        resultantArrow,
      );
      const priorAxis = renderFlowAxis(
        i18n.t('inquiry.prior'),
        bands[0],
        geometry.bands[0],
        geometry,
        'is-prior',
        true,
        credibilityBandBackground(bands[0], {
          minimum: geometry.minimum,
          maximum: geometry.maximum,
          saturationThresholdDecibans,
        }),
      );
      currentAxis.classList.add('has-trail-toggle');
      currentAxis.append(trailToggle);
      if (!trailExpanded) {
        currentAxis.classList.add('is-compact-pair');
        priorAxis.classList.add('is-compact-pair');
      }
      graphDetails.push(currentAxis, ...(detail ? [detail] : []), priorAxis);
    }
    const diagram = element('div', { className: 'inquiry-diagram' }, [trailStage, ...graphDetails]);
    requestAnimationFrame(() => drawInquiryConnections(
      diagram, evaluated, geometry, plotWidth, viewMode === 'graph' && trailExpanded,
    ));
    return diagram;
  }

  function render() {
    const result = evaluateInquiry(session.inquiry, weakestFirst);
    const claim = claimById(session.inquiry, session.focusClaimId);
    const evaluated = resultForClaim(result, claim.id);
    const items = session.inquiry.evidence.filter(({ targetClaimId }) => targetClaimId === claim.id);
    const evidenceSummary = evidenceSummaryFor(evaluated);
    const currentCredibility = renderCurrentCredibility(evaluated, evidenceSummary);
    const claimView = inquiryClaimView(session);
    renderRootList();
    renderBreadcrumbs(result);
    const header = element('button', {
      type: 'button',
      className: 'inquiry-focus-heading inquiry-claim-card',
      dataset: { action: 'toggle-claim' },
      'aria-expanded': String(claimView.expanded),
    }, [
      element('span', { className: 'inquiry-claim-toggle-chevron', 'aria-hidden': 'true' }),
      element('span', { className: 'inquiry-claim-title' }, [
        element('span', { className: 'inquiry-focus-title', textContent: claim.title }),
        currentCredibility.credibility,
      ]),
    ]);
    header.style.setProperty('--result-color', currentCredibility.palette.color);
    if (!claimView.expanded) {
      focus.replaceChildren(header);
      renderLegend(evidenceSummary, currentCredibility);
      return;
    }
    const summary = element('section', { className: 'inquiry-claim-summary' }, [
      renderClaimDiagram(evaluated, items, currentCredibility.palette.color, claimView),
    ]);
    focus.replaceChildren(
      header,
      ...(claim.description ? [element('p', {
        className: 'inquiry-claim-description', textContent: claim.description,
      })] : []),
      summary,
    );
    renderLegend(evidenceSummary, currentCredibility);
  }

  function sourceForm(source = {}) {
    const title = textField(i18n.t('inquiry.sourceTitle'), 'sourceTitle', { required: true, value: source.title ?? '' });
    const url = textField(i18n.t('inquiry.sourceUrl'), 'sourceUrl', {
      type: 'url', required: true, value: source.url ?? '',
    });
    const locator = textField(i18n.t('inquiry.sourceLocator'), 'sourceLocator', { value: source.locator ?? '' });
    return [title.label, url.label, locator.label];
  }

  function sourceFromForm(form) {
    return {
      title: form.elements.sourceTitle.value.trim(),
      url: form.elements.sourceUrl.value.trim(),
      locator: form.elements.sourceLocator.value.trim(),
    };
  }

  function validateSource(form) {
    const input = form.elements.sourceUrl;
    const value = input.value.trim();
    input.setCustomValidity(value && safeHttpUrl(value) ? '' : i18n.t('inquiry.sourceUrlError'));
    return input.validationMessage === '';
  }

  function validateTrimmed(input, message = i18n.t('inquiry.requiredText')) {
    input.setCustomValidity(input.value.trim() ? '' : message);
    return input.validationMessage === '';
  }

  function openAddDialog() {
    const premiseSelect = element('select', { name: 'premiseChoice' });
    premiseSelect.append(element('option', { value: '', textContent: i18n.t('inquiry.newPremise') }));
    for (const claim of claimsAvailableAsPremises(session)) {
      premiseSelect.append(element('option', { value: claim.id, textContent: claim.title }));
    }
    const premiseTitle = textareaField(
      i18n.t('inquiry.premiseAssertion'), 'premiseTitle', { required: true, rows: 2 },
    );
    const premiseDescription = textareaField(
      i18n.t('inquiry.premiseDescription'), 'premiseDescription', { required: true, rows: 2 },
    );
    const sourceTitle = textField(
      i18n.t('inquiry.sourceReference'), 'sourceTitle', { required: true },
    );
    const sourceUrl = textField(i18n.t('inquiry.sourceUrl'), 'sourceUrl', {
      type: 'url', required: true,
    });
    const sourceLocator = textField(i18n.t('inquiry.sourceLocator'), 'sourceLocator');
    const conditionalControl = createConditionalStrengthControl({
      i18n,
      targetTitle: claimById(session.inquiry, session.focusClaimId).title,
      value: 0,
      saturationThresholdDecibans,
    });
    const reuse = element('details', { className: 'inquiry-add-reuse' }, [
      element('summary', { textContent: i18n.t('inquiry.useExistingPremise') }),
      element('label', {}, [
        element('span', { className: 'visually-hidden', textContent: i18n.t('inquiry.premise') }),
        premiseSelect,
      ]),
    ]);
    const premiseSection = element('section', { className: 'inquiry-add-section inquiry-add-premise' }, [
      element('h3', { textContent: i18n.t('inquiry.premise') }),
      premiseTitle.label,
      premiseDescription.label,
      reuse,
    ]);
    const effectSection = element('section', { className: 'inquiry-add-section inquiry-add-effect' }, [
      element('h3', { textContent: i18n.t('inquiry.ifThisWereTrue') }),
      conditionalControl.element,
    ]);
    const sourceSection = element('section', { className: 'inquiry-add-section inquiry-add-source' }, [
      element('h3', { textContent: i18n.t('inquiry.source') }),
      sourceTitle.label,
      sourceUrl.label,
      sourceLocator.label,
    ]);
    showDialog(i18n.t('inquiry.addEvidence'), i18n.t('inquiry.addEvidence'), [
      premiseSection,
      effectSection,
      sourceSection,
    ], () => {
      if (!validateSource(dialogForm)) return false;
      if (!validateTrimmed(dialogForm.elements.sourceTitle)) return false;
      if (!premiseSelect.value) {
        if (!validateTrimmed(premiseTitle.input)) return false;
        if (!validateTrimmed(premiseDescription.input)) return false;
      }
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
        if (!usingExistingPremise) {
          newPremiseDraft = {
            title: premiseTitle.input.value,
            description: premiseDescription.input.value,
          };
        }
        const selected = claimById(session.inquiry, premiseSelect.value);
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

  function openAddRootDialog() {
    const title = textareaField(i18n.t('inquiry.rootAssertion'), 'rootTitle', {
      required: true, rows: 2,
    });
    const description = textareaField(i18n.t('inquiry.rootDescription'), 'rootDescription', {
      required: true, rows: 2,
    });
    showDialog(i18n.t('inquiry.addRoot'), i18n.t('inquiry.addRoot'), [
      title.label,
      description.label,
    ], () => {
      if (!validateTrimmed(title.input) || !validateTrimmed(description.input)) return false;
      const rootId = nextCustomRootId();
      const rootSession = createBlankInquirySession({
        id: rootId,
        title: title.input.value,
        description: description.input.value,
      });
      setInquiryClaimMode(rootSession, 'graph');
      rootSessions.set(rootId, rootSession);
      customRootDefaults.set(rootId, {
        id: rootId,
        title: rootSession.inquiry.claims[0].title,
        description: rootSession.inquiry.claims[0].description,
      });
      session = rootSession;
      selectedEvidenceId = undefined;
      evidencePanel.close();
      return true;
    });
    requestAnimationFrame(() => title.input.focus());
  }

  function openSourceDialog(evidenceId) {
    const item = session.inquiry.evidence.find(({ id }) => id === evidenceId);
    const source = contributionById(session.inquiry, item.contributionId);
    showDialog(i18n.t('inquiry.editDetails'), i18n.t('inquiry.save'), [
      ...sourceForm(source),
    ], () => {
      if (!validateSource(dialogForm)) return false;
      if (!validateTrimmed(dialogForm.elements.sourceTitle)) return false;
      const candidate = candidateSession();
      editInquiryEvidence(candidate, evidenceId, {
        contribution: sourceFromForm(dialogForm),
      });
      return commitCandidate(candidate, dialogForm.elements.sourceTitle);
    });
  }

  function resetActiveRoot() {
    const rootId = activeRootId();
    if (rootId === presetRootId) {
      session = createInquirySession(createInquiryPreset(activePresetId, i18n.locale));
    } else {
      const initial = customRootDefaults.get(rootId);
      session = createBlankInquirySession(initial);
    }
    rootSessions.set(rootId, session);
    selectedEvidenceId = undefined;
    evidencePanel.close();
    renderedLocale = i18n.locale;
    render();
  }
  saturationThreshold.value = String(saturationThresholdDecibans);
  saturationThresholdValue.textContent = i18n.number(saturationThresholdDecibans);
  saturationThreshold.addEventListener('input', () => {
    saturationThresholdDecibans = Number(saturationThreshold.value);
    saturationThresholdValue.textContent = i18n.number(saturationThresholdDecibans);
    evidencePanel.setSaturationThreshold(saturationThresholdDecibans);
    render();
  });
  legendOpenButton.addEventListener('click', () => setLegendOpen(!legendDialog.open));
  $('#inquiry-legend-close').addEventListener('click', () => setLegendOpen(false));
  legendDialog.addEventListener('close', () => legendOpenButton.setAttribute('aria-expanded', 'false'));
  legendDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setLegendOpen(false);
  });
  darkModeQuery?.addEventListener('change', () => renderLegend());
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const nextWidth = Math.max(240, focus.clientWidth - 28);
      if (Math.abs(nextWidth - renderedPlotWidth) < 2) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(render);
    }).observe(focus);
  }
  $('#inquiry-reset').addEventListener('click', resetActiveRoot);
  $('#inquiry-dialog-cancel').addEventListener('click', closeDialog);
  $('#inquiry-dialog-cancel-secondary').addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', () => { submitDialog = null; });
  dialogForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!dialogForm.reportValidity()) return;
    if (submitDialog?.() !== false) {
      closeDialog();
      render();
    } else {
      dialogForm.reportValidity();
    }
  });
  focus.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.inquiry-prior-handle');
    if (!handle || !event.isPrimary || event.button !== 0) return;
    const track = handle.closest('.inquiry-flow-axis-track');
    const bounds = track.getBoundingClientRect();
    const claim = claimById(session.inquiry, session.focusClaimId);
    priorDrag = {
      pointerId: event.pointerId,
      bound: handle.dataset.priorBound,
      claimId: claim.id,
      originalPrior: { ...claim.prior },
      startX: event.clientX,
      startValue: gaussianToBand(claim.prior)[handle.dataset.priorBound],
      lastValue: gaussianToBand(claim.prior)[handle.dataset.priorBound],
      width: Math.max(1, bounds.width),
      minimum: Number(handle.getAttribute('aria-valuemin')),
      maximum: Number(handle.getAttribute('aria-valuemax')),
      moved: false,
    };
    focus.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  document.addEventListener('pointermove', (event) => {
    if (!priorDrag || event.pointerId !== priorDrag.pointerId) return;
    if (event.clientX === priorDrag.startX) {
      if (!priorDrag.moved || priorDrag.lastValue === priorDrag.startValue) return;
      restorePriorDrag();
      priorDrag.lastValue = priorDrag.startValue;
      event.preventDefault();
      return;
    }
    const delta = (event.clientX - priorDrag.startX)
      / priorDrag.width * (priorDrag.maximum - priorDrag.minimum);
    const next = Math.round(priorDrag.startValue + delta);
    if (next === priorDrag.lastValue) return;
    priorDrag.moved = true;
    priorDrag.lastValue = next;
    commitPriorEndpoint(priorDrag.bound, next, priorDrag);
    event.preventDefault();
  });
  document.addEventListener('pointerup', (event) => {
    if (priorDrag?.pointerId !== event.pointerId) return;
    if (focus.hasPointerCapture(event.pointerId)) focus.releasePointerCapture(event.pointerId);
    priorDrag = undefined;
  });
  document.addEventListener('pointercancel', (event) => {
    if (priorDrag?.pointerId !== event.pointerId) return;
    restorePriorDrag();
    if (focus.hasPointerCapture(event.pointerId)) focus.releasePointerCapture(event.pointerId);
    priorDrag = undefined;
  });
  focus.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action } = button.dataset;
    if (action === 'add-evidence') openAddDialog();
    else if (action === 'inspect-evidence') openEvidencePanel(button.dataset.evidenceId);
    else if (action === 'toggle-claim') {
      const restoreFocus = document.activeElement === button;
      setInquiryClaimExpanded(session, !inquiryClaimView(session).expanded);
      render();
      if (restoreFocus) focus.querySelector('.inquiry-focus-heading')?.focus({ preventScroll: true });
    } else if (action === 'toggle-graph') {
      const restoreFocus = document.activeElement === button;
      setInquiryClaimMode(
        session, inquiryClaimView(session).mode === 'graph' ? 'summary' : 'graph',
      );
      render();
      if (restoreFocus) focus.querySelector('.inquiry-graph-toggle')?.focus({ preventScroll: true });
    } else if (action === 'toggle-trail') {
      const restoreFocus = document.activeElement === button;
      setInquiryClaimTrailExpanded(session, !inquiryClaimView(session).trailExpanded);
      render();
      if (restoreFocus) focus.querySelector('.inquiry-trail-toggle')?.focus({ preventScroll: true });
    } else if (action === 'reset-prior') {
      resetPrior();
    }
  });
  rootList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'add-root') openAddRootDialog();
    else if (button.dataset.action === 'select-root') activateRoot(button.dataset.rootId);
  });
  breadcrumbs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="open-claim"]');
    if (!button) return;
    openInquiryClaim(session, button.dataset.claimId);
    render();
  });

  resetActiveRoot();
  return {
    setLocale() {
      const previousPreset = createInquiryPreset(activePresetId, renderedLocale);
      const localizedPreset = createInquiryPreset(activePresetId, i18n.locale);
      for (const [rootId, rootSession] of rootSessions) {
        if (rootId !== presetRootId) continue;
        for (const claim of rootSession.inquiry.claims) {
          const previous = claimById(previousPreset, claim.id);
          const localized = claimById(localizedPreset, claim.id);
          if (previous && localized && claim.title === previous.title) claim.title = localized.title;
          if (previous && localized && claim.description === previous.description) claim.description = localized.description;
        }
        for (const source of rootSession.inquiry.contributions) {
          const previous = contributionById(previousPreset, source.id);
          const localized = contributionById(localizedPreset, source.id);
          if (previous && localized && source.title === previous.title) source.title = localized.title;
          if (previous && localized && source.locator === previous.locator) source.locator = localized.locator;
          if (previous && localized && source.url === previous.url) {
            if (localized.url === undefined) delete source.url;
            else source.url = localized.url;
          }
        }
      }
      renderedLocale = i18n.locale;
      saturationThresholdValue.textContent = i18n.number(saturationThresholdDecibans);
      evidencePanel.setLocale();
      render();
    },
  };
}
