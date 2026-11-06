import {
  evaluateInquiry,
  type InquiryEvaluation,
} from '@bycelium/evidence-diagrams';
import { element } from '../dom.ts';
import type { InterpolationValues } from '../i18n/index.ts';
import type { InquirySession } from '../state.ts';
import { claimById, resultForClaim } from './lookups.ts';

export interface NavigationMessages {
  readonly breadcrumbLabel: string;
  readonly addRoot: string;
  readonly rootListLabel: string;
  readonly openRootNamed: string;
}

type RenderedCredibility = {
  credibility: HTMLElement;
  palette: { color: string };
};

type ClaimNavigationOptions = {
  messages: NavigationMessages;
  formatMessage: (template: string, values?: InterpolationValues) => string;
  evidenceOrder: { readonly evidenceOrder: 'weakest-first' };
  rootSessions: ReadonlyMap<string, InquirySession>;
  session: InquirySession;
  renderCredibility: (
    evaluation: ReturnType<typeof resultForClaim>,
    compact: boolean,
  ) => RenderedCredibility;
};

export function renderBreadcrumbs(
  container: HTMLElement,
  result: InquiryEvaluation,
  options: Pick<ClaimNavigationOptions, 'messages' | 'session' | 'renderCredibility'>,
): void {
  const { messages, session, renderCredibility } = options;
  container.setAttribute('aria-label', messages.breadcrumbLabel);
  const ancestorIds = session.breadcrumbs.slice(0, -1);
  container.hidden = ancestorIds.length === 0;
  if (container.hidden) {
    container.replaceChildren();
    return;
  }
  const list = element('ol');
  for (const claimId of ancestorIds) {
    const claim = claimById(session.inquiry, claimId);
    const evaluated = resultForClaim(result, claim.id);
    const rendered = renderCredibility(evaluated, true);
    const button = element('button', {
      type: 'button',
      className: 'inquiry-ancestor-link',
      dataset: { action: 'open-claim', claimId },
    }, [
      element('span', { className: 'inquiry-ancestor-title', textContent: claim.title }),
      rendered.credibility,
    ]);
    button.style.setProperty('--result-color', rendered.palette.color);
    list.append(element('li', {}, [button]));
  }
  container.replaceChildren(list);
}

export function renderRootList(container: HTMLElement, options: ClaimNavigationOptions): void {
  const {
    messages,
    formatMessage,
    evidenceOrder,
    rootSessions,
    session,
    renderCredibility,
  } = options;
  container.setAttribute('aria-label', messages.rootListLabel);
  const items: HTMLElement[] = [element('div', { className: 'inquiry-root-add' }, [
    element('button', {
      type: 'button',
      dataset: { action: 'add-root' },
      'aria-label': messages.addRoot,
    }, [
      element('span', { className: 'inquiry-flow-add-icon', 'aria-hidden': 'true', textContent: '+' }),
      element('span', { textContent: messages.addRoot }),
    ]),
  ])];
  for (const [rootId, rootSession] of rootSessions) {
    if (rootId === session.inquiry.rootClaimId) continue;
    const root = claimById(rootSession.inquiry, rootId);
    const evaluated = resultForClaim(evaluateInquiry(rootSession.inquiry, evidenceOrder), rootId);
    const rendered = renderCredibility(evaluated, true);
    const card = element('button', {
      type: 'button',
      className: 'inquiry-root-card inquiry-claim-card',
      dataset: { action: 'select-root', rootId },
      'aria-label': formatMessage(messages.openRootNamed, { root: root.title }),
    }, [
      element('span', { className: 'inquiry-root-card-title', textContent: root.title }),
      rendered.credibility,
    ]);
    card.style.setProperty('--result-color', rendered.palette.color);
    items.push(card);
  }
  container.replaceChildren(...items);
}
