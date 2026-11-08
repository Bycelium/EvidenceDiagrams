import { credibilityAxisColor } from '@bycelium/evidence-diagrams';
import type { GaussianBand } from '@bycelium/evidence-diagrams/propagation-math';

import { element } from '../html-element.ts';
import { formatAxisProbability } from './ruler.ts';
import type {
  CredibilityAxisDomain,
  CredibilityAxisMessages,
  CredibilityAxisOptions,
  PriorBound,
} from './render-axis.ts';

function placeEndpointHandle(handle: HTMLElement, bound: PriorBound, percent: number): void {
  const inward = (bound === 'lower' && percent <= 12)
    || (bound === 'upper' && percent >= 88);
  handle.classList.toggle('is-inward', inward);
  handle.style.left = `${percent}%`;
  handle.style.setProperty('--prior-anchor', inward === (bound === 'lower') ? '0%' : '100%');
}

export function renderEndpointHandles({
  track,
  band,
  domain,
  messages,
  saturationThresholdDecibans,
  formatPercent,
  onEditEndpoint,
}: {
  readonly track: HTMLDivElement;
  readonly band: GaussianBand;
  readonly domain: CredibilityAxisDomain;
  readonly messages: CredibilityAxisMessages;
  readonly saturationThresholdDecibans: number;
  readonly formatPercent: CredibilityAxisOptions['formatPercent'];
  readonly onEditEndpoint: CredibilityAxisOptions['onEditEndpoint'];
}): void {
  const toPercent = (value: number) => Math.max(0, Math.min(100,
    (value - domain.minimum) / (domain.maximum - domain.minimum) * 100));
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
      onEditEndpoint?.({ bound, value: next, domain, restoreFocus: true });
    });
    return handle;
  });
  track.append(...handles);
}
