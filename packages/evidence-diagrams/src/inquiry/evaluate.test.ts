import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateInquiry,
  type Inquiry,
} from '@bycelium/evidence-diagrams';

function inquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    rootClaimId: 'target',
    claims: [
      {
        id: 'target',
        title: 'The target is true',
        description: 'The target is true under the stated conditions.',
        prior: { mean: 0, standardDeviation: 5 },
      },
      { id: 'premise', title: 'The premise is true', prior: { mean: 0, standardDeviation: 0 } },
    ],
    contributions: [{ id: 'source', title: 'Source' }],
    evidence: [{
      id: 'evidence',
      contributionId: 'source',
      premiseClaimId: 'premise',
      targetClaimId: 'target',
      impact: { deltaMean: 10, deltaStandardDeviation: -2 },
    }],
    ...overrides,
  };
}

test('evaluates an inquiry and exposes claim-oriented replay steps', () => {
  const input = inquiry();
  const snapshot = JSON.stringify(input);
  const result = evaluateInquiry(input);

  assert.equal(result.rootClaimId, 'target');
  assert.deepEqual(result.claims.target!.prior, { mean: 0, standardDeviation: 5 });
  assert.deepEqual(result.claims.target!.posterior, { mean: 5, standardDeviation: 4 });
  assert.deepEqual(result.claims.target!.steps, [{
    evidenceId: 'evidence',
    premiseClaimId: 'premise',
    premiseProbability: 0.5,
    premiseWeight: 0.5,
    premiseState: 'true',
    before: { mean: 0, standardDeviation: 5 },
    after: { mean: 5, standardDeviation: 4 },
    impact: { deltaMean: 10, deltaStandardDeviation: -2 },
  }]);
  assert.equal(JSON.stringify(input), snapshot);
});

test('uses the selected premise state for replay while retaining the true probability', () => {
  const result = evaluateInquiry(inquiry({
    claims: [
      { id: 'target', title: 'Target', prior: { mean: 0, standardDeviation: 5 } },
      { id: 'premise', title: 'Premise', prior: { mean: 10, standardDeviation: 0 } },
    ],
    evidence: [{
      id: 'evidence',
      contributionId: 'source',
      premiseClaimId: 'premise',
      targetClaimId: 'target',
      premiseState: 'false',
      impact: { deltaMean: 10, deltaStandardDeviation: -2 },
    }],
  }));

  const step = result.claims.target!.steps[0]!;
  assert.ok(Math.abs(step.premiseProbability - 10 / 11) < 1e-12);
  assert.ok(Math.abs(step.premiseWeight - 1 / 11) < 1e-12);
  assert.equal(step.premiseState, 'false');
  assert.ok(Math.abs(step.after.mean - 10 / 11) < 1e-12);
  assert.ok(Math.abs(step.after.standardDeviation - (5 - 2 / 11)) < 1e-12);
});

test('claim presentation fields do not change propagation', () => {
  const input = inquiry();
  const renamed: Inquiry = {
    ...input,
    claims: input.claims.map((claim) => ({
      ...claim,
      title: `Sharper: ${claim.title}`,
      description: claim.description ? `More detail: ${claim.description}` : 'Added detail.',
    })),
  };
  assert.deepEqual(evaluateInquiry(renamed), evaluateInquiry(input));
});

test('relay contributions preserve one canonical evidence calculation', () => {
  const input = inquiry();
  const relayed: Inquiry = {
    ...input,
    contributions: [...input.contributions, { id: 'press-relay', title: 'Press relay' }],
    evidence: [{ ...input.evidence[0]!, relayContributionIds: ['press-relay'] }],
  };
  assert.deepEqual(evaluateInquiry(relayed), evaluateInquiry(input));
});

test('passes weakest-first ordering through the public Inquiry API', () => {
  const input = inquiry({
    claims: [
      { id: 'target', title: 'Target', prior: { mean: 0, standardDeviation: 4 } },
      { id: 'weak', title: 'Weak premise', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'strong', title: 'Strong premise', prior: { mean: 10000, standardDeviation: 0 } },
    ],
    contributions: [
      { id: 'weak-source', title: 'Weak source' },
      { id: 'strong-source', title: 'Strong source' },
    ],
    evidence: [
      {
        id: 'strong-evidence',
        contributionId: 'strong-source',
        premiseClaimId: 'strong',
        targetClaimId: 'target',
        impact: { deltaMean: -3, deltaStandardDeviation: -6 },
      },
      {
        id: 'weak-evidence',
        contributionId: 'weak-source',
        premiseClaimId: 'weak',
        targetClaimId: 'target',
        impact: { deltaMean: 4, deltaStandardDeviation: 8 },
      },
    ],
  });
  const snapshot = JSON.stringify(input);

  const stored = evaluateInquiry(input);
  const explicitStored = evaluateInquiry(input, { evidenceOrder: 'stored' });
  const weakest = evaluateInquiry(input, { evidenceOrder: 'weakest-first' });
  assert.deepEqual(explicitStored, stored);
  assert.deepEqual(stored.claims.target!.steps.map(({ evidenceId }) => evidenceId), [
    'strong-evidence',
    'weak-evidence',
  ]);
  assert.deepEqual(weakest.claims.target!.steps.map(({ evidenceId }) => evidenceId), [
    'weak-evidence',
    'strong-evidence',
  ]);
  assert.deepEqual(weakest.claims.target!.posterior, { mean: -1, standardDeviation: 2 });
  assert.equal(JSON.stringify(input), snapshot);
});

