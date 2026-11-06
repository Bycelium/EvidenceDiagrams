import {
  applyImpact,
  expectedProbability,
  type Gaussian,
  type GaussianImpact,
} from './gaussian.js';

export type PropagationClaim = {
  readonly id: string;
  readonly prior: Gaussian;
};

export type PropagationEvidence = {
  readonly id: string;
  readonly premiseId: string;
  readonly targetId: string;
  readonly impact: GaussianImpact;
};

export type PropagationGraph = {
  readonly rootId: string;
  readonly claims: readonly PropagationClaim[];
  /** Evidence order is the default replay order for each target. */
  readonly evidence: readonly PropagationEvidence[];
};

export type PropagationEvidenceOrder = 'stored' | 'weakest-first';

export type PropagationEvaluationOptions = {
  /** Chooses each target's replay order after recursively evaluating its premises. */
  readonly evidenceOrder?: PropagationEvidenceOrder;
};

export type PropagationStep = {
  readonly evidenceId: string;
  readonly premiseId: string;
  readonly premiseProbability: number;
  readonly before: Gaussian;
  readonly after: Gaussian;
  readonly impact: GaussianImpact;
};

export type PropagationClaimEvaluation = {
  readonly prior: Gaussian;
  readonly posterior: Gaussian;
  readonly probability: number;
  readonly steps: readonly PropagationStep[];
};

export type PropagationGraphEvaluation = {
  readonly rootId: string;
  readonly claims: Record<string, PropagationClaimEvaluation>;
};

function safeRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function copyGaussian(gaussian: Gaussian): Gaussian {
  return {
    mean: gaussian.mean,
    standardDeviation: gaussian.standardDeviation,
  };
}

function copyImpact(impact: GaussianImpact): GaussianImpact {
  return {
    deltaMean: impact.deltaMean,
    deltaStandardDeviation: impact.deltaStandardDeviation,
  };
}

/** Evaluates a directed acyclic Gaussian propagation graph. */
export function evaluatePropagationGraph(
  graph: PropagationGraph,
  options: PropagationEvaluationOptions = {},
): PropagationGraphEvaluation {
  const evidenceOrder = options.evidenceOrder ?? 'stored';
  if (evidenceOrder !== 'stored' && evidenceOrder !== 'weakest-first') {
    throw new RangeError(`Unknown evidence order: ${String(evidenceOrder)}`);
  }
  const claims = new Map<string, PropagationClaim>();
  for (const claim of graph.claims) {
    if (claims.has(claim.id)) throw new Error(`Duplicate claim id: ${claim.id}`);
    claims.set(claim.id, claim);
  }
  if (!claims.has(graph.rootId)) throw new Error(`Missing root claim: ${graph.rootId}`);

  const evidenceIds = new Set<string>();
  const links = new Set<string>();
  const evidenceByTarget = new Map<string, PropagationEvidence[]>();
  for (const item of graph.evidence) {
    if (evidenceIds.has(item.id)) throw new Error(`Duplicate evidence id: ${item.id}`);
    evidenceIds.add(item.id);
    if (!claims.has(item.premiseId)) {
      throw new Error(`Evidence ${item.id} references missing premise claim ${item.premiseId}.`);
    }
    if (!claims.has(item.targetId)) {
      throw new Error(`Evidence ${item.id} references missing target claim ${item.targetId}.`);
    }
    const link = JSON.stringify([item.premiseId, item.targetId]);
    if (links.has(link)) {
      throw new Error(`Duplicate premise-target link: ${item.premiseId} -> ${item.targetId}`);
    }
    links.add(link);
    const targetEvidence = evidenceByTarget.get(item.targetId);
    if (targetEvidence) targetEvidence.push(item);
    else evidenceByTarget.set(item.targetId, [item]);
  }

  const evaluations = safeRecord<PropagationClaimEvaluation>();
  const active = new Set<string>();

  function evaluateClaim(id: string): PropagationClaimEvaluation {
    const cached = evaluations[id];
    if (cached !== undefined) return cached;
    if (active.has(id)) throw new Error(`Cycle detected at claim ${id}.`);
    const claim = claims.get(id)!;
    active.add(id);
    try {
      const prior = copyGaussian(claim.prior);
      let posterior = copyGaussian(claim.prior);
      const steps: PropagationStep[] = [];
      const resolvedEvidence = (evidenceByTarget.get(id) ?? []).map((evidence, index) => ({
        evidence,
        index,
        premise: evaluateClaim(evidence.premiseId),
      }));
      if (evidenceOrder === 'weakest-first') {
        resolvedEvidence.sort((left, right) => (
          Math.abs(left.premise.probability * left.evidence.impact.deltaMean)
          - Math.abs(right.premise.probability * right.evidence.impact.deltaMean)
          || left.index - right.index
        ));
      }
      for (const { evidence, premise } of resolvedEvidence) {
        const before = posterior;
        const impact = copyImpact(evidence.impact);
        posterior = applyImpact(before, impact, premise.probability);
        steps.push({
          evidenceId: evidence.id,
          premiseId: evidence.premiseId,
          premiseProbability: premise.probability,
          before,
          after: posterior,
          impact,
        });
      }
      const evaluation: PropagationClaimEvaluation = {
        prior,
        posterior,
        probability: expectedProbability(posterior),
        steps,
      };
      evaluations[id] = evaluation;
      return evaluation;
    } finally {
      active.delete(id);
    }
  }

  // Evaluate every declared claim so disconnected invalid cycles cannot hide.
  for (const id of claims.keys()) evaluateClaim(id);
  return { rootId: graph.rootId, claims: evaluations };
}
