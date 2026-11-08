import {
  credibilityAxisColor,
  formatProbabilityDisplay,
} from '@bycelium/evidence-diagrams';
import type { GaussianBand } from '@bycelium/evidence-diagrams/propagation-math';

import { element } from '../html-element.ts';
import { renderEndpointHandles } from './endpoint-editing.ts';
import {
  probabilityTicks,
  relativeDecibanTicks,
  renderRuler,
  validateCredibilityAxisDomain,
} from './ruler.ts';

export interface CredibilityAxisMessages {
  readonly priorLowerHandle: string;
  readonly priorUpperHandle: string;
  readonly resetPrior: string;
}

export const CREDIBILITY_BAND_HEIGHT_REM = 0.625;

export type PriorBound = 'lower' | 'upper';

export type CredibilityAxisDomain = {
  readonly minimum: number;
  readonly maximum: number;
};

export type PositionedBand = {
  readonly left: number;
  readonly width: number;
  readonly center: number;
  readonly clippedMinimum: boolean;
  readonly clippedMaximum: boolean;
};

export type ProbabilityRuler = {
  readonly kind: 'probability';
  readonly positions?: readonly number[];
};

export type RulerMode = ProbabilityRuler | {
  readonly kind: 'relative-decibans';
  readonly origin: number;
};

export type CredibilityAxisEndpointEdit = {
  readonly bound: PriorBound;
  readonly value: number;
  readonly domain: CredibilityAxisDomain;
  readonly restoreFocus: boolean;
};

export type CredibilityAxisOptions = {
  readonly label?: string;
  readonly band: GaussianBand;
  readonly position: PositionedBand;
  readonly domain: CredibilityAxisDomain;
  readonly className?: string;
  readonly saturationThresholdDecibans: number;
  readonly plotWidth: number;
  readonly messages?: CredibilityAxisMessages;
  readonly formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
  readonly editable?: boolean;
  readonly background?: string;
  readonly overlay?: Node;
  readonly ruler?: RulerMode;
  readonly rulerPlacement?: 'above' | 'below';
  readonly secondaryRuler?: RulerMode;
  readonly showValue?: boolean;
  readonly resetVisible?: boolean;
  readonly onReset?: () => void;
  readonly onEditEndpoint?: (input: CredibilityAxisEndpointEdit) => void;
};

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

