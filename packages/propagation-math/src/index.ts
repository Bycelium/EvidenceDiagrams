export {
  applyImpact,
  bandToGaussian,
  expectedProbability,
  gaussianToBand,
} from './gaussian.js';
export { evaluatePropagationGraph } from './propagation.js';
export type {
  Gaussian,
  GaussianBand,
  GaussianImpact,
} from './gaussian.js';
export type {
  PropagationClaim,
  PropagationClaimEvaluation,
  PropagationEvaluationOptions,
  PropagationEvidence,
  PropagationEvidenceOrder,
  PropagationGraph,
  PropagationGraphEvaluation,
  PropagationStep,
} from './propagation.js';
