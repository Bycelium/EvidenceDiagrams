import { aggregateEvidence } from '@bycelium/evidence-diagrams';

/**
 * Reduces signed evidence weights to the two totals shown above the detailed
 * evidence path in both expanded and collapsed views. A positive value
 * supports the claim; a negative value opposes it.
 */
export function summarizeCollapsedEvidence(weights, displayExtent) {
  if (!Number.isFinite(displayExtent) || displayExtent <= 0) {
    throw new RangeError('The collapsed evidence display extent must be a finite positive number.');
  }
  const contributions = [...weights].map((weightDecibans) => ({ weightDecibans }));
  const aggregate = aggregateEvidence(contributions);
  let supportDecibans = 0;
  let oppositionDecibans = 0;
  for (const { weightDecibans } of contributions) {
    if (weightDecibans > 0) supportDecibans += weightDecibans;
    if (weightDecibans < 0) oppositionDecibans -= weightDecibans;
  }
  return {
    ...aggregate,
    supportDecibans,
    oppositionDecibans,
    supportPercent: Math.min(100, supportDecibans / displayExtent * 100),
    oppositionPercent: Math.min(100, oppositionDecibans / displayExtent * 100),
  };
}

function appendText(parent, className, value) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = value;
  parent.append(node);
  return node;
}

function accumulatedArrow(direction, percent) {
  const arrow = document.createElement('span');
  arrow.className = `collapsed-evidence-summary-arrow is-${direction}`;
  arrow.hidden = percent === 0;
  const body = document.createElement('span');
  body.className = 'collapsed-evidence-summary-arrow-body';
  const tip = document.createElement('span');
  tip.className = 'collapsed-evidence-summary-arrow-tip';
  arrow.append(...(direction === 'opposition' ? [tip, body] : [body, tip]));
  return arrow;
}

/**
 * Creates the compact, centered opposition/support line for the Inquiry demo.
 * Callers supply localized labels and number formatting.
 */
export function renderCollapsedEvidenceSummary({
  weights,
  displayExtent,
  formatWeight = (value) => String(value),
  oppositionLabel = 'Opposition',
  supportLabel = 'Support',
  dissonanceLabel = 'Dissonance',
  formatDissonance = (value) => String(value),
  ariaLabel,
} = {}) {
  const summary = summarizeCollapsedEvidence(weights ?? [], displayExtent);
  const root = document.createElement('span');
  root.className = 'collapsed-evidence-summary';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', ariaLabel ?? `${oppositionLabel}: ${formatWeight(summary.oppositionDecibans)}. ${dissonanceLabel}: ${formatDissonance(summary.dissonance)}. ${supportLabel}: ${formatWeight(summary.supportDecibans)}.`);
  root.style.setProperty('--collapsed-opposition', `${summary.oppositionPercent}%`);
  root.style.setProperty('--collapsed-support', `${summary.supportPercent}%`);

  const opposition = document.createElement('span');
  opposition.className = 'collapsed-evidence-summary-total is-opposition';
  appendText(opposition, 'collapsed-evidence-summary-label', oppositionLabel);
  appendText(opposition, 'collapsed-evidence-summary-value', formatWeight(summary.oppositionDecibans));
  const dissonance = document.createElement('span');
  dissonance.className = `collapsed-evidence-summary-total is-dissonance${summary.dissonance === 0 ? ' is-zero' : ''}`;
  appendText(dissonance, 'collapsed-evidence-summary-label', dissonanceLabel);
  appendText(dissonance, 'collapsed-evidence-summary-value', formatDissonance(summary.dissonance));
  const support = document.createElement('span');
  support.className = 'collapsed-evidence-summary-total is-support';
  appendText(support, 'collapsed-evidence-summary-label', supportLabel);
  appendText(support, 'collapsed-evidence-summary-value', formatWeight(summary.supportDecibans));
  const line = document.createElement('span');
  line.className = 'collapsed-evidence-summary-line';
  line.setAttribute('aria-hidden', 'true');
  line.append(
    accumulatedArrow('opposition', summary.oppositionPercent),
    accumulatedArrow('support', summary.supportPercent),
    Object.assign(document.createElement('i'), {
      className: 'collapsed-evidence-summary-center',
    }),
  );

  root.append(opposition, dissonance, line, support);
  return root;
}
