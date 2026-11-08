import { formatProbabilityDisplay } from '@bycelium/evidence-diagrams';

import { element } from '../html-element.ts';
import type { CredibilityAxisDomain, CredibilityAxisOptions } from './render-axis.ts';

type RulerTick = {
  readonly value: number;
  readonly label: string;
  readonly major: boolean;
};

const MAX_PROBABILITY_TICKS = 97;
const MAX_RELATIVE_DECIBAN_TICKS = 127;

export function validateCredibilityAxisDomain(domain: CredibilityAxisDomain): number {
  const span = domain.maximum - domain.minimum;
  if (!Number.isFinite(domain.minimum) || !Number.isFinite(domain.maximum)
    || !Number.isFinite(span) || span <= 0) {
    throw new RangeError('Credibility axis domain requires a finite increasing representable span.');
  }
  return span;
}

function roundedStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return rawStep;
  const exponent = 10 ** Math.floor(Math.log10(rawStep));
  if (!Number.isFinite(exponent) || exponent === 0) return rawStep;
  const fraction = rawStep / exponent;
  return (fraction <= 1.5 ? 1 : fraction <= 3.5 ? 2 : fraction <= 7.5 ? 5 : 10) * exponent;
}

function roundedUpStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return rawStep;
  const exponent = 10 ** Math.floor(Math.log10(rawStep));
  if (!Number.isFinite(exponent) || exponent === 0) return rawStep;
  const fraction = rawStep / exponent;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * exponent;
}

function boundedTickValues({
  domain,
  step,
  maximumTicks,
}: {
  readonly domain: CredibilityAxisDomain;
  readonly step: number;
  readonly maximumTicks: number;
}): number[] {
  if (!Number.isFinite(step) || step <= 0) return [];
  const first = Math.ceil(domain.minimum / step) * step;
  if (!Number.isFinite(first)) return [];
  const available = (domain.maximum - first) / step;
  const count = Number.isFinite(available)
    ? Math.max(0, Math.min(maximumTicks, Math.floor(available + 1e-10) + 1))
    : 0;
  const values = new Set<number>();
  for (let index = 0; index < count; index += 1) {
    const value = first + index * step;
    if (Number.isFinite(value) && value >= domain.minimum && value <= domain.maximum) values.add(value);
  }
  return [...values];
}

export function formatAxisProbability(
  decibans: number,
  formatPercent: CredibilityAxisOptions['formatPercent'],
): string {
  const display = formatProbabilityDisplay(decibans, 'exact');
  if (Math.abs(display.value - 50) < 0.05) {
    return formatPercent(0.5, { maximumFractionDigits: 0 });
  }
  const percentage = formatPercent(display.value / 100, { maximumFractionDigits: 12 });
  return display.operator === undefined ? percentage : `${display.operator}\u00a0${percentage}`;
}

export function probabilityTicks({
  domain,
  plotWidth,
  formatPercent,
  positions,
}: {
  readonly domain: CredibilityAxisDomain;
  readonly plotWidth: number;
  readonly formatPercent: CredibilityAxisOptions['formatPercent'];
  readonly positions?: readonly number[];
}): RulerTick[] {
  const span = validateCredibilityAxisDomain(domain);
  if (positions) {
    const values = [...positions]
      .filter(value => value >= domain.minimum && value <= domain.maximum)
      .sort((left, right) => left - right)
      .filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]!) > 1e-12);
    return values.map(value => ({
      value,
      label: formatAxisProbability(value, formatPercent),
      major: true,
    }));
  }
  const step = Math.max(5, roundedUpStep(span / (MAX_PROBABILITY_TICKS - 2)));
  const values = new Set([domain.minimum, domain.maximum]);
  if (domain.minimum <= 0 && domain.maximum >= 0) values.add(0);
  for (const value of boundedTickValues({ domain, step, maximumTicks: MAX_PROBABILITY_TICKS })) {
    values.add(value);
  }
  const tickValues = [...values]
    .filter(value => value >= domain.minimum && value <= domain.maximum)
    .sort((left, right) => left - right);
  const width = plotWidth || 600;
  const labels = new Map<number, string>();
  const placements: [number, number][] = [];
  const priority = [0, domain.minimum, domain.maximum, ...tickValues]
    .filter(value => value >= domain.minimum && value <= domain.maximum)
    .filter((value, index, all) => all.indexOf(value) === index);
  for (const value of priority) {
    const label = formatAxisProbability(value, formatPercent);
    const estimatedWidth = Math.max(22, label.length * 6.8);
    const center = (value - domain.minimum) / (domain.maximum - domain.minimum) * width;
    const left = Math.max(1, Math.min(width - estimatedWidth - 1, center - estimatedWidth / 2));
    const right = left + estimatedWidth;
    if (placements.some(([start, end]) => left <= end + 5 && right >= start - 5)) continue;
    placements.push([left, right]);
    labels.set(value, label);
  }
  return tickValues.map(value => ({ value, label: labels.get(value) ?? '', major: true }));
}