test('ranks false-condition Evidence by its selected premise weight', () => {
  const result = evaluateInquiry(inquiry({
    claims: [
      { id: 'target', title: 'Target', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'likely', title: 'Likely premise', prior: { mean: 10000, standardDeviation: 0 } },
      { id: 'half', title: 'Half premise', prior: { mean: 0, standardDeviation: 0 } },
    ],
    contributions: [{ id: 'likely-source', title: 'Likely source' }, { id: 'half-source', title: 'Half source' }],
    evidence: [
      { id: 'half-true', contributionId: 'half-source', premiseClaimId: 'half', targetClaimId: 'target', impact: { deltaMean: 2, deltaStandardDeviation: 0 } },
      { id: 'likely-false', contributionId: 'likely-source', premiseClaimId: 'likely', targetClaimId: 'target', premiseState: 'false', impact: { deltaMean: 3, deltaStandardDeviation: 0 } },
    ],
  }), { evidenceOrder: 'weakest-first' });
  assert.deepEqual(result.claims.target!.steps.map(({ evidenceId }) => evidenceId), ['likely-false', 'half-true']);
});

test('uses null-prototype result records for opaque claim ids', () => {
  const result = evaluateInquiry(inquiry({
    rootClaimId: '__proto__',
    claims: [{ id: '__proto__', title: 'Opaque id', prior: { mean: 0, standardDeviation: 0 } }],
    evidence: [],
  }));
  assert.equal(Object.getPrototypeOf(result.claims), null);
  assert.equal(result.claims.__proto__!.probability, 0.5);
});

test('rejects duplicate ids and premise-target links', () => {
  const base = inquiry();
  assert.throws(
    () => evaluateInquiry(inquiry({ claims: [...base.claims, base.claims[0]!] })),
    /duplicate claim/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ contributions: [...base.contributions, base.contributions[0]!] })),
    /duplicate contribution/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ evidence: [...base.evidence, base.evidence[0]!] })),
    /duplicate evidence/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ evidence: [
      base.evidence[0]!,
      { ...base.evidence[0]!, id: 'second' },
    ] })),
    /duplicate premise-target/i,
  );
});

test('rejects missing roots, sources, claims, and cycles', () => {
  const base = inquiry();
  assert.throws(
    () => evaluateInquiry(inquiry({ rootClaimId: 'missing' })),
    /missing root/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ evidence: [{ ...base.evidence[0]!, contributionId: 'missing' }] })),
    /missing contribution/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ evidence: [{ ...base.evidence[0]!, premiseClaimId: 'missing' }] })),
    /missing premise/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ evidence: [{ ...base.evidence[0]!, targetClaimId: 'missing' }] })),
    /missing target/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ evidence: [
      base.evidence[0]!,
      {
        id: 'cycle',
        contributionId: 'source',
        premiseClaimId: 'target',
        targetClaimId: 'premise',
        impact: { deltaMean: 0, deltaStandardDeviation: 0 },
      },
    ] })),
    /cycle/i,
  );
});

test('validates relay contribution references and identity', () => {
  const base = inquiry();
  const contributions = [...base.contributions, { id: 'relay', title: 'Relay' }];
  const withRelays = (relayContributionIds: unknown) => inquiry({
    contributions,
    evidence: [{ ...base.evidence[0]!, relayContributionIds } as never],
  });
  assert.throws(() => evaluateInquiry(withRelays('relay')), /relayContributionIds.*array/i);
  assert.throws(() => evaluateInquiry(withRelays(['missing'])), /missing relay contribution/i);
  assert.throws(() => evaluateInquiry(withRelays(['relay', 'relay'])), /duplicate relay contribution/i);
  assert.throws(() => evaluateInquiry(withRelays(['source'])), /canonical contribution.*relay/i);
});

test('validates top-level arrays and provenance strings', () => {
  const base = inquiry();
  const spacedTitle = inquiry({
    claims: [{ ...base.claims[0]!, title: '  Target with intentional spacing  ', description: '' }],
    evidence: [],
  });
  assert.doesNotThrow(() => evaluateInquiry(spacedTitle));
  assert.equal(spacedTitle.claims[0]!.title, '  Target with intentional spacing  ');
  assert.equal(spacedTitle.claims[0]!.description, '');
  assert.throws(
    () => evaluateInquiry({ ...base, claims: undefined } as never),
    /claims.*array/i,
  );
  assert.throws(
    () => evaluateInquiry({ ...base, contributions: undefined } as never),
    /contributions.*array/i,
  );
  assert.throws(
    () => evaluateInquiry({ ...base, evidence: undefined } as never),
    /evidence.*array/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ evidence: [{ ...base.evidence[0]!, premiseState: 'unknown' as never }] })),
    /premiseState.*true.*false/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ claims: [{ ...base.claims[0]!, title: 1 as never }] })),
    /claim.*title.*non-empty string/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ claims: [{ ...base.claims[0]!, title: '' }] })),
    /claim.*title.*non-empty string/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ claims: [{ ...base.claims[0]!, title: '   ' }] })),
    /claim.*title.*non-empty string/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ claims: [{ ...base.claims[0]!, description: 1 as never }] })),
    /claim.*description.*string/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ contributions: [{ id: 'source', title: 1 as never }] })),
    /contribution.*title.*non-empty string/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ contributions: [{ id: 'source', title: '' }] })),
    /contribution.*title.*non-empty string/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ contributions: [{ id: 'source', title: 'Source', url: 1 as never }] })),
    /contribution.*url.*string/i,
  );
  assert.throws(
    () => evaluateInquiry(inquiry({ contributions: [{ id: 'source', title: 'Source', locator: 1 as never }] })),
    /contribution.*locator.*string/i,
  );
});
