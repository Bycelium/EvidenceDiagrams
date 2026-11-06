import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluatePropagationGraph,
  expectedProbability,
  type PropagationGraph,
} from '@bycelium/propagation-math';

test('recursively evaluates premises before applying their fixed impacts', () => {
  const graph: PropagationGraph = {
    rootId: 'root',
    claims: [
      { id: 'root', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'premise', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'leaf', prior: { mean: 0, standardDeviation: 0 } },
    ],
    evidence: [
      {
        id: 'premise-to-root',
        premiseId: 'premise',
        targetId: 'root',
        impact: { deltaMean: 10, deltaStandardDeviation: 0 },
      },
      {
        id: 'leaf-to-premise',
        premiseId: 'leaf',
        targetId: 'premise',
        impact: { deltaMean: 10, deltaStandardDeviation: 0 },
      },
    ],
  };

  const result = evaluatePropagationGraph(graph);
  const premiseProbability = expectedProbability({ mean: 5, standardDeviation: 0 });
  assert.equal(result.claims.premise!.posterior.mean, 5);
  assert.equal(result.claims.root!.posterior.mean, 10 * premiseProbability);
  assert.equal(result.claims.root!.steps[0]!.premiseProbability, premiseProbability);
});

test('replays each target evidence list in array order', () => {
  const result = evaluatePropagationGraph({
    rootId: 'root',
    claims: [
      { id: 'root', prior: { mean: 0, standardDeviation: 4 } },
      { id: 'certain', prior: { mean: 10000, standardDeviation: 0 } },
      { id: 'neutral', prior: { mean: 0, standardDeviation: 0 } },
    ],
    evidence: [
      {
        id: 'first',
        premiseId: 'certain',
        targetId: 'root',
        impact: { deltaMean: 3, deltaStandardDeviation: -6 },
      },
      {
        id: 'second',
        premiseId: 'neutral',
        targetId: 'root',
        impact: { deltaMean: 8, deltaStandardDeviation: 4 },
      },
    ],
  });

  const root = result.claims.root!;
  assert.deepEqual(root.steps.map(({ evidenceId }) => evidenceId), ['first', 'second']);
  assert.deepEqual(root.steps[0]!.after, { mean: 3, standardDeviation: 2 });
  assert.deepEqual(root.posterior, { mean: 7, standardDeviation: 4 });
});

test('optionally replays weakest mean shifts first regardless of direction', () => {
  const graph: PropagationGraph = {
    rootId: 'root',
    claims: [
      { id: 'root', prior: { mean: 0, standardDeviation: 5 } },
      { id: 'half', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'certain', prior: { mean: 10000, standardDeviation: 0 } },
      { id: 'width-only', prior: { mean: 10000, standardDeviation: 0 } },
    ],
    evidence: [
      {
        id: 'support-five',
        premiseId: 'half',
        targetId: 'root',
        impact: { deltaMean: 10, deltaStandardDeviation: 0 },
      },
      {
        id: 'oppose-six',
        premiseId: 'certain',
        targetId: 'root',
        impact: { deltaMean: -6, deltaStandardDeviation: 0 },
      },
      {
        id: 'change-width',
        premiseId: 'width-only',
        targetId: 'root',
        impact: { deltaMean: 0, deltaStandardDeviation: 3 },
      },
    ],
  };

  const stored = evaluatePropagationGraph(graph);
  const weakest = evaluatePropagationGraph(graph, { evidenceOrder: 'weakest-first' });

  assert.deepEqual(stored.claims.root!.steps.map(({ evidenceId }) => evidenceId), [
    'support-five',
    'oppose-six',
    'change-width',
  ]);
  assert.deepEqual(weakest.claims.root!.steps.map(({ evidenceId }) => evidenceId), [
    'change-width',
    'support-five',
    'oppose-six',
  ]);
});