export function relativeDecibanTicks({
  domain,
  origin,
}: {
  readonly domain: CredibilityAxisDomain;
  readonly origin: number;
}): RulerTick[] {
  const span = validateCredibilityAxisDomain(domain);
  if (!Number.isFinite(origin)) throw new RangeError('Relative deciban ruler origin must be finite.');
  const rawStep = span / 25;
  const step = roundedStep(rawStep) || span;
  const labelStep = step * 5;
  const decimalPlaces = Array.from({ length: 7 }, (_, places) => places)
    .find(places => Math.abs(labelStep * 10 ** places - Math.round(labelStep * 10 ** places)) < 1e-8)
    ?? 6;
  const minimum = Math.ceil((domain.minimum - origin) / step - 1e-10);
  const maximum = Math.floor((domain.maximum - origin) / step + 1e-10);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) return [];
  const count = Math.max(0, Math.min(
    MAX_RELATIVE_DECIBAN_TICKS,
    Math.floor(maximum - minimum + 1),
  ));
  const ticksByValue = new Map<number, RulerTick>();
  for (let offsetIndex = 0; offsetIndex < count; offsetIndex += 1) {
    const index = minimum + offsetIndex;
    const offset = index * step;
    const value = origin + offset;
    if (!Number.isFinite(value) || value < domain.minimum || value > domain.maximum) continue;
    const major = index % 5 === 0;
    const formatted = Math.abs(offset) < step / 2
      ? '0'
      : `${offset > 0 ? '+' : ''}${offset.toFixed(decimalPlaces)}`;
    ticksByValue.set(value, { value, label: major ? formatted : '', major });
  }
  return [...ticksByValue.values()].sort((left, right) => left.value - right.value);
}

export function renderRuler({
  domain,
  ticks,
  relativeDecibans = false,
  axisBreak,
  anchorEndpoints = false,
  plotWidth = 600,
}: {
  readonly domain: CredibilityAxisDomain;
  readonly ticks: readonly RulerTick[];
  readonly relativeDecibans?: boolean;
  readonly axisBreak?: 'minimum' | 'maximum';
  readonly anchorEndpoints?: boolean;
  readonly plotWidth?: number;
}): HTMLDivElement {
  const ruler = element('div', {
    className: `inquiry-flow-ruler${relativeDecibans ? ' is-relative-decibans' : ''}`,
    'aria-hidden': 'true',
  });
  const labelledTickIndexes = ticks
    .map(({ label }, index) => label ? index : -1)
    .filter(index => index >= 0);
  const endpointsAreClose = anchorEndpoints && labelledTickIndexes.length === 2
    && (ticks[labelledTickIndexes[1]!]!.value - ticks[labelledTickIndexes[0]!]!.value)
      / (domain.maximum - domain.minimum) * plotWidth
      < Math.max(22, ticks[labelledTickIndexes[0]!]!.label.length * 6.8)
        + Math.max(22, ticks[labelledTickIndexes[1]!]!.label.length * 6.8) + 5;
  for (const [index, { value, label, major }] of ticks.entries()) {
    const percent = (value - domain.minimum) / (domain.maximum - domain.minimum) * 100;
    const breakPosition = axisBreak === 'minimum' ? 40 : axisBreak === 'maximum' ? 60 : undefined;
    if (breakPosition !== undefined && Math.abs(percent - breakPosition) < 4) continue;
    const labelClass = endpointsAreClose && index === labelledTickIndexes[0]
      ? ' is-outward-left'
      : endpointsAreClose && index === labelledTickIndexes[1]
        ? ' is-outward-right'
        : anchorEndpoints && index === labelledTickIndexes[0] && percent <= 12
          ? ' is-first'
          : anchorEndpoints && index === labelledTickIndexes[labelledTickIndexes.length - 1] && percent >= 88
            ? ' is-last'
            : percent === 0 ? ' is-first' : percent === 100 ? ' is-last' : '';
    const tick = element('span', {
      className: `inquiry-flow-ruler-tick${major ? ' is-major' : ''}${label ? '' : ' is-unlabelled'}`,
    }, label ? [element('span', {
      className: `inquiry-flow-ruler-label${labelClass}`,
      textContent: label,
    })] : []);
    tick.style.left = `${percent}%`;
    ruler.append(tick);
  }
  return ruler;
}
