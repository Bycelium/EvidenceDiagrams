import {
  DEFAULT_COLOR_OPTIONS,
  credibilityAxisColor,
  formatProbabilityDisplay,
} from '@bycelium/evidence-diagrams';
import { gaussianToBand } from '@bycelium/evidence-diagrams/propagation-math';
import { element, safeHttpUrl } from '../dom.js';
import { formatJeffreysStrength } from '../presentation.js';
import { claimEvidenceSummary, renderClaimCredibility } from './claim-card.js';
import { createConditionalStrengthControl } from './conditional-strength-control.js';
import { renderEvidenceImpactPreview } from './evidence-impact-preview.js';

function claimById(inquiry, id) {
  return inquiry.claims.find((claim) => claim.id === id);
}

function contributionById(inquiry, id) {
  return inquiry.contributions.find((contribution) => contribution.id === id);
}

function evidenceById(inquiry, id) {
  return inquiry.evidence.find((item) => item.id === id);
}

export function hasZeroAssignedImpact(item) {
  return item.impact.deltaMean === 0 && item.impact.deltaStandardDeviation === 0;
}

function evaluationForClaim(evaluation, id) {
  return evaluation.claims[id];
}

function stepForEvidence(evaluation, item) {
  return evaluationForClaim(evaluation, item.targetClaimId)?.steps
    .find((step) => step.evidenceId === item.id);
}

function narrativeHeadingKey(premiseProbability) {
  return premiseProbability < .5
    ? 'inquiry.butGivenClaimCredibility'
    : 'inquiry.andGivenClaimCredibility';
}

function formattedPremiseProbability(i18n, premiseProbability) {
  return `≈ ${i18n.percent(premiseProbability)}`;
}

function metricValue(text, color, dataset = {}) {
  const value = element('strong', {
    className: 'inquiry-evidence-panel-metric-value',
    dataset,
    textContent: text,
  });
  value.style.setProperty('--metric-color', color);
  return value;
}

function localizedNodeParts(i18n, key, values, nodes) {
  const tokens = Object.fromEntries(
    Object.keys(nodes).map((field) => [field, `__INQUIRY_${field.toUpperCase()}__`]),
  );
  const sentence = i18n.t(key, { ...values, ...tokens });
  const positions = Object.entries(tokens)
    .map(([field, token]) => ({ field, token, index: sentence.indexOf(token) }))
    .sort((first, second) => first.index - second.index);
  if (positions.some(({ index }) => index < 0)) return [document.createTextNode(sentence)];
  const parts = [];
  let cursor = 0;
  for (const { field, token, index } of positions) {
    parts.push(document.createTextNode(sentence.slice(cursor, index)), nodes[field]);
    cursor = index + token.length;
  }
  parts.push(document.createTextNode(sentence.slice(cursor)));
  return parts;
}

function updateCurrentStrength(node, i18n, before, after) {
  const meanShift = after.mean - before.mean;
  if (Math.abs(meanShift) > 1e-12) {
    node.textContent = i18n.t(
      meanShift > 0 ? 'inquiry.strengthSupport' : 'inquiry.strengthOpposition',
      { strength: formatJeffreysStrength(i18n, meanShift) },
    );
    return;
  }
  const widthShift = after.standardDeviation - before.standardDeviation;
  node.textContent = i18n.t(
    Math.abs(widthShift) > 1e-12 ? 'inquiry.strengthWidth' : 'inquiry.strengthNone',
  );
}

function formatEndpointProbability(i18n, decibans, direction = 'exact') {
  const display = formatProbabilityDisplay(decibans, direction);
  const probability = i18n.percent(display.value / 100, { maximumFractionDigits: 12 });
  return display.operator ? `${display.operator}\u00a0${probability}` : probability;
}

function credibilityInterval(i18n, evaluated, color, dataset = {}) {
  const band = gaussianToBand(evaluated.posterior);
  const lowerToken = '__INQUIRY_LOWER_CREDIBILITY__';
  const upperToken = '__INQUIRY_UPPER_CREDIBILITY__';
  const sentence = i18n.t('inquiry.credibilityInterval', {
    lower: lowerToken,
    upper: upperToken,
  });
  const lowerIndex = sentence.indexOf(lowerToken);
  const upperIndex = sentence.indexOf(upperToken);
  if (lowerIndex < 0 || upperIndex < lowerIndex) {
    return element('span', { dataset }, [
      metricValue(formatEndpointProbability(i18n, band.lower, 'lower'), color),
      document.createTextNode(' – '),
      metricValue(formatEndpointProbability(i18n, band.upper, 'upper'), color),
    ]);
  }
  return element('span', { dataset }, [
    document.createTextNode(sentence.slice(0, lowerIndex)),
    metricValue(formatEndpointProbability(i18n, band.lower, 'lower'), color),
    document.createTextNode(sentence.slice(
      lowerIndex + lowerToken.length, upperIndex,
    )),
    metricValue(formatEndpointProbability(i18n, band.upper, 'upper'), color),
    document.createTextNode(sentence.slice(upperIndex + upperToken.length)),
  ]);
}

