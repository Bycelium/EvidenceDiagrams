import { aggregateEvidence, type EvidenceSummary } from '@bycelium/evidence-diagrams';

import { CREDIBILITY_BAND_HEIGHT_REM } from '../credibility/render-axis.ts';

export type CollapsedEvidenceSummary = EvidenceSummary & {
  supportDecibans: number;
  oppositionDecibans: number;
  supportCount: number;
  oppositionCount: number;
  supportPercent: number;
  oppositionPercent: number;
};

export type CollapsedEvidenceMiddleMetric = {
  readonly label: string;
  readonly value: string;
  readonly zero?: boolean;
};

export type CollapsedEvidenceSummaryOptions = {
  readonly meanChanges: readonly number[];
  readonly extentDecibans: number;
  readonly formatWeight: (value: number) => string;
  readonly oppositionLabel: string;
  readonly supportLabel: string;
  readonly formatDirectionalLabel?: (label: string, count: number) => string;
  readonly headingLabel?: string;
  readonly middleMetric?: CollapsedEvidenceMiddleMetric;
  readonly ariaLabel?: string;
};

export function summarizeCollapsedEvidence({
  meanChanges,
  extentDecibans,
}: Pick<CollapsedEvidenceSummaryOptions, 'meanChanges' | 'extentDecibans'>): CollapsedEvidenceSummary {
  if (!Number.isFinite(extentDecibans) || extentDecibans <= 0) {
    throw new RangeError('The collapsed Evidence display extent must be a finite positive number.');
  }
  const contributions = [...meanChanges].map((weightDecibans) => {
    if (!Number.isFinite(weightDecibans)) throw new RangeError('Mean changes must be finite.');
    return { weightDecibans };
  });
  const aggregate = aggregateEvidence(contributions);
  let supportDecibans = 0;
  let oppositionDecibans = 0;
  let supportCount = 0;
  let oppositionCount = 0;
  for (const { weightDecibans } of contributions) {
    if (weightDecibans > 0) {
      supportDecibans += weightDecibans;
      supportCount += 1;
    }
    if (weightDecibans < 0) {
      oppositionDecibans -= weightDecibans;
      oppositionCount += 1;
    }
  }
  return {
    ...aggregate,
    supportDecibans,
    oppositionDecibans,
    supportCount,
    oppositionCount,
    supportPercent: Math.min(100, supportDecibans / extentDecibans * 100),
    oppositionPercent: Math.min(100, oppositionDecibans / extentDecibans * 100),
  };
}

function appendText(parent: HTMLElement, className: string, value: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = value;
  parent.append(node);
  return node;
}

function accumulatedArrow(
  direction: 'opposition' | 'support',
  percent: number,
): HTMLSpanElement {
  const arrow = document.createElement('span');
  arrow.className = `collapsed-evidence-summary-arrow is-${direction}`;
  arrow.hidden = percent === 0;
  return arrow;
}

/** Renders accumulated signed mean changes on a centered Supporting/Countering line. */
export function renderCollapsedEvidenceSummary({
  meanChanges,
  extentDecibans,
  formatWeight,
  oppositionLabel,
  supportLabel,
  formatDirectionalLabel = (label) => label,
  headingLabel = 'Mean change',
  middleMetric,
  ariaLabel,
}: CollapsedEvidenceSummaryOptions): HTMLSpanElement {
  const summary = summarizeCollapsedEvidence({ meanChanges, extentDecibans });
  const oppositionHeading = formatDirectionalLabel(oppositionLabel, summary.oppositionCount);
  const supportHeading = formatDirectionalLabel(supportLabel, summary.supportCount);
  const root = document.createElement('span');
  root.className = 'collapsed-evidence-summary';
  root.style.setProperty('--credibility-band-height', `${CREDIBILITY_BAND_HEIGHT_REM}rem`);
  root.setAttribute('role', 'img');
  const middleDescription = middleMetric
    ? ` ${middleMetric.label}: ${middleMetric.value}.`
    : '';
  root.setAttribute('aria-label', ariaLabel
    ?? `${headingLabel}. ${oppositionHeading}: ${formatWeight(summary.oppositionDecibans)}.${middleDescription} ${supportHeading}: ${formatWeight(summary.supportDecibans)}.`);
  root.style.setProperty('--collapsed-opposition', `${summary.oppositionPercent}%`);
  root.style.setProperty('--collapsed-support', `${summary.supportPercent}%`);

  const opposition = document.createElement('span');
  opposition.className = 'collapsed-evidence-summary-total is-opposition';
  appendText(opposition, 'collapsed-evidence-summary-label', oppositionHeading);
  appendText(opposition, 'collapsed-evidence-summary-value', formatWeight(summary.oppositionDecibans));
  const support = document.createElement('span');
  support.className = 'collapsed-evidence-summary-total is-support';
  appendText(support, 'collapsed-evidence-summary-label', supportHeading);
  appendText(support, 'collapsed-evidence-summary-value', formatWeight(summary.supportDecibans));
  const middle = middleMetric ? document.createElement('span') : undefined;
  if (middle && middleMetric) {
    middle.className = `collapsed-evidence-summary-total is-dissonance${middleMetric.zero ? ' is-zero' : ''}`;
    appendText(middle, 'collapsed-evidence-summary-label', middleMetric.label);
    appendText(middle, 'collapsed-evidence-summary-value', middleMetric.value);
  }
  const line = document.createElement('span');
  line.className = 'collapsed-evidence-summary-line';
  line.setAttribute('aria-hidden', 'true');
  line.append(
    accumulatedArrow('opposition', summary.oppositionPercent),
    accumulatedArrow('support', summary.supportPercent),
    Object.assign(document.createElement('i'), { className: 'collapsed-evidence-summary-center' }),
  );

  root.append(opposition);
  if (middle) root.append(middle);
  root.append(line, support);
  return root;
}
