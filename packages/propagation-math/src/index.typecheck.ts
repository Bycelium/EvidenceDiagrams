import {
  applyImpact,
  evaluatePropagationGraph,
  type Gaussian,
  type GaussianImpact,
  type PropagationEvaluationOptions,
  type PropagationGraphEvaluation,
} from '@bycelium/propagation-math';

const prior: Gaussian = { mean: 0, standardDeviation: 5 };
const impact: GaussianImpact = { deltaMean: 10, deltaStandardDeviation: -2 };
const posterior: Gaussian = applyImpact(prior, impact, 0.5);
void posterior;
const weakestFirst: PropagationEvaluationOptions = { evidenceOrder: 'weakest-first' };
void weakestFirst;

const evaluation: PropagationGraphEvaluation = evaluatePropagationGraph({
  rootId: 'root',
  claims: [{ id: 'root', prior }],
  evidence: [],
});
void evaluation;

evaluatePropagationGraph({
  rootId: 'root',
  claims: [{ id: 'root', prior }],
  evidence: [],
}, weakestFirst);

// @ts-expect-error Evidence ordering is a closed public option.
evaluatePropagationGraph({ rootId: 'root', claims: [{ id: 'root', prior }], evidence: [] }, { evidenceOrder: 'strongest-first' });

// @ts-expect-error Gaussian fields are named and required.
applyImpact({ mean: 0 }, impact, 0.5);
// @ts-expect-error An impact cannot use display-band field names.
applyImpact(prior, { lower: -1, upper: 1 }, 0.5);
