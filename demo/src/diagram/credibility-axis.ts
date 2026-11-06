import {
  credibilityAxisColor,
  formatProbabilityDisplay,
} from '@bycelium/evidence-diagrams';
import type { GaussianBand } from '@bycelium/evidence-diagrams/propagation-math';
import { element } from '../dom.ts';
import type { PositionedBand } from './geometry.ts';

export interface CredibilityAxisMessages {
  readonly priorLowerHandle: string;
  readonly priorUpperHandle: string;
  readonly resetPrior: string;
}

export type PriorBound = 'lower' | 'upper';

export type CredibilityAxisDomain = {
  minimum: number;
  maximum: number;
};

type CredibilityAxisOptions = {
  label: string;
  band: GaussianBand;
  position: PositionedBand;
  domain: CredibilityAxisDomain;
  className: string;
  saturationThresholdDecibans: number;
  plotWidth: number;
  messages: CredibilityAxisMessages;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  editable?: boolean;
  background?: string;
  overlay?: Node;
  resetVisible?: boolean;
  onReset?: () => void;
  onEditEndpoint?: (
    bound: PriorBound,
    value: number,
    domain: CredibilityAxisDomain,
    restoreFocus: boolean,
  ) => void;
};

function formatAxisProbability(
  decibans: number,
  formatPercent: CredibilityAxisOptions['formatPercent'],
): string {
  const display = formatProbabilityDisplay(decibans, 'exact');
  if (Math.abs(display.value - 50) < .05) {
    return formatPercent(.5, { maximumFractionDigits: 0 });
  }
  const percentage = formatPercent(display.value / 100, { maximumFractionDigits: 12 });
  return `${display.operator ?? '~'}\u00a0${percentage}`;
}

function formatBandEndpoint(
  decibans: number,
  direction: 'exact' | 'lower' | 'upper',
  formatPercent: CredibilityAxisOptions['formatPercent'],
): string {
  const display = formatProbabilityDisplay(decibans, direction);
  const percentage = formatPercent(display.value / 100, { maximumFractionDigits: 12 });
  return display.operator === undefined ? percentage : `${display.operator}\u00a0${percentage}`;
}

function renderBandValue(
  band: GaussianBand,
  saturationThresholdDecibans: number,
  formatPercent: CredibilityAxisOptions['formatPercent'],
): HTMLSpanElement {
  const exact = band.lower === band.upper;
  const value = element('span', {
    className: `inquiry-flow-axis-value${exact ? ' is-exact' : ''}`,
  });
  const lower = element('span', {
    className: 'inquiry-flow-axis-endpoint is-lower',
    textContent: formatBandEndpoint(band.lower, exact ? 'exact' : 'lower', formatPercent),
  });
  lower.style.color = credibilityAxisColor(band.lower, { saturationThresholdDecibans });
  if (exact) {
    value.append(lower);
    return value;
  }
  const upper = element('span', {
    className: 'inquiry-flow-axis-endpoint is-upper',
    textContent: formatBandEndpoint(band.upper, 'upper', formatPercent),
  });
  upper.style.color = credibilityAxisColor(band.upper, { saturationThresholdDecibans });
  value.append(lower, element('span', {
    className: 'inquiry-flow-axis-separator',
    textContent: '–',
  }), upper);
  return value;
}

function placeEndpointHandle(handle: HTMLElement, bound: PriorBound, percent: number): void {
  const inward = (bound === 'lower' && percent <= 12)
    || (bound === 'upper' && percent >= 88);
  handle.classList.toggle('is-inward', inward);
  handle.style.left = `${percent}%`;
  handle.style.setProperty('--prior-anchor', inward === (bound === 'lower') ? '0%' : '100%');
}