test('retains source-array order for equal weakest-first shifts', () => {
  const result = evaluatePropagationGraph({
    rootId: 'root',
    claims: [
      { id: 'root', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'half-a', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'certain', prior: { mean: 10000, standardDeviation: 0 } },
      { id: 'half-b', prior: { mean: 0, standardDeviation: 0 } },
    ],
    evidence: [
      { id: 'first-tie', premiseId: 'half-a', targetId: 'root', impact: { deltaMean: 10, deltaStandardDeviation: 0 } },
      { id: 'second-tie', premiseId: 'certain', targetId: 'root', impact: { deltaMean: -5, deltaStandardDeviation: 0 } },
      { id: 'third-tie', premiseId: 'half-b', targetId: 'root', impact: { deltaMean: -10, deltaStandardDeviation: 0 } },
    ],
  }, { evidenceOrder: 'weakest-first' });

  assert.deepEqual(result.claims.root!.steps.map(({ evidenceId }) => evidenceId), [
    'first-tie',
    'second-tie',
    'third-tie',
  ]);
});

test('re-ranks from updated premise credibility and ranks nested claims recursively', () => {
  function evaluate(leafMean: number) {
    return evaluatePropagationGraph({
      rootId: 'root',
      claims: [
        { id: 'root', prior: { mean: 0, standardDeviation: 0 } },
        { id: 'nested', prior: { mean: 0, standardDeviation: 0 } },
        { id: 'fixed', prior: { mean: 10000, standardDeviation: 0 } },
        { id: 'leaf', prior: { mean: leafMean, standardDeviation: 0 } },
        { id: 'nested-half', prior: { mean: 0, standardDeviation: 0 } },
        { id: 'nested-certain', prior: { mean: 10000, standardDeviation: 0 } },
      ],
      evidence: [
        { id: 'nested-root', premiseId: 'nested', targetId: 'root', impact: { deltaMean: 10, deltaStandardDeviation: 0 } },
        { id: 'fixed-root', premiseId: 'fixed', targetId: 'root', impact: { deltaMean: 6, deltaStandardDeviation: 0 } },
        { id: 'leaf-nested', premiseId: 'leaf', targetId: 'nested', impact: { deltaMean: 20, deltaStandardDeviation: 0 } },
        { id: 'half-nested', premiseId: 'nested-half', targetId: 'nested', impact: { deltaMean: -4, deltaStandardDeviation: 0 } },
        { id: 'certain-nested', premiseId: 'nested-certain', targetId: 'nested', impact: { deltaMean: 3, deltaStandardDeviation: 0 } },
      ],
    }, { evidenceOrder: 'weakest-first' });
  }

  const lowCredibility = evaluate(-10000);
  const highCredibility = evaluate(10000);
  assert.deepEqual(lowCredibility.claims.root!.steps.map(({ evidenceId }) => evidenceId), [
    'nested-root',
    'fixed-root',
  ]);
  assert.deepEqual(highCredibility.claims.root!.steps.map(({ evidenceId }) => evidenceId), [
    'fixed-root',
    'nested-root',
  ]);
  assert.deepEqual(highCredibility.claims.nested!.steps.map(({ evidenceId }) => evidenceId), [
    'half-nested',
    'certain-nested',
    'leaf-nested',
  ]);
});

test('weakest-first steps and posterior use the same fold-sensitive replay', () => {
  const result = evaluatePropagationGraph({
    rootId: 'root',
    claims: [
      { id: 'root', prior: { mean: 0, standardDeviation: 4 } },
      { id: 'strong', prior: { mean: 10000, standardDeviation: 0 } },
      { id: 'weak', prior: { mean: 0, standardDeviation: 0 } },
    ],
    evidence: [
      { id: 'strong-second-in-source', premiseId: 'strong', targetId: 'root', impact: { deltaMean: 3, deltaStandardDeviation: -6 } },
      { id: 'weak-first-in-source', premiseId: 'weak', targetId: 'root', impact: { deltaMean: 2, deltaStandardDeviation: 8 } },
    ],
  }, { evidenceOrder: 'weakest-first' });

  const root = result.claims.root!;
  assert.deepEqual(root.steps.map(({ evidenceId }) => evidenceId), [
    'weak-first-in-source',
    'strong-second-in-source',
  ]);
  assert.deepEqual(root.steps[0]!.before, { mean: 0, standardDeviation: 4 });
  assert.deepEqual(root.steps[0]!.after, { mean: 1, standardDeviation: 8 });
  assert.deepEqual(root.steps[1]!.before, root.steps[0]!.after);
  assert.deepEqual(root.steps[1]!.after, { mean: 4, standardDeviation: 2 });
  assert.deepEqual(root.posterior, root.steps[1]!.after);
});

