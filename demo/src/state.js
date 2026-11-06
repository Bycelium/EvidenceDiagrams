const DEFAULT_CLAIM_PRIOR = Object.freeze({ mean: 0, standardDeviation: 5 });
const DEFAULT_CLAIM_VIEW = Object.freeze({ expanded: false, mode: 'summary', trailExpanded: true });
const CLAIM_VIEW_MODES = new Set(['summary', 'graph']);

function copyGaussian(value) {
  return { mean: value.mean, standardDeviation: value.standardDeviation };
}

function initialValues(inquiry) {
  return {
    priorsByClaimId: Object.fromEntries(inquiry.claims.map((claim) => [
      claim.id,
      copyGaussian(claim.prior),
    ])),
    deltaMeansByEvidenceId: Object.fromEntries(inquiry.evidence.map((item) => [
      item.id,
      item.impact.deltaMean,
    ])),
  };
}

function copyInitialValues(values) {
  return {
    priorsByClaimId: Object.fromEntries(
      Object.entries(values.priorsByClaimId).map(([id, prior]) => [id, copyGaussian(prior)]),
    ),
    deltaMeansByEvidenceId: { ...values.deltaMeansByEvidenceId },
  };
}

export function cloneInquiry(inquiry) {
  return {
    rootClaimId: inquiry.rootClaimId,
    claims: inquiry.claims.map((claim) => ({
      ...claim,
      prior: copyGaussian(claim.prior),
    })),
    contributions: inquiry.contributions.map((contribution) => ({ ...contribution })),
    evidence: inquiry.evidence.map((item) => {
      const copy = {
        ...item,
        impact: {
          deltaMean: item.impact.deltaMean,
          deltaStandardDeviation: item.impact.deltaStandardDeviation,
        },
      };
      if (item.relayContributionIds) copy.relayContributionIds = [...item.relayContributionIds];
      return copy;
    }),
  };
}

export function createInquirySession(inquiry) {
  const copy = cloneInquiry(inquiry);
  return {
    inquiry: copy,
    focusClaimId: copy.rootClaimId,
    breadcrumbs: [copy.rootClaimId],
    claimViews: { [copy.rootClaimId]: { ...DEFAULT_CLAIM_VIEW } },
    initialValues: initialValues(copy),
  };
}

export function createBlankInquirySession({ title, description, id } = {}) {
  const rootClaimId = id === undefined ? 'root' : id.trim();
  const rootTitle = title?.trim();
  const rootDescription = description?.trim();
  if (!rootClaimId) throw new TypeError('Root claim id must be nonblank');
  if (!rootTitle) throw new TypeError('Root claim title must be nonblank');
  if (!rootDescription) throw new TypeError('Root claim description must be nonblank');
  return createInquirySession({
    rootClaimId,
    claims: [{
      id: rootClaimId,
      title: rootTitle,
      description: rootDescription,
      prior: copyGaussian(DEFAULT_CLAIM_PRIOR),
    }],
    contributions: [],
    evidence: [],
  });
}

export function cloneInquirySession(session) {
  return {
    inquiry: cloneInquiry(session.inquiry),
    focusClaimId: session.focusClaimId,
    breadcrumbs: [...session.breadcrumbs],
    claimViews: Object.fromEntries(
      Object.entries(session.claimViews).map(([claimId, view]) => [claimId, { ...view }]),
    ),
    initialValues: copyInitialValues(session.initialValues),
  };
}

export function inquiryInitialPrior(session, claimId = session.focusClaimId) {
  const claim = findClaim(session.inquiry, claimId);
  const initial = session.initialValues?.priorsByClaimId[claimId] ?? claim.prior;
  return copyGaussian(initial);
}

export function inquiryInitialDeltaMean(session, evidenceId) {
  const item = findEvidence(session.inquiry, evidenceId);
  return session.initialValues?.deltaMeansByEvidenceId[evidenceId] ?? item.impact.deltaMean;
}

