export type EvidenceSummary = {
  netWeightDecibans: number;
  absoluteWeightDecibans: number;
  dissonance: number;
};

export type EvidenceWeight = {
  readonly weightDecibans: number;
};

export type Probability = {
  readonly probability: number;
};

export type ProbabilityBoundsOptions = {
  readonly minPriorDecibans?: number;
  readonly maxPriorDecibans?: number;
};