export function renderCredibilityAxis(options: CredibilityAxisOptions): HTMLDivElement {
  const {
    label,
    band,
    position,
    domain,
    className,
    saturationThresholdDecibans,
    plotWidth,
    messages,
    formatPercent,
    editable = false,
    background,
    overlay,
    resetVisible = false,
    onReset,
    onEditEndpoint,
  } = options;
  const current = className.split(' ').includes('is-current');
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
    const visible = band.upper >= domain.minimum && band.lower <= domain.maximum;
    const exact = band.lower === band.upper;
    shape.hidden = !visible || exact;
    track.classList.toggle('is-exact', exact && visible);
    track.classList.toggle('is-clipped-minimum', position.clippedMinimum);
    track.classList.toggle('is-clipped-maximum', position.clippedMaximum);
    track.style.setProperty('--posterior-x', `${position.center}%`);
    track.style.setProperty('--posterior-minimum-color', credibilityAxisColor(
      band.lower,
      { saturationThresholdDecibans },
    ));
    track.style.setProperty('--posterior-maximum-color', credibilityAxisColor(
      band.upper,
      { saturationThresholdDecibans },
    ));
  }
  track.append(shape);
  if (overlay) track.append(overlay);
  if (position.clippedMinimum) {
    track.append(element('span', {
      className: 'inquiry-flow-clipped is-minimum',
      'aria-hidden': 'true',
      textContent: '←',
    }));
  }
  if (position.clippedMaximum) {
    track.append(element('span', {
      className: 'inquiry-flow-clipped is-maximum',
      'aria-hidden': 'true',
      textContent: '→',
    }));
  }
  if (editable) {
    track.classList.add('prior-track');
    track.removeAttribute('aria-hidden');
    const toPercent = (value: number) => Math.max(0, Math.min(100,
      (value - domain.minimum) / (domain.maximum - domain.minimum) * 100));
    const exact = band.lower === band.upper;
    track.classList.toggle('is-exact', exact);
    track.style.setProperty('--caret-x', `${toPercent(band.lower)}%`);
    track.style.setProperty('--prior-color', credibilityAxisColor(
      band.lower,
      { saturationThresholdDecibans },
    ));
    const handles = (['lower', 'upper'] as const).map((bound) => {
      const value = band[bound];
      const handle = element('button', {
        type: 'button',
        className: `prior-handle inquiry-prior-handle prior-handle-${bound === 'lower' ? 'min' : 'max'} is-${bound}`,
        dataset: { priorBound: bound },
        role: 'slider',
        'aria-label': bound === 'lower' ? messages.priorLowerHandle : messages.priorUpperHandle,
        'aria-valuemin': domain.minimum,
        'aria-valuemax': domain.maximum,
        'aria-valuenow': Math.max(domain.minimum, Math.min(domain.maximum, value)),
        'aria-valuetext': formatAxisProbability(value, formatPercent),
      });
      placeEndpointHandle(handle, bound, toPercent(value));
      handle.style.setProperty('--prior-color', credibilityAxisColor(
        value,
        { saturationThresholdDecibans },
      ));
      handle.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 5 : 1;
        const currentValue = Number(handle.getAttribute('aria-valuenow'));
        const next = event.key === 'Home' ? domain.minimum
          : event.key === 'End' ? domain.maximum
            : currentValue + (event.key === 'ArrowRight' ? step : -step);
        onEditEndpoint?.(bound, next, domain, true);
      });
      return handle;
    });
    track.append(...handles);
  }
  const ruler = element('div', { className: 'inquiry-flow-ruler', 'aria-hidden': 'true' });
  const firstTick = Math.ceil(domain.minimum / 5) * 5;
  const values = new Set([domain.minimum, domain.maximum, 0]);
  for (let value = firstTick; value <= domain.maximum; value += 5) values.add(value);
  const tickValues = [...values]
    .filter((value) => value >= domain.minimum && value <= domain.maximum)
    .sort((left, right) => left - right);
  const width = plotWidth || 600;
  const labels = new Map<number, string>();
  const placements: [number, number][] = [];
  const priority = [0, domain.minimum, domain.maximum, ...tickValues]
    .filter((value, index, all) => all.indexOf(value) === index);
  for (const value of priority) {
    const text = formatAxisProbability(value, formatPercent);
    const estimatedWidth = Math.max(22, text.length * 6.8);
    const center = (value - domain.minimum) / (domain.maximum - domain.minimum) * width;
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
        value === domain.minimum ? 'is-first' : '',
        value === domain.maximum ? 'is-last' : '',
      ].filter(Boolean).join(' '),
      textContent: text,
    });
    tick.style.left = `${(value - domain.minimum) / (domain.maximum - domain.minimum) * 100}%`;
    ruler.append(tick);
  }
  const reset = editable && resetVisible ? element('button', {
    type: 'button',
    className: 'inquiry-prior-reset',
    'aria-label': messages.resetPrior,
    title: messages.resetPrior,
    textContent: '↺',
  }) : undefined;
  if (onReset) reset?.addEventListener('click', onReset);
  return element('div', {
    className: `inquiry-flow-axis ${className}${reset ? ' has-prior-reset' : ''}`,
  }, [
    element('strong', { textContent: label }),
    renderBandValue(band, saturationThresholdDecibans, formatPercent),
    ruler,
    track,
    reset,
  ]);
}