function conditionalStrengthView(
  i18n, item, defaultValue, saturationThresholdDecibans, forceExtentDecibans,
  target, targetContent, onInput,
) {
  const primarySection = element('section', {
    className: 'inquiry-evidence-panel-conditional',
    'aria-labelledby': 'inquiry-evidence-panel-conditional-title',
  });
  const control = createConditionalStrengthControl({
    i18n,
    targetTitle: target.title,
    value: item.impact.deltaMean,
    defaultValue,
    saturationThresholdDecibans,
    forceExtentDecibans,
    panelNarrative: true,
    panelTargetContent: targetContent,
    headingId: 'inquiry-evidence-panel-conditional-title',
    onInput,
  });
  primarySection.append(control.element);
  return { primarySection, targetSection: control.targetSection };
}

function targetClaimCard(i18n, target, evaluated, saturationThresholdDecibans) {
  const rendered = renderClaimCredibility(
    i18n,
    evaluated,
    claimEvidenceSummary(evaluated),
    saturationThresholdDecibans,
    true,
  );
  const card = element('button', {
    type: 'button',
    className: 'inquiry-evidence-panel-target-card inquiry-claim-card',
    dataset: { action: 'investigate-target', claimId: target.id },
    'aria-label': i18n.t('inquiry.investigateClaimNamed', { claim: target.title }),
  }, [
    element('span', {
      className: 'inquiry-evidence-panel-target-title',
      textContent: target.title,
    }),
    rendered.credibility,
  ]);
  card.style.setProperty('--result-color', rendered.palette.color);
  return card;
}

function sourceReference(source) {
  const url = safeHttpUrl(source.url);
  return url
    ? element('a', { href: url, target: '_blank', rel: 'noreferrer', textContent: source.title })
    : element('span', { textContent: source.title });
}

function sourceBlock(i18n, source) {
  return element('section', {
    className: 'inquiry-evidence-panel-source',
    'aria-labelledby': 'inquiry-evidence-panel-source-title',
  }, [
    element('h3', {
      id: 'inquiry-evidence-panel-source-title',
      className: 'inquiry-evidence-panel-source-sentence',
      textContent: i18n.t('inquiry.basedOn'),
    }),
    element('ul', { className: 'inquiry-evidence-panel-source-list' }, [
      element('li', {}, [sourceReference(source)]),
    ]),
  ]);
}

