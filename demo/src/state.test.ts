import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addInquiryEvidence,
  claimsAvailableAsPremises,
  cloneInquirySession,
  createBlankInquirySession,
  createInquirySession,
  editInquiryClaim,
  editInquiryEvidence,
  inquiryClaimView,
  inquiryInitialDeltaMean,
  inquiryInitialPrior,
  openInquiryClaim,
  removeInquiryEvidence,
  setInquiryClaimExpanded,
  setInquiryClaimMode,
  setInquiryClaimTrailExpanded,
  type DemoInquiry,
} from './state.ts';

const baseInquiry = (): DemoInquiry => ({
  rootClaimId: 'root',
  claims: [{ id: 'root', title: 'Root', prior: { mean: 1, standardDeviation: 4 } }],
  contributions: [],
  evidence: [],
});

test('blank inquiry sessions validate their root and remain independently editable', () => {
  const first = createBlankInquirySession({
    id: ' first-root ',
    title: ' First question ',
    description: ' First scope ',
  });
  const second = createBlankInquirySession({ title: 'Second question', description: 'Second scope' });
  assert.equal(first.inquiry.rootClaimId, 'first-root');
  assert.equal(first.focusClaimId, 'first-root');
  assert.equal(first.inquiry.claims[0].title, 'First question');
  assert.equal(first.inquiry.claims[0].description, 'First scope');

  editInquiryClaim(first, 'first-root', { prior: { mean: 4, standardDeviation: 2 } });
  addInquiryEvidence(first, {
    contribution: { title: 'First source' },
    premiseTitle: 'First premise',
    premiseDescription: 'First premise scope',
    impact: { deltaMean: 3, deltaStandardDeviation: 0 },
  });
  const cloned = cloneInquirySession(first);
  assert.deepEqual(inquiryInitialPrior(cloned, 'first-root'), { mean: 0, standardDeviation: 5 });
  assert.equal(cloned.inquiry.evidence.length, 1);
  assert.equal(second.focusClaimId, second.inquiry.rootClaimId);
  assert.equal(second.inquiry.evidence.length, 0);

  assert.throws(() => createBlankInquirySession({ title: ' ', description: 'Scope' }), /nonblank/u);
  assert.throws(() => createBlankInquirySession({ title: 'Question', description: '\t' }), /nonblank/u);
});

test('claim reading levels start closed, persist per claim, and support direct graph entry', () => {
  const inquiry = baseInquiry();
  inquiry.claims.push({ id: 'premise', title: 'Premise', prior: { mean: 0, standardDeviation: 5 } });
  const session = createInquirySession(inquiry);
  assert.deepEqual(inquiryClaimView(session), { expanded: false, mode: 'summary', trailExpanded: true });

  setInquiryClaimExpanded(session, true);
  setInquiryClaimMode(session, 'graph');
  openInquiryClaim(session, 'premise', { mode: 'graph' });
  assert.deepEqual(inquiryClaimView(session), { expanded: true, mode: 'graph', trailExpanded: true });

  openInquiryClaim(session, 'root');
  assert.deepEqual(inquiryClaimView(session), { expanded: true, mode: 'graph', trailExpanded: true });
  setInquiryClaimTrailExpanded(session, false);
  assert.equal(inquiryClaimView(session).trailExpanded, false);
  setInquiryClaimMode(session, 'summary');
  assert.deepEqual(inquiryClaimView(session), { expanded: true, mode: 'summary', trailExpanded: false });
  assert.throws(
    () => setInquiryClaimMode(session, 'unknown' as never),
    /claim view/u,
  );
});

test('adding evidence creates a source and a default premise, then opens that premise', () => {
  const session = createInquirySession(baseInquiry());
  const evidence = addInquiryEvidence(session, {
    contribution: { title: 'Source A', locator: 'table 2' },
    premiseTitle: 'Premise A',
    premiseDescription: 'Scoped premise details.',
    impact: { deltaMean: 4, deltaStandardDeviation: -2 },
  });

  assert.deepEqual(evidence.impact, { deltaMean: 4, deltaStandardDeviation: -2 });
  assert.deepEqual(session.inquiry.claims[1].prior, { mean: 0, standardDeviation: 5 });
  assert.deepEqual(inquiryInitialPrior(session, evidence.premiseClaimId), { mean: 0, standardDeviation: 5 });
  assert.equal(inquiryInitialDeltaMean(session, evidence.id), 4);
  assert.equal(session.inquiry.claims[1].title, 'Premise A');
  assert.equal(session.inquiry.claims[1].description, 'Scoped premise details.');
  assert.equal(session.inquiry.contributions[0].title, 'Source A');
  openInquiryClaim(session, evidence.premiseClaimId);
  assert.deepEqual(session.breadcrumbs, ['root', session.inquiry.claims[1].id]);
  assert.equal(session.focusClaimId, session.inquiry.claims[1].id);
});

test('premise conditions default to true and preserve the assigned impact through edits and cloning', () => {
  const session = createInquirySession(baseInquiry());
  const evidence = addInquiryEvidence(session, {
    contribution: { title: 'Source A' },
    premiseTitle: 'Premise A',
    impact: { deltaMean: 4, deltaStandardDeviation: -2 },
  });
  assert.equal(evidence.premiseState, 'true');

  editInquiryEvidence(session, evidence.id, { premiseState: 'false' });
  const copy = cloneInquirySession(session);
  assert.equal(copy.inquiry.evidence[0]?.premiseState, 'false');
  assert.deepEqual(copy.inquiry.evidence[0]?.impact, { deltaMean: 4, deltaStandardDeviation: -2 });
});

