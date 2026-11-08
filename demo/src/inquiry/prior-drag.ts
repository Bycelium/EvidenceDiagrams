import { gaussianToBand, type Gaussian } from '@bycelium/evidence-diagrams/propagation-math';
import type { PriorBound } from '@bycelium/evidence-diagrams-dom';
import type { InquirySession } from '../state.ts';
import { claimById } from './lookups.ts';

type PriorDrag = {
  pointerId: number;
  bound: PriorBound;
  claimId: string;
  originalPrior: Gaussian;
  startX: number;
  startValue: number;
  lastValue: number;
  width: number;
  minimum: number;
  maximum: number;
  moved: boolean;
};

type PriorDragOptions = {
  focus: HTMLElement;
  getSession: () => InquirySession;
  restorePrior: (claimId: string, prior: Gaussian) => void;
  commitEndpoint: (input: {
    readonly bound: PriorBound;
    readonly value: number;
    readonly domain: { readonly minimum: number; readonly maximum: number };
    readonly restoreFocus: boolean;
  }) => void;
};

export function installPriorDrag(options: PriorDragOptions): void {
  const { focus, getSession, restorePrior, commitEndpoint } = options;
  let drag: PriorDrag | undefined;

  const pointerDown = (event: PointerEvent) => {
    const handle = event.target instanceof Element
      ? event.target.closest<HTMLElement>('.inquiry-prior-handle')
      : null;
    if (!handle || !event.isPrimary || event.button !== 0) return;
    const track = handle.closest<HTMLElement>('.inquiry-flow-axis-track');
    const bound = handle.dataset.priorBound;
    if (!track || (bound !== 'lower' && bound !== 'upper')) return;
    const session = getSession();
    const claim = claimById(session.inquiry, session.focusClaimId);
    const band = gaussianToBand(claim.prior);
    const bounds = track.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      bound,
      claimId: claim.id,
      originalPrior: { ...claim.prior },
      startX: event.clientX,
      startValue: band[bound],
      lastValue: band[bound],
      width: Math.max(1, bounds.width),
      minimum: Number(handle.getAttribute('aria-valuemin')),
      maximum: Number(handle.getAttribute('aria-valuemax')),
      moved: false,
    };
    focus.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const pointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.clientX === drag.startX) {
      if (!drag.moved || drag.lastValue === drag.startValue) return;
      restorePrior(drag.claimId, drag.originalPrior);
      drag.lastValue = drag.startValue;
      event.preventDefault();
      return;
    }
    const delta = (event.clientX - drag.startX)
      / drag.width * (drag.maximum - drag.minimum);
    const next = Math.round(drag.startValue + delta);
    if (next === drag.lastValue) return;
    drag.moved = true;
    drag.lastValue = next;
    commitEndpoint({
      bound: drag.bound,
      value: next,
      domain: { minimum: drag.minimum, maximum: drag.maximum },
      restoreFocus: false,
    });
    event.preventDefault();
  };

  const pointerUp = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    if (focus.hasPointerCapture(event.pointerId)) focus.releasePointerCapture(event.pointerId);
    drag = undefined;
  };

  const pointerCancel = (event: PointerEvent) => {
    if (drag?.pointerId !== event.pointerId) return;
    restorePrior(drag.claimId, drag.originalPrior);
    if (focus.hasPointerCapture(event.pointerId)) focus.releasePointerCapture(event.pointerId);
    drag = undefined;
  };

  focus.addEventListener('pointerdown', pointerDown);
  document.addEventListener('pointermove', pointerMove);
  document.addEventListener('pointerup', pointerUp);
  document.addEventListener('pointercancel', pointerCancel);
}
