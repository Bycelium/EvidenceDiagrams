import { element } from '../html-element.ts';

export type PremiseState = 'true' | 'false';

export type PremiseConditionControlOptions = {
  readonly label: string;
  readonly initialState?: PremiseState;
  readonly trueLabel: string;
  readonly falseLabel: string;
  readonly changeToTrue: string;
  readonly changeToFalse: string;
  readonly onChange?: (input: { readonly premiseState: PremiseState }) => void;
};

export type PremiseConditionControl = {
  readonly element: HTMLElement;
  readonly value: () => PremiseState;
};

/** Renders a button that toggles the selected condition under which Evidence applies. */
export function createPremiseConditionControl({
  label,
  initialState = 'true',
  trueLabel,
  falseLabel,
  changeToTrue,
  changeToFalse,
  onChange,
}: PremiseConditionControlOptions): PremiseConditionControl {
  let state = initialState;
  const button = element('button', { type: 'button', className: 'inquiry-premise-state' }, [
    element('span', { className: 'inquiry-premise-state-value' }),
    element('span', { className: 'inquiry-premise-state-icon', 'aria-hidden': 'true', textContent: '⇄' }),
  ]);
  const update = () => {
    const currentLabel = state === 'true' ? trueLabel : falseLabel;
    const nextAction = state === 'true' ? changeToFalse : changeToTrue;
    button.dataset.premiseState = state;
    button.setAttribute('aria-label', `${label}: ${currentLabel}. ${nextAction}`);
    button.title = `${label}: ${currentLabel}. ${nextAction}`;
    const value = button.querySelector('.inquiry-premise-state-value');
    if (value) value.textContent = currentLabel;
  };
  button.addEventListener('click', () => {
    state = state === 'true' ? 'false' : 'true';
    update();
    onChange?.({ premiseState: state });
  });
  update();
  return { element: button, value: () => state };
}
