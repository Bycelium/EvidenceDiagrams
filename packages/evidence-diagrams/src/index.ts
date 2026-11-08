export { aggregateEvidence } from './evidence/aggregation.js';
export {
  color,
  triangleColor,
  DEFAULT_COLOR_OPTIONS,
  trianglePosition,
} from './colors/color.js';
export {
  credibilityAxisColor,
  credibilityBandBackground,
  evidenceStrengthColor,
} from './colors/palette.js';
export { JEFFREYS_THRESHOLDS_DECIBANS, jeffreysBand } from './evidence/jeffreys.js';
export { decibansToProbability, probabilityToDecibans } from './credibility/conversions.js';
export { boundProbability, formatProbabilityDisplay } from './credibility/probability-bounds.js';
export { buildEvidenceDiagram } from './evidence/diagram.js';
export { evaluateInquiry } from './inquiry/evaluate.js';
export type { JeffreysBand } from './evidence/jeffreys.js';
export type { ProbabilityBound } from './credibility/probability-bounds.js';
export type { ProbabilityBoundsOptions } from './credibility/priors.js';
export type { EvidenceSummary, EvidenceWeight } from './evidence/aggregation.js';
export type { Probability } from './credibility/conversions.js';
export type { ColorOptions, TrianglePosition } from './colors/color.js';
export type {
  CredibilityBand,
  CredibilityBandColorOptions,
  PaletteOptions,
} from './colors/palette.js';
export type {
  EvidenceContribution,
  EvidenceDiagram,
  EvidencePoint,
  EvidenceStep,
} from './evidence/diagram.js';
export type {
  Inquiry,
  InquiryClaim,
  InquiryClaimEvaluation,
  InquiryContribution,
  InquiryEvaluation,
  InquiryEvaluationOptions,
  InquiryEvaluationStep,
  InquiryEvidence,
} from './inquiry/evaluate.js';
