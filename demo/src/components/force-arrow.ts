import { element } from '../html-element.ts';

export function updateForceArrow(
  arrow: HTMLElement,
  value: number,
  extentDecibans: number,
  color?: string,
): void {
  const visibleValue = Math.max(-extentDecibans, Math.min(extentDecibans, value));
  arrow.hidden = Math.abs(visibleValue) <= 1e-12;
  arrow.classList.toggle('is-opposition', visibleValue < 0);
  arrow.classList.toggle('is-support', visibleValue > 0);
  arrow.style.setProperty(
    '--force-arrow-size', `${Math.abs(visibleValue) / extentDecibans * 50}%`,
  );
  if (color) arrow.style.setProperty('--force-arrow-color', color);
}

export function renderForceArrow(value: number, extentDecibans: number, color?: string): HTMLSpanElement {
  const arrow = element('span', {
    className: 'inquiry-force-arrow',
    'aria-hidden': 'true',
  }, [
    element('span', { className: 'inquiry-force-arrow-body' }),
    element('span', { className: 'inquiry-force-arrow-tip' }),
  ]);
  updateForceArrow(arrow, value, extentDecibans, color);
  return arrow;
}