test('memoizes a shared premise while allowing it to affect multiple targets', () => {
  const result = evaluatePropagationGraph({
    rootId: 'root',
    claims: [
      { id: 'root', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'left', prior: { mean: 0, standardDeviation: 0 } },
      { id: 'right', prior: { mean: 0, standardDeviation: 0 } },
      { id: '__proto__', prior: { mean: 0, standardDeviation: 0 } },
    ],
    evidence: [
      { id: 'shared-left', premiseId: '__proto__', targetId: 'left', impact: { deltaMean: 2, deltaStandardDeviation: 0 } },
      { id: 'shared-right', premiseId: '__proto__', targetId: 'right', impact: { deltaMean: 4, deltaStandardDeviation: 0 } },
      { id: 'left-root', premiseId: 'left', targetId: 'root', impact: { deltaMean: 2, deltaStandardDeviation: 0 } },
      { id: 'right-root', premiseId: 'right', targetId: 'root', impact: { deltaMean: 4, deltaStandardDeviation: 0 } },
    ],
  });

  assert.equal(Object.getPrototypeOf(result.claims), null);
  assert.equal(result.claims.__proto__!.probability, 0.5);
  assert.equal(result.claims.left!.posterior.mean, 1);
  assert.equal(result.claims.right!.posterior.mean, 2);
});

test('does not mutate graph inputs or alias caller-owned values', () => {
  const prior = { mean: 0, standardDeviation: 1 };
  const impact = { deltaMean: 2, deltaStandardDeviation: -1 };
  const graph: PropagationGraph = {
    rootId: 'root',
    claims: [
      { id: 'root', prior },
      { id: 'premise', prior: { mean: 0, standardDeviation: 0 } },
    ],
    evidence: [{ id: 'edge', premiseId: 'premise', targetId: 'root', impact }],
  };
  const snapshot = JSON.stringify(graph);
  const result = evaluatePropagationGraph(graph);
  assert.equal(JSON.stringify(graph), snapshot);
  assert.notEqual(result.claims.root!.prior, prior);
  assert.notEqual(result.claims.root!.steps[0]!.impact, impact);
});

test('rejects missing references, duplicates, and cycles', () => {
  const claims = [
    { id: 'a', prior: { mean: 0, standardDeviation: 0 } },
    { id: 'b', prior: { mean: 0, standardDeviation: 0 } },
  ];
  assert.throws(
    () => evaluatePropagationGraph({ rootId: 'missing', claims, evidence: [] }),
    /root/i,
  );
  assert.throws(
    () => evaluatePropagationGraph({ rootId: 'a', claims: [...claims, claims[0]!], evidence: [] }),
    /duplicate claim/i,
  );
  assert.throws(
    () => evaluatePropagationGraph({
      rootId: 'a',
      claims,
      evidence: [{ id: 'edge', premiseId: 'missing', targetId: 'a', impact: { deltaMean: 0, deltaStandardDeviation: 0 } }],
    }),
    /missing premise/i,
  );
  assert.throws(
    () => evaluatePropagationGraph({
      rootId: 'a',
      claims,
      evidence: [
        { id: 'one', premiseId: 'b', targetId: 'a', impact: { deltaMean: 0, deltaStandardDeviation: 0 } },
        { id: 'two', premiseId: 'b', targetId: 'a', impact: { deltaMean: 1, deltaStandardDeviation: 0 } },
      ],
    }),
    /duplicate premise-target/i,
  );
  assert.throws(
    () => evaluatePropagationGraph({
      rootId: 'a',
      claims,
      evidence: [
        { id: 'one', premiseId: 'b', targetId: 'a', impact: { deltaMean: 0, deltaStandardDeviation: 0 } },
        { id: 'two', premiseId: 'a', targetId: 'b', impact: { deltaMean: 0, deltaStandardDeviation: 0 } },
      ],
    }),
    /cycle/i,
  );
});
