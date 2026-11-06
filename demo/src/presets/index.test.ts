import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateInquiry,
  jeffreysBand,
  type Inquiry,
  type InquiryEvidence,
} from '@bycelium/evidence-diagrams';
import {
  createInquiryPreset,
  INQUIRY_PRESETS,
} from './index.ts';

function graphDepths(inquiry: Inquiry): Map<string, number> {
  const depths = new Map<string, number>([[inquiry.rootClaimId, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { premiseClaimId, targetClaimId } of inquiry.evidence) {
      const targetDepth = depths.get(targetClaimId);
      if (targetDepth !== undefined && depths.get(premiseClaimId) === undefined) {
        depths.set(premiseClaimId, targetDepth + 1);
        changed = true;
      }
    }
  }
  return depths;
}

function maximumGraphDepth(inquiry: Inquiry): number {
  const evidenceByTarget = new Map<string, InquiryEvidence[]>();
  for (const item of inquiry.evidence) {
    const targetEvidence = evidenceByTarget.get(item.targetClaimId) ?? [];
    targetEvidence.push(item);
    evidenceByTarget.set(item.targetClaimId, targetEvidence);
  }
  const memo = new Map<string, number>();
  const active = new Set<string>();
  function depth(claimId: string): number {
    const cached = memo.get(claimId);
    if (cached !== undefined) return cached;
    assert.ok(!active.has(claimId), `${claimId} does not participate in a cycle`);
    active.add(claimId);
    const result = (evidenceByTarget.get(claimId) ?? [])
      .reduce((maximum: number, item: InquiryEvidence) => (
        Math.max(maximum, 1 + depth(item.premiseClaimId))
      ), 0);
    active.delete(claimId);
    memo.set(claimId, result);
    return result;
  }
  return depth(inquiry.rootClaimId);
}

function subtreeEvidence(inquiry: Inquiry, claimId: string): InquiryEvidence[] {
  const result: InquiryEvidence[] = [];
  const pending = [claimId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const targetClaimId = pending.pop()!;
    if (visited.has(targetClaimId)) continue;
    visited.add(targetClaimId);
    for (const item of inquiry.evidence.filter((candidate) =>
      candidate.targetClaimId === targetClaimId)) {
      result.push(item);
      pending.push(item.premiseClaimId);
    }
  }
  return result;
}

test('the catalog exposes only the nuclear inquiry', () => {
  assert.deepEqual(INQUIRY_PRESETS.map(({ id }) => id), ['nuclear']);
  for (const preset of INQUIRY_PRESETS) {
    assert.deepEqual(Object.keys(preset).sort(), ['id', 'inquiry']);
    for (const item of preset.inquiry.claims) {
      assert.ok(item.title.length > 0);
      assert.ok(item.description.length > item.title.length);
      assert.ok(Number.isFinite(item.prior.mean));
      assert.ok(Number.isFinite(item.prior.standardDeviation));
      assert.ok(item.prior.standardDeviation >= 0);
    }
  }
});

test('presets are small, sourced, reachable DAGs no more than four levels deep', () => {
  for (const preset of INQUIRY_PRESETS) {
    const { inquiry } = preset;
    const claimIds = new Set(inquiry.claims.map(({ id }) => id));
    const contributionIds = new Set(inquiry.contributions.map(({ id }) => id));
    const evidenceIds = new Set(inquiry.evidence.map(({ id }) => id));
    assert.equal(claimIds.size, inquiry.claims.length, `${preset.id} claim IDs are unique`);
    assert.equal(contributionIds.size, inquiry.contributions.length, `${preset.id} contribution IDs are unique`);
    assert.equal(evidenceIds.size, inquiry.evidence.length, `${preset.id} evidence IDs are unique`);
    assert.ok(claimIds.has(inquiry.rootClaimId));
    assert.ok(inquiry.claims.length >= 8 && inquiry.claims.length < 100);

    const links = new Set();
    for (const item of inquiry.evidence) {
      assert.ok(claimIds.has(item.premiseClaimId));
      assert.ok(claimIds.has(item.targetClaimId));
      assert.ok(contributionIds.has(item.contributionId));
      for (const relayContributionId of item.relayContributionIds ?? []) {
        assert.ok(contributionIds.has(relayContributionId));
        assert.notEqual(relayContributionId, item.contributionId);
      }
      assert.ok(Number.isFinite(item.impact.deltaMean));
      assert.ok(Number.isFinite(item.impact.deltaStandardDeviation));
      assert.ok(item.impact.deltaMean !== 0 || item.impact.deltaStandardDeviation === 0);
      const link = `${item.premiseClaimId}\0${item.targetClaimId}`;
      assert.ok(!links.has(link), `${preset.id} has no duplicate premise-target link`);
      links.add(link);
    }

    const direct = inquiry.evidence.filter(({ targetClaimId }) => targetClaimId === inquiry.rootClaimId);
    assert.ok(direct.length >= 3 && direct.length < 10);
    for (const claimId of claimIds) {
      assert.ok(inquiry.evidence.filter(({ targetClaimId }) => targetClaimId === claimId).length < 10);
    }
    const depths = graphDepths(inquiry);
    assert.equal(depths.size, inquiry.claims.length, `${preset.id} has no disconnected claims`);
    assert.ok(maximumGraphDepth(inquiry) <= 4, `${preset.id} stays within four premise levels`);
    for (const contribution of inquiry.contributions) {
      assert.match(contribution.url, /^https:\/\//);
      assert.ok(contribution.locator?.length > 10);
      assert.match(`${contribution.title} ${contribution.locator}`, /(?:19|20)\d{2}/);
    }
  }
});

test('the normalized comparison remains specific to its direct root relationship', () => {
  const inquiry = createInquiryPreset('nuclear');
  const targets = new Set(inquiry.evidence
    .filter(({ premiseClaimId }) => premiseClaimId === 'nuclear.published-comparison')
    .map(({ targetClaimId }) => targetClaimId));
  assert.deepEqual(targets, new Set(['nuclear.root']));
});

test('the nuclear root defines casualty danger without imposing one comparison denominator', () => {
  const inquiry = createInquiryPreset('nuclear');
  const byId = new Map(inquiry.claims.map((item) => [item.id, item]));
  assert.doesNotMatch(byId.get('nuclear.root')!.description, /per TWh/);
  const rootEvidence = inquiry.evidence.filter(({ targetClaimId }) => targetClaimId === inquiry.rootClaimId);
  const directComparison = rootEvidence.find(({ premiseClaimId }) => premiseClaimId === 'nuclear.published-comparison');
  assert.ok(directComparison);
  assert.equal(directComparison.contributionId, 'nuclear.lancet-2007');
  assert.deepEqual(directComparison.relayContributionIds, ['nuclear.press-energy-mortality-comparison']);
  assert.equal(rootEvidence.length, 8);

  const evaluated = evaluateInquiry(inquiry);
  const root = evaluated.claims[inquiry.rootClaimId];
  assert.ok(root.posterior.mean < 0);
  assert.ok(root.probability < 0.5);
  assert.match(
    jeffreysBand({ weightDecibans: root.posterior.mean - root.prior.mean }),
    /against$/,
  );
  assert.ok(root.posterior.standardDeviation > 0);
});

test('Chernobyl separates portrayal, observed deaths, and modeled projections', () => {
  const inquiry = createInquiryPreset('nuclear');
  const byId = new Map(inquiry.claims.map((item) => [item.id, item]));
  const argument = byId.get('nuclear.chernobyl-tv-argument')!;
  assert.equal(argument.title, 'Chernobyl demonstrates a high nuclear mass-casualty risk');
  assert.match(argument.description, /Illustrative viewer inference/);
  assert.doesNotMatch(argument.description, /HBO|miniseries|tens of thousands/i);

  const branch = inquiry.evidence.filter(({ targetClaimId }) =>
    targetClaimId === argument.id);
  assert.deepEqual(branch.map(({ premiseClaimId }) => premiseClaimId), [
    'nuclear.chernobyl-acute',
    'nuclear.chernobyl-dramatization',
    'nuclear.chernobyl-later-effects',
    'nuclear.chernobyl-projection-exposed',
    'nuclear.chernobyl-projection-europe',
  ]);
  assert.deepEqual(branch.map(({ impact }) => Math.sign(impact.deltaMean)), [1, -1, -1, 1, 1]);
  assert.match(byId.get('nuclear.chernobyl-acute')!.description, /134.*28.*three months/);
  assert.match(byId.get('nuclear.chernobyl-later-effects')!.description, /6,848.*15 fatal cases/);
  assert.match(byId.get('nuclear.chernobyl-later-effects')!.description, /general population/);
  assert.match(byId.get('nuclear.chernobyl-later-effects')!.description, /higher-dose recovery workers/);
  assert.match(byId.get('nuclear.chernobyl-later-effects')!.description, /without attributing every case individually/);
  assert.match(byId.get('nuclear.chernobyl-projection-exposed')!.description, /4,000.*600,000/);
  assert.match(byId.get('nuclear.chernobyl-projection-exposed')!.description, /statistical projection/);
  assert.match(byId.get('nuclear.chernobyl-projection-europe')!.description, /16,000.*6,700.*38,000/);
  assert.match(byId.get('nuclear.chernobyl-projection-europe')!.description, /modeled excess deaths/);
  assert.match(byId.get('nuclear.chernobyl-dramatization')!.description, /departed from events.*composite/);

  const rootRelation = inquiry.evidence.find(({ id }) => id === 'nuclear.e-chernobyl-root');
  assert.ok(rootRelation);
  assert.equal(rootRelation.contributionId, 'nuclear.hbo-chernobyl');
  assert.deepEqual(rootRelation.impact, { deltaMean: 15, deltaStandardDeviation: 0.2 });
  const baseline = evaluateInquiry(inquiry, { evidenceOrder: 'weakest-first' });
  const withoutProductionLimit = {
    ...inquiry,
    evidence: inquiry.evidence.filter(({ id }) => id !== 'nuclear.e-chernobyl-dramatization'),
  };
  const lessQualified = evaluateInquiry(withoutProductionLimit, { evidenceOrder: 'weakest-first' });
  assert.ok(
    lessQualified.claims[argument.id]!.probability
      > baseline.claims[argument.id]!.probability,
  );
  assert.ok(
    lessQualified.claims[inquiry.rootClaimId]!.posterior.mean
      > baseline.claims[inquiry.rootClaimId]!.posterior.mean,
  );
});

test('root relationships investigate each premise without replaying root proof below it', () => {
  const inquiry = createInquiryPreset('nuclear');
  const rootEvidence = inquiry.evidence.filter(({ targetClaimId }) =>
    targetClaimId === inquiry.rootClaimId);
  const rootPremiseIds = new Set<string>(rootEvidence.map(({ premiseClaimId }) => premiseClaimId));
  for (const rootItem of rootEvidence) {
    const descendants = subtreeEvidence(inquiry, rootItem.premiseClaimId);
    assert.equal(
      descendants.some(({ premiseClaimId }) =>
        rootPremiseIds.has(premiseClaimId) && premiseClaimId !== rootItem.premiseClaimId),
      false,
      `${rootItem.id} does not reuse another root premise as a child attack`,
    );
  }
  const chernobyl = subtreeEvidence(inquiry, 'nuclear.chernobyl-tv-argument');
  const fukushima = subtreeEvidence(inquiry, 'nuclear.fukushima-argument');
  for (const item of [...chernobyl, ...fukushima]) {
    assert.notEqual(item.premiseClaimId, 'nuclear.published-comparison');
    assert.notEqual(item.contributionId, 'nuclear.owid-rates');
  }
});

test('the hydropower catastrophe branch has one direct root effect and propagates report-prior edits', () => {
  const inquiry = createInquiryPreset('nuclear');
  const byId = new Map(inquiry.claims.map((item) => [item.id, item]));
  assert.match(byId.get('nuclear.hydropower-catastrophe-argument')!.description, /classify the 1975 Banqiao–Shimantan dam failures in their hydropower accident comparisons/);
  assert.match(byId.get('nuclear.hydropower-catastrophe-argument')!.description, /catastrophic dam failures can cause mass fatalities/);
  assert.deepEqual(byId.get('nuclear.banqiao-deaths')!.prior, { mean: 8, standardDeviation: 2 });
  assert.match(byId.get('nuclear.banqiao-deaths')!.description, /approximately 26,000 people killed by immediate floodwaves/);

  const branch = inquiry.evidence.filter(({ targetClaimId }) =>
    targetClaimId === 'nuclear.hydropower-catastrophe-argument');
  assert.deepEqual(branch.map(({ id }) => id), ['nuclear.e-banqiao-deaths']);
  assert.equal(inquiry.evidence.filter(({ targetClaimId, premiseClaimId }) =>
    targetClaimId === inquiry.rootClaimId
      && premiseClaimId === 'nuclear.hydropower-catastrophe-argument').length, 1);
  assert.equal(inquiry.evidence.filter(({ targetClaimId, contributionId }) =>
    targetClaimId === inquiry.rootClaimId && contributionId === 'nuclear.nea-comparing-risks').length, 1);

  const baseline = evaluateInquiry(inquiry);
  const weakened = createInquiryPreset('nuclear');
  weakened.claims.find(({ id }) => id === 'nuclear.banqiao-deaths')!.prior = {
    mean: -10000,
    standardDeviation: 0,
  };
  const reevaluated = evaluateInquiry(weakened);
  assert.ok(
    baseline.claims['nuclear.hydropower-catastrophe-argument']!.probability
      > reevaluated.claims['nuclear.hydropower-catastrophe-argument']!.probability,
  );
  assert.ok(
    baseline.claims[inquiry.rootClaimId]!.posterior.mean
      < reevaluated.claims[inquiry.rootClaimId]!.posterior.mean,
  );
});

test('worker-risk branches preserve cohort limits and propagate their primary findings', () => {
  const inquiry = createInquiryPreset('nuclear');
  const byId = new Map(inquiry.claims.map((item) => [item.id, item]));
  assert.match(byId.get('nuclear.puma-risk')!.description, /119,709.*4\.3 million.*7,754/);
  assert.match(byId.get('nuclear.puma-risk')!.description, /5\.38 to 5\.57 × 10⁻⁴/);
  assert.match(byId.get('nuclear.puma-risk')!.description, /7,754.*not a number attributed/);
  assert.match(byId.get('nuclear.inworks-risk')!.description, /309,932.*10\.7 million.*28,089/);
  assert.match(byId.get('nuclear.inworks-risk')!.description, /52% per Gy.*27% to 77%/);
  assert.match(byId.get('nuclear.inworks-risk')!.description, /28,089.*rather than an attributable-death count/);

  const puma = inquiry.evidence.filter(({ targetClaimId }) =>
    targetClaimId === 'nuclear.uranium-mining-risk');
  assert.deepEqual(puma.map(({ id }) => id), ['nuclear.e-puma-risk']);
  assert.deepEqual(puma.map(({ contributionId }) => contributionId), ['nuclear.puma-2024']);
  const inworks = inquiry.evidence.filter(({ targetClaimId }) =>
    targetClaimId === 'nuclear.worker-radiation-risk');
  assert.deepEqual(inworks.map(({ id }) => id), ['nuclear.e-inworks-risk']);
  assert.deepEqual(inworks.map(({ contributionId }) => contributionId), ['nuclear.inworks-2023']);

  const baseline = evaluateInquiry(inquiry);
  for (const [factId, premiseId] of [
    ['nuclear.puma-risk', 'nuclear.uranium-mining-risk'],
    ['nuclear.inworks-risk', 'nuclear.worker-radiation-risk'],
  ]) {
    const weakened = createInquiryPreset('nuclear');
    weakened.claims.find(({ id }) => id === factId)!.prior = {
      mean: -10000,
      standardDeviation: 0,
    };
    const reevaluated = evaluateInquiry(weakened);
    assert.ok(baseline.claims[premiseId]!.probability > reevaluated.claims[premiseId]!.probability);
    assert.ok(
      baseline.claims[inquiry.rootClaimId]!.posterior.mean
        > reevaluated.claims[inquiry.rootClaimId]!.posterior.mean,
    );
  }
});

test('canonical studies retain press relays without repeating primary findings at the root', () => {
  const inquiry = createInquiryPreset('nuclear');
  assert.equal(inquiry.claims.filter(({ id }) => id === 'nuclear.henneman-coal-deaths').length, 1);
  assert.equal(inquiry.contributions.filter(({ id }) => id === 'nuclear.henneman-science-2023').length, 1);
  const coalComparison = inquiry.evidence.find(({ id }) => id === 'nuclear.e-coal-us-comparison');
  assert.ok(coalComparison);
  assert.equal(coalComparison.contributionId, 'nuclear.henneman-science-2023');
  assert.equal(coalComparison.targetClaimId, 'nuclear.published-comparison');
  assert.deepEqual(coalComparison.impact, { deltaMean: 4, deltaStandardDeviation: 0 });
  assert.deepEqual(coalComparison.relayContributionIds, ['nuclear.press-coal-mortality']);
  assert.equal(inquiry.evidence.filter(({ contributionId, targetClaimId }) =>
    contributionId === 'nuclear.henneman-science-2023'
      && targetClaimId === inquiry.rootClaimId).length, 0);
  assert.equal(inquiry.evidence.filter(({ contributionId, targetClaimId }) =>
    contributionId === 'nuclear.press-coal-mortality'
      && targetClaimId === inquiry.rootClaimId).length, 0);

  const contextTriplets = inquiry.evidence.filter(({ contributionId }) =>
    contributionId === 'nuclear.press-fukushima-context');
  assert.deepEqual(contextTriplets.map(({ premiseClaimId, targetClaimId }) => [premiseClaimId, targetClaimId]), [
    ['nuclear.fukushima-displacement-risk', 'nuclear.fukushima-argument'],
  ]);
  const sharedFollowup = inquiry.evidence.filter(({ premiseClaimId }) =>
    premiseClaimId === 'nuclear.fukushima-followup');
  assert.deepEqual(sharedFollowup.map(({ contributionId, targetClaimId }) => [contributionId, targetClaimId]), [
    ['nuclear.unscear-fukushima', 'nuclear.fukushima-argument'],
  ]);
  assert.deepEqual(sharedFollowup[0]!.relayContributionIds, ['nuclear.press-fukushima-context']);
  assert.deepEqual(sharedFollowup[0]!.impact, { deltaMean: -12, deltaStandardDeviation: 0 });
  assert.equal(inquiry.claims.filter(({ id }) => id === 'nuclear.unscear-followup-finding').length, 1);
  assert.equal(inquiry.claims.filter(({ id }) => id === 'nuclear.fukushima-evacuation').length, 1);
  assert.equal(inquiry.evidence.filter(({ id }) => id === 'nuclear.e-unscear-evacuation').length, 1);
  assert.equal(inquiry.evidence.filter(({ premiseClaimId, targetClaimId }) =>
    ['nuclear.unscear-followup-finding', 'nuclear.fukushima-evacuation'].includes(premiseClaimId)
      && targetClaimId === inquiry.rootClaimId).length, 0);

  const baseline = evaluateInquiry(inquiry, { evidenceOrder: 'weakest-first' });
  const weakened = createInquiryPreset('nuclear');
  weakened.claims.find(({ id }) => id === 'nuclear.henneman-coal-deaths')!.prior = {
    mean: -10000,
    standardDeviation: 0,
  };
  const reevaluated = evaluateInquiry(weakened, { evidenceOrder: 'weakest-first' });
  assert.ok(
    baseline.claims['nuclear.coal-us-mortality']!.probability
      > reevaluated.claims['nuclear.coal-us-mortality']!.probability,
  );
  assert.ok(
    baseline.claims['nuclear.published-comparison']!.probability
      > reevaluated.claims['nuclear.published-comparison']!.probability,
  );
  assert.ok(
    baseline.claims[inquiry.rootClaimId]!.posterior.mean
      < reevaluated.claims[inquiry.rootClaimId]!.posterior.mean,
  );

  const weakenedEvacuation = createInquiryPreset('nuclear');
  weakenedEvacuation.claims.find(({ id }) => id === 'nuclear.fukushima-evacuation')!.prior = {
    mean: -10000,
    standardDeviation: 0,
  };
  const evacuationReevaluated = evaluateInquiry(weakenedEvacuation, { evidenceOrder: 'weakest-first' });
  assert.ok(
    baseline.claims['nuclear.fukushima-displacement-risk']!.probability
      > evacuationReevaluated.claims['nuclear.fukushima-displacement-risk']!.probability,
  );
  assert.ok(
    baseline.claims['nuclear.fukushima-argument']!.posterior.mean
      > evacuationReevaluated.claims['nuclear.fukushima-argument']!.posterior.mean,
  );
  assert.ok(
    baseline.claims[inquiry.rootClaimId]!.posterior.mean
      > evacuationReevaluated.claims[inquiry.rootClaimId]!.posterior.mean,
  );
});

test('the compilation reuses one OWID fact while retaining canonical Lancet lineage', () => {
  const inquiry = createInquiryPreset('nuclear');
  assert.equal(inquiry.claims.filter(({ id }) => id === 'nuclear.lancet-rates').length, 1);
  assert.equal(inquiry.contributions.filter(({ id }) => id === 'nuclear.lancet-2007').length, 1);
  const lancetEvidence = inquiry.evidence.filter(({ contributionId }) =>
    contributionId === 'nuclear.lancet-2007');
  assert.deepEqual(lancetEvidence.map(({ targetClaimId }) => targetClaimId), [
    'nuclear.root',
    'nuclear.owid-rates',
  ]);
  const rootEvidence = lancetEvidence.find(({ targetClaimId }) => targetClaimId === inquiry.rootClaimId);
  assert.ok(rootEvidence);
  assert.deepEqual(rootEvidence.relayContributionIds, ['nuclear.press-energy-mortality-comparison']);
  assert.equal(inquiry.evidence.filter(({ targetClaimId, contributionId }) =>
    targetClaimId === inquiry.rootClaimId
      && contributionId === 'nuclear.press-energy-mortality-comparison').length, 0);

  assert.equal(inquiry.claims.filter(({ id }) => id === 'nuclear.owid-rates').length, 1);
  assert.equal(inquiry.contributions.filter(({ id }) => id === 'nuclear.owid-rates').length, 1);
  const owidUses = inquiry.evidence.filter(({ premiseClaimId }) => premiseClaimId === 'nuclear.owid-rates');
  assert.deepEqual(new Set(owidUses.map(({ targetClaimId }) => targetClaimId)), new Set([
    'nuclear.published-comparison',
    'nuclear.renewables-comparison',
  ]));
  assert.ok(owidUses.every(({ contributionId }) => contributionId === 'nuclear.owid-rates'));

  const baseline = evaluateInquiry(inquiry, { evidenceOrder: 'weakest-first' });
  const weakened = createInquiryPreset('nuclear');
  weakened.claims.find(({ id }) => id === 'nuclear.owid-rates')!.prior = {
    mean: -10000,
    standardDeviation: 0,
  };
  const reevaluated = evaluateInquiry(weakened, { evidenceOrder: 'weakest-first' });
  for (const claimId of ['nuclear.published-comparison', 'nuclear.renewables-comparison']) {
    assert.ok(baseline.claims[claimId]!.probability > reevaluated.claims[claimId]!.probability);
  }
  assert.ok(
    baseline.claims[inquiry.rootClaimId]!.posterior.mean
      < reevaluated.claims[inquiry.rootClaimId]!.posterior.mean,
  );
});

test('comparative and avoided-mortality branches expose shared Lancet lineage', () => {
  const inquiry = createInquiryPreset('nuclear');
  assert.equal(inquiry.claims.filter(({ id }) => id === 'nuclear.lancet-rates').length, 1);
  assert.equal(inquiry.claims.filter(({ id }) => id === 'nuclear.kharecha-avoided-deaths').length, 1);

  const neaRelay = inquiry.evidence.find(({ id }) => id === 'nuclear.e-nea-comparison');
  assert.ok(neaRelay);
  assert.equal(neaRelay.premiseClaimId, 'nuclear.lancet-rates');
  assert.equal(neaRelay.targetClaimId, 'nuclear.published-comparison');
  assert.deepEqual(neaRelay.impact, { deltaMean: 0, deltaStandardDeviation: 0 });
  const psiComparison = inquiry.evidence.find(({ id }) => id === 'nuclear.e-psi-comparison');
  assert.ok(psiComparison);
  assert.equal(psiComparison.targetClaimId, 'nuclear.published-comparison');
  assert.deepEqual(psiComparison.impact, { deltaMean: 3, deltaStandardDeviation: -0.2 });

  const avoidedRoot = inquiry.evidence.find(({ id }) => id === 'nuclear.e-avoided-mortality-root');
  assert.ok(avoidedRoot);
  assert.equal(avoidedRoot.premiseClaimId, 'nuclear.avoided-fossil-mortality');
  assert.deepEqual(avoidedRoot.impact, { deltaMean: -6, deltaStandardDeviation: 0 });
  const avoidedBranch = inquiry.evidence.filter(({ targetClaimId }) =>
    targetClaimId === 'nuclear.avoided-fossil-mortality');
  assert.deepEqual(avoidedBranch.map(({ premiseClaimId }) => premiseClaimId), [
    'nuclear.kharecha-avoided-deaths',
  ]);
  const sharedLancet = inquiry.evidence.filter(({ premiseClaimId }) =>
    premiseClaimId === 'nuclear.lancet-rates');
  assert.deepEqual(new Set(sharedLancet.map(({ targetClaimId }) => targetClaimId)), new Set([
    'nuclear.owid-rates',
    'nuclear.published-comparison',
    'nuclear.kharecha-avoided-deaths',
  ]));

  const baseline = evaluateInquiry(inquiry);
  const weakened = createInquiryPreset('nuclear');
  weakened.claims.find(({ id }) => id === 'nuclear.lancet-rates')!.prior = {
    mean: -10000,
    standardDeviation: 0,
  };
  const reevaluated = evaluateInquiry(weakened);
  assert.ok(
    baseline.claims['nuclear.published-comparison']!.probability
      > reevaluated.claims['nuclear.published-comparison']!.probability,
  );
  assert.ok(
    baseline.claims['nuclear.avoided-fossil-mortality']!.probability
      > reevaluated.claims['nuclear.avoided-fossil-mortality']!.probability,
  );
  assert.ok(
    baseline.claims[inquiry.rootClaimId]!.posterior.mean
      < reevaluated.claims[inquiry.rootClaimId]!.posterior.mean,
  );
});

test('preset creation returns isolated copies and localizes claims and source titles', () => {
  const first = createInquiryPreset('nuclear', 'fr');
  const second = createInquiryPreset('nuclear', 'fr');
  const english = createInquiryPreset('nuclear', 'unknown');
  assert.notEqual(first, second);
  assert.notEqual(first.claims[0]!, second.claims[0]!);
  assert.notEqual(first.claims[0]!.prior, second.claims[0]!.prior);
  assert.notEqual(first.evidence[0]!.impact, second.evidence[0]!.impact);
  assert.notEqual(first.evidence[0]!.relayContributionIds, second.evidence[0]!.relayContributionIds);
  assert.match(first.claims[0]!.title, /^Le nucléaire/);
  assert.match(first.claims[0]!.description, /^En tenant compte/);
  assert.match(
    first.claims.find(({ id }) => id === 'nuclear.chernobyl-tv-argument')!.description,
    /risque élevé de pertes humaines massives/,
  );
  assert.match(first.contributions[0].title, /^Our World in Data :/);
  assert.match(first.contributions[0].locator, /^Estimations 2021/);
  assert.equal(english.claims[0].title, 'Nuclear is dangerous');
  assert.match(english.claims[0].description, /^Considering accidents/);
  const englishCoalPress = english.contributions.find(({ id }) => id === 'nuclear.press-coal-mortality');
  const frenchCoalPress = first.contributions.find(({ id }) => id === 'nuclear.press-coal-mortality');
  const englishContextPress = english.contributions.find(({ id }) => id === 'nuclear.press-fukushima-context');
  const frenchContextPress = first.contributions.find(({ id }) => id === 'nuclear.press-fukushima-context');
  const englishComparisonPress = english.contributions.find(({ id }) => id === 'nuclear.press-energy-mortality-comparison');
  const frenchComparisonPress = first.contributions.find(({ id }) => id === 'nuclear.press-energy-mortality-comparison');
  assert.ok(englishCoalPress);
  assert.ok(frenchCoalPress);
  assert.ok(englishContextPress);
  assert.ok(frenchContextPress);
  assert.ok(englishComparisonPress);
  assert.ok(frenchComparisonPress);
  assert.match(englishComparisonPress.url, /washingtonpost\.com/);
  assert.match(frenchComparisonPress.url, /lemonde\.fr/);
  assert.match(englishCoalPress.url, /scientificamerican\.com/);
  assert.match(frenchCoalPress.url, /santemagazine\.fr/);
  assert.match(englishContextPress.url, /theguardian\.com/);
  assert.match(frenchContextPress.url, /lemonde\.fr/);
  assert.match(
    first.claims.find(({ id }) => id === 'nuclear.fukushima-acute')!.description,
    /aucune lésion aiguë ni aucun décès aigu.*ne couvre pas les dommages liés à l’évacuation ou au déplacement/i,
  );

  first.claims[0]!.title = 'Changed';
  first.claims[0]!.description = 'Changed description';
  first.claims[0]!.prior.mean = 99;
  first.evidence[0]!.impact.deltaMean = 99;
  assert.notEqual(second.claims[0]!.title, 'Changed');
  assert.notEqual(second.claims[0]!.description, 'Changed description');
  assert.equal(second.claims[0]!.prior.mean, 0);
  assert.notEqual(second.evidence[0]!.impact.deltaMean, 99);
  for (const { id } of INQUIRY_PRESETS) {
    const source = createInquiryPreset(id, 'en');
    const localized = createInquiryPreset(id, 'fr');
    source.claims.forEach((item, index) => {
      assert.notEqual(localized.claims[index]!.title, item.title);
      assert.notEqual(localized.claims[index]!.description, item.description);
    });
    source.contributions.forEach((item, index) => {
      assert.notEqual(localized.contributions[index]!.title, item.title);
      assert.notEqual(localized.contributions[index]!.locator, item.locator);
    });
  }
  assert.throws(() => createInquiryPreset('missing'), /Unknown inquiry preset/);
});

test('every preset evaluates to finite Gaussian and probability results in replay order', () => {
  for (const { id } of INQUIRY_PRESETS) {
    const inquiry = createInquiryPreset(id);
    const result = evaluateInquiry(inquiry);
    assert.equal(result.rootClaimId, inquiry.rootClaimId);
    for (const claim of inquiry.claims) {
      const evaluated = result.claims[claim.id]!;
      assert.ok(evaluated);
      assert.ok(Number.isFinite(evaluated.posterior.mean));
      assert.ok(Number.isFinite(evaluated.posterior.standardDeviation));
      assert.ok(Number.isFinite(evaluated.probability));
      assert.ok(evaluated.probability >= 0 && evaluated.probability <= 1);
      assert.deepEqual(
        evaluated.steps.map(({ evidenceId }) => evidenceId),
        inquiry.evidence.filter(({ targetClaimId }) => targetClaimId === claim.id).map(({ id: evidenceId }) => evidenceId),
      );
    }
  }
});