export function renderCredibilityAxis(options: CredibilityAxisOptions): HTMLDivElement {
  const {
    label,
    band,
    position,
    domain,
    className = '',
    saturationThresholdDecibans,
    plotWidth,
    messages,
    formatPercent,
    editable = false,
    background,
    overlay,
    ruler: rulerMode = { kind: 'probability' },
    rulerPlacement = 'above',
    secondaryRuler: secondaryRulerMode,
    showValue = true,
    resetVisible = false,
    onReset,
    onEditEndpoint,
  } = options;
  validateCredibilityAxisDomain(domain);
  if (editable && !messages) {
    throw new TypeError('Editable credibility axes require handle and reset messages.');
  }
  const track = element('div', {
    className: 'inquiry-flow-axis-track posterior-track',
    'aria-hidden': 'true',
  });
  const shape = element('span', {
    className: `inquiry-flow-axis-band posterior-band ${className}`,
  });
  shape.style.left = `${position.left}%`;
  shape.style.width = `${Math.max(position.width, 0.3)}%`;
  if (background) shape.style.background = background;
  const visible = band.upper >= domain.minimum && band.lower <= domain.maximum;
  const axisBreak = band.upper < domain.minimum ? 'minimum'
    : band.lower > domain.maximum ? 'maximum'
      : undefined;
  const exact = band.lower === band.upper;
  shape.hidden = !visible || exact;
  track.classList.toggle('is-exact', exact && visible);
  track.style.setProperty('--posterior-x', `${position.center}%`);
  track.style.setProperty('--posterior-minimum-color', credibilityAxisColor(
    band.lower,
    { saturationThresholdDecibans },
  ));
  track.style.setProperty('--posterior-maximum-color', credibilityAxisColor(
    band.upper,
    { saturationThresholdDecibans },
  ));
  track.append(shape);
  if (overlay) track.append(overlay);
  if (axisBreak) {
    track.append(element('span', {
      className: `inquiry-flow-axis-break is-${axisBreak}`,
      'aria-hidden': 'true',
      textContent: '//',
    }));
  }
  if (editable && messages) {
    track.classList.add('prior-track');
    track.removeAttribute('aria-hidden');
    renderEndpointHandles({
      track,
      band,
      domain,
      messages,
      saturationThresholdDecibans,
      formatPercent,
      onEditEndpoint,
    });
  }
  const ticks = rulerMode.kind === 'relative-decibans'
    ? relativeDecibanTicks({ domain, origin: rulerMode.origin })
    : probabilityTicks({ domain, plotWidth, formatPercent, positions: rulerMode.positions });
  const ruler = renderRuler({ domain, ticks, relativeDecibans: rulerMode.kind === 'relative-decibans', axisBreak });
  const secondaryTicks = secondaryRulerMode?.kind === 'relative-decibans'
    ? relativeDecibanTicks({ domain, origin: secondaryRulerMode.origin })
    : secondaryRulerMode ? probabilityTicks({
      domain,
      plotWidth,
      formatPercent,
      positions: secondaryRulerMode.positions,
    }) : undefined;
  const secondaryRuler = secondaryTicks && secondaryRulerMode ? renderRuler({
    domain,
    ticks: secondaryTicks,
    relativeDecibans: secondaryRulerMode.kind === 'relative-decibans',
    axisBreak,
    anchorEndpoints: secondaryRulerMode.kind === 'probability' && secondaryRulerMode.positions !== undefined,
    plotWidth,
  }) : undefined;
  secondaryRuler?.classList.add('is-secondary');
  const reset = editable && resetVisible && messages ? element('button', {
    type: 'button',
    className: 'inquiry-prior-reset',
    'aria-label': messages.resetPrior,
    title: messages.resetPrior,
    textContent: '↺',
  }) : undefined;
  if (onReset) reset?.addEventListener('click', onReset);
  const primaryVisuals = rulerPlacement === 'below' ? [track, ruler] : [ruler, track];
  const axis = element('div', {
    className: `inquiry-flow-axis ${className}${reset ? ' has-prior-reset' : ''}`,
  }, [
    label ? element('strong', { textContent: label }) : undefined,
    showValue ? renderBandValue(band, saturationThresholdDecibans, formatPercent) : undefined,
    ...primaryVisuals,
    secondaryRuler,
    reset,
  ]);
  axis.style.setProperty('--credibility-band-height', `${CREDIBILITY_BAND_HEIGHT_REM}rem`);
  const refreshProbabilityRuler = (
    target: HTMLDivElement,
    positions: readonly number[] | undefined,
    secondary = false,
  ) => {
    if (!axis.isConnected) return;
    const mountedWidth = target.getBoundingClientRect().width;
    if (mountedWidth <= 0 || Math.abs(mountedWidth - plotWidth) < 1) return;
    const refreshed = renderRuler({
      domain,
      ticks: probabilityTicks({ domain, plotWidth: mountedWidth, formatPercent, positions }),
      axisBreak,
      anchorEndpoints: positions !== undefined,
      plotWidth: mountedWidth,
    });
    if (secondary) refreshed.classList.add('is-secondary');
    target.replaceWith(refreshed);
  };
  if (rulerMode.kind === 'probability' || secondaryRulerMode?.kind === 'probability') {
    globalThis.requestAnimationFrame?.(() => {
      if (rulerMode.kind === 'probability') refreshProbabilityRuler(ruler, rulerMode.positions);
      if (secondaryRulerMode?.kind === 'probability' && secondaryRuler) {
        refreshProbabilityRuler(secondaryRuler, secondaryRulerMode.positions, true);
      }
    });
  }
  return axis;
}