function nextId(items, prefix) {
  const ids = new Set(items.map(({ id }) => id));
  let number = items.length + 1;
  while (ids.has(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function findEvidence(inquiry, evidenceId) {
  const item = inquiry.evidence.find(({ id }) => id === evidenceId);
  if (!item) throw new Error(`Unknown evidence: ${evidenceId}`);
  return item;
}

function findClaim(inquiry, claimId) {
  const claim = inquiry.claims.find(({ id }) => id === claimId);
  if (!claim) throw new Error(`Unknown claim: ${claimId}`);
  return claim;
}

export function inquiryClaimView(session, claimId = session.focusClaimId) {
  findClaim(session.inquiry, claimId);
  session.claimViews ??= {};
  session.claimViews[claimId] ??= { ...DEFAULT_CLAIM_VIEW };
  return session.claimViews[claimId];
}

export function setInquiryClaimExpanded(session, expanded, claimId = session.focusClaimId) {
  const view = inquiryClaimView(session, claimId);
  view.expanded = Boolean(expanded);
  return view;
}

export function setInquiryClaimMode(session, mode, claimId = session.focusClaimId) {
  if (!CLAIM_VIEW_MODES.has(mode)) throw new RangeError(`Unknown claim view: ${mode}`);
  const view = inquiryClaimView(session, claimId);
  view.mode = mode;
  view.expanded = true;
  return view;
}

export function setInquiryClaimTrailExpanded(session, expanded, claimId = session.focusClaimId) {
  const view = inquiryClaimView(session, claimId);
  view.trailExpanded = Boolean(expanded);
  return view;
}

export function openInquiryClaim(session, claimId, options = {}) {
  findClaim(session.inquiry, claimId);
  const existingIndex = session.breadcrumbs.indexOf(claimId);
  if (existingIndex >= 0) {
    session.breadcrumbs = session.breadcrumbs.slice(0, existingIndex + 1);
  } else {
    session.breadcrumbs = [...session.breadcrumbs, claimId];
  }
  session.focusClaimId = claimId;
  if (options.mode !== undefined) setInquiryClaimMode(session, options.mode, claimId);
  if (options.expanded !== undefined) {
    setInquiryClaimExpanded(session, options.expanded, claimId);
  }
  return session;
}

export function addInquiryEvidence(session, {
  contribution,
  premiseClaimId,
  premiseTitle,
  premiseDescription,
  premisePrior = DEFAULT_CLAIM_PRIOR,
  impact,
}) {
  const inquiry = session.inquiry;
  const targetClaimId = session.focusClaimId;
  findClaim(inquiry, targetClaimId);

  let resolvedPremiseClaimId = premiseClaimId;
  if (resolvedPremiseClaimId) {
    findClaim(inquiry, resolvedPremiseClaimId);
  } else {
    resolvedPremiseClaimId = nextId(inquiry.claims, 'claim');
    const description = premiseDescription?.trim();
    inquiry.claims.push({
      id: resolvedPremiseClaimId,
      title: premiseTitle.trim(),
      ...(description ? { description } : {}),
      prior: copyGaussian(premisePrior),
    });
    session.initialValues.priorsByClaimId[resolvedPremiseClaimId] = copyGaussian(premisePrior);
  }

  const contributionId = nextId(inquiry.contributions, 'source');
  inquiry.contributions.push({ id: contributionId, ...contribution });
  const evidence = {
    id: nextId(inquiry.evidence, 'evidence'),
    contributionId,
    premiseClaimId: resolvedPremiseClaimId,
    targetClaimId,
    impact: { ...impact },
  };
  inquiry.evidence.push(evidence);
  session.initialValues.deltaMeansByEvidenceId[evidence.id] = evidence.impact.deltaMean;
  return evidence;
}

export function editInquiryClaim(session, claimId, { prior }) {
  const claim = findClaim(session.inquiry, claimId);
  if (prior !== undefined) claim.prior = copyGaussian(prior);
  return claim;
}

export function editInquiryEvidence(session, evidenceId, {
  contribution,
  impact,
}) {
  const inquiry = session.inquiry;
  const item = findEvidence(inquiry, evidenceId);
  const source = inquiry.contributions.find(({ id }) => id === item.contributionId);
  if (!source) throw new Error(`Unknown contribution: ${item.contributionId}`);
  if (contribution !== undefined) {
    source.title = contribution.title;
    for (const field of ['url', 'locator']) {
      if (contribution[field]) source[field] = contribution[field];
      else delete source[field];
    }
  }
  if (impact !== undefined) item.impact = { ...impact };
  return item;
}

function reachableClaims(inquiry) {
  const reachable = new Set([inquiry.rootClaimId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of inquiry.evidence) {
      if (reachable.has(item.targetClaimId) && !reachable.has(item.premiseClaimId)) {
        reachable.add(item.premiseClaimId);
        changed = true;
      }
    }
  }
  return reachable;
}

export function removeInquiryEvidence(session, evidenceId) {
  findEvidence(session.inquiry, evidenceId);
  const inquiry = session.inquiry;
  inquiry.evidence = inquiry.evidence.filter(({ id }) => id !== evidenceId);
  const reachable = reachableClaims(inquiry);
  inquiry.claims = inquiry.claims.filter(({ id }) => reachable.has(id));
  inquiry.evidence = inquiry.evidence.filter(({ targetClaimId, premiseClaimId }) => (
    reachable.has(targetClaimId) && reachable.has(premiseClaimId)
  ));
  const usedContributions = new Set();
  for (const { contributionId, relayContributionIds = [] } of inquiry.evidence) {
    usedContributions.add(contributionId);
    for (const relayContributionId of relayContributionIds) usedContributions.add(relayContributionId);
  }
  inquiry.contributions = inquiry.contributions.filter(({ id }) => usedContributions.has(id));
  session.breadcrumbs = session.breadcrumbs.filter((id) => reachable.has(id));
  session.claimViews = Object.fromEntries(
    Object.entries(session.claimViews ?? {}).filter(([id]) => reachable.has(id)),
  );
  session.initialValues.priorsByClaimId = Object.fromEntries(
    Object.entries(session.initialValues.priorsByClaimId).filter(([id]) => reachable.has(id)),
  );
  const retainedEvidenceIds = new Set(inquiry.evidence.map(({ id }) => id));
  session.initialValues.deltaMeansByEvidenceId = Object.fromEntries(
    Object.entries(session.initialValues.deltaMeansByEvidenceId)
      .filter(([id]) => retainedEvidenceIds.has(id)),
  );
  if (!reachable.has(session.focusClaimId)) {
    session.focusClaimId = session.breadcrumbs.at(-1) ?? inquiry.rootClaimId;
  }
  return session;
}

export function claimsAvailableAsPremises(session) {
  return session.inquiry.claims.filter(({ id }) => id !== session.focusClaimId);
}
