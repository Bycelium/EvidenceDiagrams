import {
  credibilityAxisColor,
  credibilityBandBackground,
  evidenceStrengthColor,
  formatProbabilityDisplay,
} from '@bycelium/evidence-diagrams';
import { gaussianToBand, type Gaussian, type GaussianBand } from '@bycelium/evidence-diagrams/propagation-math';
import { element } from '../dom.ts';
import type { I18n } from '../i18n/index.ts';
import { renderForceArrow } from './force-arrow.ts';
import { renderForceScaleRuler } from './force-scale.ts';
import type { ConditionalMessages } from './conditional-strength-control.ts';

type PreviewGeometry = {
  minimum: number;
  maximum: number;
  posteriorBand: GaussianBand;
  position: { left: number; width: number; center: number; clippedMinimum: boolean; clippedMaximum: boolean };
};

type EvidenceImpactPreviewOptions = {
  i18n: Pick<I18n, 'number' | 'percent'>;
  readonly scaleMessages: ConditionalMessages;
  readonly formatMessage: I18n['formatMessage'];
  posterior: Gaussian;
  meanShift: number;
  saturationThresholdDecibans: number;
  forceExtentDecibans?: number;
  label?: string;
};

function axisLabel(i18n: Pick<I18n, 'percent'>, value: number): string {
  const display = formatProbabilityDisplay(value, 'exact');
  return `${display.operator ?? '~'}\u00a0${i18n.percent(display.value / 100, { maximumFractionDigits: 12 })}`;
}

export function buildEvidenceImpactPreviewGeometry(
  posterior: Gaussian,
  meanShift: number,
  saturationThresholdDecibans: number,
  forceExtentDecibans?: number,
): PreviewGeometry {
  const posteriorBand = gaussianToBand(posterior);
  const reference = { ...posterior, mean: posterior.mean - meanShift };
  const referenceBand = gaussianToBand(reference);
  const start = meanShift > 0 ? referenceBand.lower
    : meanShift < 0 ? referenceBand.upper
      : posterior.mean;
  const halfSpan = forceExtentDecibans
    ?? Math.max(2 * saturationThresholdDecibans, Math.abs(meanShift) / .8);
  const minimum = start - halfSpan;
  const maximum = start + halfSpan;
  const position = ({ lower, upper }: GaussianBand) => ({
    left: (Math.max(minimum, Math.min(maximum, lower)) - minimum) / (maximum - minimum) * 100,
    width: Math.max(0, (Math.min(maximum, upper) - Math.max(minimum, lower)) / (maximum - minimum) * 100),
    center: (Math.max(minimum, Math.min(maximum, (lower + upper) / 2)) - minimum) / (maximum - minimum) * 100,
    clippedMinimum: lower < minimum,
    clippedMaximum: upper > maximum,
  });
  return {
    minimum,
    maximum,
    posteriorBand,
    position: position(posteriorBand),
  };
}

/**
 * Draws one selected evidence item's current mean shift at the target's final posterior.
 * The local scale shares the conditional control's deciban extent and centers the arrow tail.
 */
export function renderEvidenceImpactPreview({
  i18n,
  scaleMessages,
  formatMessage,
  posterior,
  meanShift,
  saturationThresholdDecibans,
  forceExtentDecibans,
  label = 'Selected evidence impact',
}: EvidenceImpactPreviewOptions): HTMLDivElement {
  const geometry = buildEvidenceImpactPreviewGeometry(
    posterior, meanShift, saturationThresholdDecibans, forceExtentDecibans,
  );
  const { posteriorBand } = geometry;
  const position = geometry.position;
  const track = element('div', {
    className: 'inquiry-flow-axis-track posterior-track',
    'aria-hidden': 'true',
  });
  const band = element('span', { className: 'inquiry-flow-axis-band posterior-band' });
  const visible = posteriorBand.upper >= geometry.minimum && posteriorBand.lower <= geometry.maximum;
  const exact = posteriorBand.lower === posteriorBand.upper;
  band.hidden = !visible || exact;
  band.style.left = `${position.left}%`;
  band.style.width = `${Math.max(position.width, .3)}%`;
  band.style.background = credibilityBandBackground(posteriorBand, {
    minimum: geometry.minimum,
    maximum: geometry.maximum,
    saturationThresholdDecibans,
  });
  track.classList.toggle('is-exact', exact && visible);
  track.classList.toggle('is-clipped-minimum', position.clippedMinimum);
  track.classList.toggle('is-clipped-maximum', position.clippedMaximum);
  track.style.setProperty('--posterior-x', `${position.center}%`);
  track.style.setProperty('--posterior-minimum-color', credibilityAxisColor(posteriorBand.lower, { saturationThresholdDecibans }));
  track.style.setProperty('--posterior-maximum-color', credibilityAxisColor(posteriorBand.upper, { saturationThresholdDecibans }));
  const arrowLayer = element('span', {
    className: 'inquiry-force-arrow-layer',
    'aria-hidden': 'true',
  }, [renderForceArrow(
    meanShift,
    forceExtentDecibans ?? (geometry.maximum - geometry.minimum) / 2,
    evidenceStrengthColor({
      netWeightDecibans: meanShift,
      absoluteWeightDecibans: Math.abs(meanShift),
      dissonance: 0,
    }, { saturationThresholdDecibans }),
  )]);
  track.append(band, arrowLayer);
  const ruler = element('div', { className: 'inquiry-flow-ruler', 'aria-hidden': 'true' });
  for (const [index, value] of [geometry.minimum, (geometry.minimum + geometry.maximum) / 2, geometry.maximum].entries()) {
    const tick = element('span', {
      className: index === 0 ? 'is-first' : index === 2 ? 'is-last' : '',
      textContent: axisLabel(i18n, value),
    });
    tick.style.left = `${index * 50}%`;
    ruler.append(tick);
  }
  return element('div', {
    className: 'inquiry-evidence-impact-preview',
    role: 'img',
    'aria-label': label,
  }, [
    ruler,
    track,
    renderForceScaleRuler(
      scaleMessages,
      i18n,
      formatMessage,
      forceExtentDecibans ?? (geometry.maximum - geometry.minimum) / 2,
    ),
  ]);
}
