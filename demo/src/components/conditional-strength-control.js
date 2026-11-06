import {
  evidenceStrengthColor,
  jeffreysBand,
} from '@bycelium/evidence-diagrams';
import { element } from '../dom.js';
import { signedNumber } from '../presentation.js';
import { renderForceArrow, updateForceArrow } from './force-arrow.js';
import { renderForceScaleRuler } from './force-scale.js';

function strengthAmount(i18n, value) {
  return `${signedNumber(i18n, value)}\u00a0dBan`;
}

function conditionalBandLabel(i18n, value) {
  const band = jeffreysBand({ weightDecibans: value }).replace(' against', '');
  return i18n.t(`inquiry.conditionalBand.${band}`);
}

function updateMetric(metric, i18n, value, saturationThresholdDecibans) {
  if (Math.abs(value) <= 1e-12) {
    metric.textContent = i18n.t('inquiry.directionalStrengthNone');
    return;
  }
  const amount = strengthAmount(i18n, value);
  const token = '__INQUIRY_AMOUNT__';
  const formatted = i18n.t('inquiry.conditionalMagnitude', {
    strength: conditionalBandLabel(i18n, value),
    amount: token,
  });
  const index = formatted.indexOf(token);
  const numeric = element('strong', {
    className: 'inquiry-evidence-panel-metric-value',
    textContent: amount,
  });
  numeric.style.setProperty('--metric-color', evidenceStrengthColor({
    netWeightDecibans: value,
    absoluteWeightDecibans: Math.abs(value),
    dissonance: 0,
  }, { saturationThresholdDecibans }));
  metric.replaceChildren(
    document.createTextNode(formatted.slice(0, index)),
    numeric,
    document.createTextNode(formatted.slice(index + token.length)),
  );
}

function updatePanelHeading(heading, i18n, value) {
  if (Math.abs(value) <= 1e-12) {
    heading.textContent = i18n.t('inquiry.thenEvidenceNoDirection');
    return;
  }
  const band = jeffreysBand({ weightDecibans: value }).replace(' against', '');
  heading.textContent = i18n.t('inquiry.thenEvidenceStrength', {
    strength: i18n.t(`inquiry.conditionalBandSentence.${band}`),
  });
}

export function createConditionalStrengthControl({
  i18n,
  targetTitle,
  value = 0,
  defaultValue = value,
  saturationThresholdDecibans,
  forceExtentDecibans = 2 * saturationThresholdDecibans,
  panelNarrative = false,
  panelTargetContent,
  headingId,
  onInput,
}) {
  const minimum = -forceExtentDecibans;
  const maximum = forceExtentDecibans;
  let current = value;
  const metric = element('span', {
    className: 'inquiry-conditional-strength-metric',
  });
  const input = element('input', {
    type: 'range',
    className: 'inquiry-conditional-strength-input',
    min: minimum,
    max: maximum,
    step: 1,
    'aria-label': i18n.t('inquiry.conditionalStrengthHandle', { target: targetTitle }),
  });
  const arrow = renderForceArrow(0, forceExtentDecibans);
  const visual = element('div', {
    className: 'inquiry-force-arrow-layer inquiry-conditional-strength-visual',
    'aria-hidden': 'true',
  }, [arrow]);
  const heading = panelNarrative ? element('h3', {
    id: headingId,
    className: 'inquiry-conditional-strength-heading',
  }) : undefined;
  const relation = element(panelNarrative ? 'h3' : 'p', {
    id: panelNarrative ? `${headingId}-target` : undefined,
    className: 'inquiry-conditional-strength-relation',
  });
  const reset = element('button', {
    type: 'button',
    className: 'inquiry-conditional-strength-reset',
    title: i18n.t('inquiry.resetConditionalStrength'),
    'aria-label': i18n.t('inquiry.resetConditionalStrength'),
    textContent: '↺',
  });

  function setValue(next) {
    current = next;
    const visibleValue = Math.max(minimum, Math.min(maximum, current));
    input.value = String(visibleValue);
    input.classList.toggle('is-clipped', visibleValue !== current);
    reset.disabled = Math.abs(current - defaultValue) <= 1e-12;
    updateForceArrow(arrow, visibleValue, forceExtentDecibans, evidenceStrengthColor({
      netWeightDecibans: current,
      absoluteWeightDecibans: Math.abs(current),
      dissonance: 0,
    }, { saturationThresholdDecibans }));
    updateMetric(metric, i18n, current, saturationThresholdDecibans);
    if (heading) updatePanelHeading(heading, i18n, current);
    const relationPrefix = panelNarrative ? 'inquiry.conditionalRelationHeading' : 'inquiry.conditionalRelation';
    relation.textContent = i18n.t(current < 0
      ? `${relationPrefix}Opposition`
      : current > 0
        ? `${relationPrefix}Support`
        : `${relationPrefix}Neutral`);
    input.setAttribute('aria-valuetext', metric.textContent);
  }

  input.addEventListener('input', () => {
    setValue(Number(input.value));
    onInput?.(current);
  });
  reset.addEventListener('click', () => {
    if (Math.abs(current - defaultValue) <= 1e-12) return;
    setValue(defaultValue);
    onInput?.(current);
    input.focus();
  });
  setValue(current);

  const control = element('div', { className: 'inquiry-conditional-strength-control' }, [
    visual,
    input,
    renderForceScaleRuler(i18n, forceExtentDecibans),
    element('div', {
      className: 'inquiry-conditional-strength-legend',
      'aria-hidden': 'true',
    }, [
      element('span', { textContent: i18n.t('inquiry.conditionalOpposition') }),
      element('span', { textContent: i18n.t('inquiry.conditionalSupport') }),
    ]),
  ]);
  const target = element('p', {
    className: 'inquiry-conditional-strength-target',
    textContent: targetTitle,
  });
  const children = panelNarrative
    ? [reset, heading, control]
    : [reset, metric, control, relation, target];
  const targetSection = panelNarrative ? element('section', {
    className: 'inquiry-evidence-panel-target',
    'aria-labelledby': relation.id,
  }, [relation, panelTargetContent ?? target]) : undefined;

  return {
    element: element('div', {
      className: `inquiry-conditional-strength${panelNarrative ? ' is-panel-narrative' : ''}`,
    }, children),
    targetSection,
    value: () => current,
  };
}