/** Creates the evidence detail surface used by clickable Inquiry diagram steps. */
export function createInquiryEvidencePanel(i18n, callbacks = {}) {
  const dialog = element('dialog', {
    id: 'inquiry-evidence-panel',
    className: 'inquiry-evidence-panel',
    'aria-labelledby': 'inquiry-evidence-panel-title',
  });
  document.body.append(dialog);

  let current;
  let currentForceExtentDecibans;
  let backdropPointerDown = false;

  function requireSelection(state) {
    const item = evidenceById(state.inquiry, state.evidenceId);
    if (!item) throw new Error(`Missing evidence for panel: ${state.evidenceId}`);
    const premise = claimById(state.inquiry, item.premiseClaimId);
    if (!premise) throw new Error(`Missing premise for panel evidence: ${state.evidenceId}`);
    const source = contributionById(state.inquiry, item.contributionId);
    if (!source) throw new Error(`Missing source for panel evidence: ${state.evidenceId}`);
    const step = stepForEvidence(state.evaluation, item);
    if (!step) throw new Error(`Missing evaluated step for panel evidence: ${state.evidenceId}`);
    const premiseEvaluation = evaluationForClaim(state.evaluation, premise.id);
    if (!premiseEvaluation) throw new Error(`Missing premise evaluation for panel evidence: ${state.evidenceId}`);
    const target = claimById(state.inquiry, item.targetClaimId);
    if (!target) throw new Error(`Missing target claim for panel evidence: ${state.evidenceId}`);
    const targetEvaluation = evaluationForClaim(state.evaluation, target.id);
    if (!targetEvaluation) throw new Error(`Missing target evaluation for panel evidence: ${state.evidenceId}`);
    return { item, premise, source, step, premiseEvaluation, target, targetEvaluation };
  }

  function render() {
    if (!current) return;
    const {
      item, premise, source, step, premiseEvaluation, target, targetEvaluation,
    } = requireSelection(current);
    const saturationThresholdDecibans = current.saturationThresholdDecibans
      ?? DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans;
    const conditionalStrengthDefault = current.conditionalStrengthDefault
      ?? item.impact.deltaMean;
    const forceExtentDecibans = Math.max(
      2 * saturationThresholdDecibans,
      Math.abs(item.impact.deltaMean),
      Math.abs(conditionalStrengthDefault),
    );
    currentForceExtentDecibans = forceExtentDecibans;
    const premiseSummary = claimEvidenceSummary(premiseEvaluation);
    const premiseCredibility = renderClaimCredibility(
      i18n,
      premiseEvaluation,
      premiseSummary,
      saturationThresholdDecibans,
    );
    const strength = element('span', {
      className: 'inquiry-evidence-panel-strength',
      dataset: { effectMetric: 'current' },
    });
    updateCurrentStrength(strength, i18n, step.before, step.after);
    const impactPreview = renderEvidenceImpactPreview({
      i18n,
      posterior: targetEvaluation.posterior,
      meanShift: step.after.mean - step.before.mean,
      saturationThresholdDecibans,
      forceExtentDecibans,
      label: i18n.t('inquiry.selectedEvidenceImpact', { target: target.title }),
    });
    const title = element('h2', {
      id: 'inquiry-evidence-panel-title',
      className: 'visually-hidden',
      textContent: i18n.t('inquiry.evidenceDetails'),
    });
    const closeButton = element('button', {
      type: 'button',
      className: 'inquiry-evidence-panel-close',
      dataset: { action: 'close' },
      'aria-label': i18n.t('inquiry.closeEvidenceDetails'),
      textContent: '×',
    });
    const premiseBlock = element('section', {
      className: 'inquiry-evidence-panel-premise',
      'aria-labelledby': 'inquiry-evidence-panel-premise-title',
    }, [
      element('h3', {
        id: 'inquiry-evidence-panel-premise-title',
        textContent: i18n.t('inquiry.ifClaimIsTrue'),
      }),
      element('p', {
        className: 'inquiry-evidence-panel-premise-title',
        textContent: premise.title,
      }),
    ]);
    const premiseCredibilityValue = credibilityInterval(
      i18n,
      premiseEvaluation,
      premiseCredibility.palette.color,
    );
    const estimatedProbability = metricValue(
      formattedPremiseProbability(i18n, step.premiseProbability),
      premiseCredibility.palette.color,
    );
    const premiseTitleValue = element('span', {
      className: 'inquiry-evidence-panel-premise-link-title',
      textContent: premise.title,
    });
    const premiseWeightingSentence = localizedNodeParts(
      i18n,
      'inquiry.premiseWeightingSentence',
      {},
      {
        claim: premiseTitleValue,
        interval: premiseCredibilityValue,
        weight: estimatedProbability,
      },
    );
    const premiseLink = element('button', {
      type: 'button',
      className: 'inquiry-evidence-panel-premise-link',
      dataset: { action: 'investigate-premise', claimId: premise.id },
      'aria-label': [
        i18n.t('inquiry.investigateClaimNamed', { claim: premise.title }),
        premiseWeightingSentence.map((part) => part.textContent).join(''),
      ].join('. '),
    }, [
      element('span', { className: 'inquiry-evidence-panel-premise-link-content' }, [
        element('span', {
          className: 'inquiry-evidence-panel-premise-link-sentence',
        }, premiseWeightingSentence),
      ]),
      element('span', {
        className: 'inquiry-evidence-panel-premise-link-arrow',
        'aria-hidden': 'true',
        textContent: '↗',
      }),
    ]);
    premiseLink.style.setProperty('--result-color', premiseCredibility.palette.color);
    const effectBlock = element('section', {
      className: 'inquiry-evidence-panel-effect',
      'aria-labelledby': 'inquiry-evidence-panel-effect-title',
    }, [
      element('h3', {
        id: 'inquiry-evidence-panel-effect-title',
        dataset: { narrativeHeading: '' },
        textContent: i18n.t(narrativeHeadingKey(step.premiseProbability)),
      }),
      premiseLink,
    ]);
    const conclusionBlock = element('section', {
      className: 'inquiry-evidence-panel-conclusion',
      'aria-labelledby': 'inquiry-evidence-panel-conclusion-title',
    }, [
      element('h3', {
        id: 'inquiry-evidence-panel-conclusion-title',
        textContent: i18n.t('inquiry.currentImpactIntro'),
      }),
      element('div', { className: 'inquiry-evidence-panel-conclusion-content' }, [
        element('p', { className: 'inquiry-evidence-panel-current-conclusion' }, [strength]),
        impactPreview,
        hasZeroAssignedImpact(item) ? element('p', {
          className: 'inquiry-evidence-panel-no-additional-effect',
          textContent: i18n.t('inquiry.noAdditionalEffectShort'),
        }) : undefined,
      ]),
    ]);
    const conditional = conditionalStrengthView(
      i18n, item, conditionalStrengthDefault,
      saturationThresholdDecibans, forceExtentDecibans,
      target,
      targetClaimCard(i18n, target, targetEvaluation, saturationThresholdDecibans),
      changeConditionalStrength,
    );
    const body = element('div', { className: 'inquiry-evidence-panel-body' }, [
      premiseBlock,
      sourceBlock(i18n, source),
      conditional.primarySection,
      conditional.targetSection,
      effectBlock,
      conclusionBlock,
    ]);
    const footer = element('footer', { className: 'inquiry-evidence-panel-actions' }, [
      element('button', {
        type: 'button',
        dataset: { action: 'edit-evidence', evidenceId: item.id },
        textContent: i18n.t('inquiry.editDetails'),
      }),
      element('button', {
        type: 'button',
        className: 'is-danger',
        dataset: { action: 'remove-evidence', evidenceId: item.id },
        textContent: i18n.t('inquiry.removeEvidence'),
      }),
    ]);
    dialog.replaceChildren(title, closeButton, body, footer);
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function acceptPanelState(next) {
    if (!next) return false;
    current = { ...current, ...next, evidenceId: current.evidenceId };
    return true;
  }

  function updateLiveEffect() {
    const { step, target, targetEvaluation } = requireSelection(current);
    const threshold = current.saturationThresholdDecibans
      ?? DEFAULT_COLOR_OPTIONS.saturationThresholdDecibans;
    const metric = dialog.querySelector('[data-effect-metric="current"]');
    updateCurrentStrength(metric, i18n, step.before, step.after);
    const impactPreview = dialog.querySelector('.inquiry-evidence-impact-preview');
    impactPreview?.replaceWith(renderEvidenceImpactPreview({
      i18n,
      posterior: targetEvaluation.posterior,
      meanShift: step.after.mean - step.before.mean,
      saturationThresholdDecibans: threshold,
      forceExtentDecibans: currentForceExtentDecibans,
      label: i18n.t('inquiry.selectedEvidenceImpact', { target: target.title }),
    }));
    dialog.querySelector('.inquiry-evidence-panel-target-card')?.replaceWith(
      targetClaimCard(i18n, target, targetEvaluation, threshold),
    );
  }

  function changeConditionalStrength(deltaMean) {
    const { item } = requireSelection(current);
    if (deltaMean === item.impact.deltaMean) return false;
    const next = callbacks.onConditionalStrengthChange?.(current.evidenceId, deltaMean);
    if (!acceptPanelState(next)) return false;
    updateLiveEffect();
    return true;
  }

  dialog.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, evidenceId, claimId } = button.dataset;
    if (action === 'close') close();
    else if (action === 'investigate-premise' || action === 'investigate-target') {
      close();
      callbacks.onInvestigate?.(claimId);
    } else if (action === 'edit-evidence') {
      close();
      callbacks.onEditEvidence?.(evidenceId);
    } else if (action === 'remove-evidence') {
      close();
      callbacks.onRemoveEvidence?.(evidenceId);
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  });
  document.addEventListener('pointerdown', (event) => {
    backdropPointerDown = dialog.open && !dialog.contains(event.target);
  });
  document.addEventListener('click', (event) => {
    if (!dialog.open || !backdropPointerDown) return;
    backdropPointerDown = false;
    // Selecting another plotted evidence replaces this drawer's contents.
    if (event.target.closest('.inquiry-flow-evidence[data-evidence-id]')) return;
    if (!dialog.contains(event.target)) close();
  });
  return {
    element: dialog,
    open(state) {
      requireSelection(state);
      current = state;
      render();
      if (!dialog.open) dialog.show();
    },
    close,
    setSaturationThreshold(saturationThresholdDecibans) {
      if (!current) return;
      current = { ...current, saturationThresholdDecibans };
      render();
    },
    setLocale() { render(); },
  };
}