test('session initial values survive edits and candidate cloning for reset controls', () => {
  const inquiry = baseInquiry();
  inquiry.claims.push({ id: 'premise', title: 'Premise', prior: { mean: 2, standardDeviation: 1 } });
  inquiry.contributions.push({ id: 'source', title: 'Source' });
  inquiry.evidence.push({
    id: 'evidence', contributionId: 'source', premiseClaimId: 'premise', targetClaimId: 'root',
    impact: { deltaMean: 3, deltaStandardDeviation: -1 },
  });
  const session = createInquirySession(inquiry);
  editInquiryClaim(session, 'premise', { prior: { mean: -4, standardDeviation: 2 } });
  editInquiryEvidence(session, 'evidence', { impact: { deltaMean: -5, deltaStandardDeviation: -1 } });
  const candidate = cloneInquirySession(session);

  assert.deepEqual(inquiryInitialPrior(candidate, 'premise'), { mean: 2, standardDeviation: 1 });
  assert.equal(inquiryInitialDeltaMean(candidate, 'evidence'), 3);
});

test('existing claims can be reused as premises without duplicating them', () => {
  const inquiry = baseInquiry();
  inquiry.claims.push({ id: 'known', title: 'Known premise', prior: { mean: 2, standardDeviation: 1 } });
  const session = createInquirySession(inquiry);
  assert.deepEqual(claimsAvailableAsPremises(session).map(({ id }) => id), ['known']);
  addInquiryEvidence(session, {
    contribution: { title: 'Source' },
    premiseClaimId: 'known',
    impact: { deltaMean: 2, deltaStandardDeviation: -2 },
  });
  assert.equal(session.inquiry.claims.length, 2);
  assert.equal(session.inquiry.evidence[0].premiseClaimId, 'known');
});

test('prior and source edits replay saved effects unchanged', () => {
  const inquiry = baseInquiry();
  inquiry.claims.push({ id: 'premise', title: 'Premise', prior: { mean: 0, standardDeviation: 5 } });
  inquiry.contributions.push({ id: 'source', title: 'Old source' });
  inquiry.evidence.push({
    id: 'evidence', contributionId: 'source', premiseClaimId: 'premise', targetClaimId: 'root',
    impact: { deltaMean: 3, deltaStandardDeviation: -9 },
  });
  const session = createInquirySession(inquiry);
  editInquiryClaim(session, 'premise', { prior: { mean: 4, standardDeviation: 2 } });
  editInquiryEvidence(session, 'evidence', {
    contribution: { title: 'Renamed source', url: 'https://example.test' },
  });
  assert.deepEqual(session.inquiry.evidence[0].impact, { deltaMean: 3, deltaStandardDeviation: -9 });
  assert.equal(session.inquiry.contributions[0].title, 'Renamed source');

  editInquiryEvidence(session, 'evidence', {
    impact: { deltaMean: -4, deltaStandardDeviation: -11 },
  });
  assert.deepEqual(
    session.inquiry.evidence[0].impact,
    { deltaMean: -4, deltaStandardDeviation: -11 },
  );
});

test('removal prunes its orphan branch', () => {
  const session = createInquirySession(baseInquiry());
  const parent = addInquiryEvidence(session, {
    contribution: { title: 'Parent source' }, premiseTitle: 'Premise',
    impact: { deltaMean: 1, deltaStandardDeviation: -1 },
  });

  openInquiryClaim(session, parent.premiseClaimId);
  setInquiryClaimMode(session, 'graph');
  addInquiryEvidence(session, {
    contribution: { title: 'Deep source' }, premiseTitle: 'Deep premise',
    impact: { deltaMean: 3, deltaStandardDeviation: -4 },
  });
  removeInquiryEvidence(session, parent.id);
  assert.deepEqual(session.inquiry.claims.map(({ id }) => id), ['root']);
  assert.deepEqual(session.inquiry.contributions, []);
  assert.deepEqual(session.inquiry.evidence, []);
  assert.equal(session.focusClaimId, 'root');
  assert.deepEqual(Object.keys(session.claimViews), ['root']);
});

test('relay contributions survive cloning and source cleanup while referenced', () => {
  const inquiry = baseInquiry();
  inquiry.claims.push(
    { id: 'kept', title: 'Kept premise', prior: { mean: 0, standardDeviation: 5 } },
    { id: 'removed', title: 'Removed premise', prior: { mean: 0, standardDeviation: 5 } },
  );
  inquiry.contributions.push(
    { id: 'canonical-kept', title: 'Canonical kept' },
    { id: 'relay-kept', title: 'Relay kept' },
    { id: 'canonical-removed', title: 'Canonical removed' },
  );
  inquiry.evidence.push(
    {
      id: 'kept-evidence',
      contributionId: 'canonical-kept',
      relayContributionIds: ['relay-kept'],
      premiseClaimId: 'kept',
      targetClaimId: 'root',
      impact: { deltaMean: 1, deltaStandardDeviation: 0 },
    },
    {
      id: 'removed-evidence',
      contributionId: 'canonical-removed',
      premiseClaimId: 'removed',
      targetClaimId: 'root',
      impact: { deltaMean: 1, deltaStandardDeviation: 0 },
    },
  );
  const session = createInquirySession(inquiry);
  assert.notEqual(session.inquiry.evidence[0].relayContributionIds, inquiry.evidence[0].relayContributionIds);

  removeInquiryEvidence(session, 'removed-evidence');
  assert.deepEqual(
    session.inquiry.contributions.map(({ id }) => id),
    ['canonical-kept', 'relay-kept'],
  );
});
