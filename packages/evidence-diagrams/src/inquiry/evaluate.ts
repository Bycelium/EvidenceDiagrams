import {
  evaluatePropagationGraph,
  type Gaussian,
  type GaussianImpact,
  type PropagationEvidenceOrder,
  type PropagationGraph,
} from '@bycelium/evidence-diagrams/propagation-math';

export type InquiryClaim = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly prior: Gaussian;
};

export type InquiryContribution = {
  readonly id: string;
  readonly title: string;
  readonly url?: string;
  readonly locator?: string;
};

export type InquiryEvidence = {
  readonly id: string;
  readonly contributionId: string;
  /** Press or reference sources that relay the canonical contribution for this relationship. */
  readonly relayContributionIds?: readonly string[];
  readonly premiseClaimId: string;
  readonly targetClaimId: string;
  readonly impact: GaussianImpact;
  /** Selects whether the conditional impact is weighted by the premise being true or false. */
  readonly premiseState?: 'true' | 'false';
};

export type Inquiry = {
  readonly rootClaimId: string;
  readonly claims: InquiryClaim[];
  readonly contributions: InquiryContribution[];
  /** Evidence order is the default replay order for each target claim. */
  readonly evidence: InquiryEvidence[];
};

export type InquiryEvaluationOptions = {
  /** Chooses each claim's replay order after recursively evaluating its premises. */
  readonly evidenceOrder?: PropagationEvidenceOrder;
};

export type InquiryEvaluationStep = {
  readonly evidenceId: string;
  readonly premiseClaimId: string;
  readonly premiseProbability: number;
  readonly premiseWeight: number;
  readonly premiseState: 'true' | 'false';
  readonly before: Gaussian;
  readonly after: Gaussian;
  readonly impact: GaussianImpact;
};

export type InquiryClaimEvaluation = {
  readonly prior: Gaussian;
  readonly posterior: Gaussian;
  readonly probability: number;
  readonly steps: InquiryEvaluationStep[];
};

export type InquiryEvaluation = {
  readonly rootClaimId: string;
  readonly claims: Record<string, InquiryClaimEvaluation>;
};

function requireId(value: unknown, description: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${description} must be a non-empty string.`);
  }
}

function requireString(value: unknown, description: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${description} must be a string.`);
  }
}

function requireNonemptyString(value: unknown, description: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${description} must be a non-empty string.`);
  }
}

function requireNonblankString(value: unknown, description: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${description} must be a non-empty string containing non-whitespace characters.`);
  }
}

function requireArray(value: unknown, description: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${description} must be an array.`);
  }
}

function rejectDuplicate(id: string, ids: Set<string>, description: string): void {
  if (ids.has(id)) throw new Error(`Duplicate ${description} id: ${id}`);
  ids.add(id);
}

function safeRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

/** Evaluates an inquiry by recursively weighting each fixed conditional impact. */
export function evaluateInquiry(
  inquiry: Inquiry,
  options: InquiryEvaluationOptions = {},
): InquiryEvaluation {
  requireId(inquiry?.rootClaimId, 'rootClaimId');
  requireArray(inquiry.claims, 'claims');
  requireArray(inquiry.contributions, 'contributions');
  requireArray(inquiry.evidence, 'evidence');

  const claimIds = new Set<string>();
  for (const claim of inquiry.claims) {
    requireId(claim?.id, 'Claim id');
    requireNonblankString(claim.title, `Claim ${claim.id} title`);
    if (claim.description !== undefined) {
      requireString(claim.description, `Claim ${claim.id} description`);
    }
    rejectDuplicate(claim.id, claimIds, 'claim');
  }
  if (!claimIds.has(inquiry.rootClaimId)) {
    throw new Error(`Missing root claim: ${inquiry.rootClaimId}`);
  }

  const contributionIds = new Set<string>();
  for (const contribution of inquiry.contributions) {
    requireId(contribution?.id, 'Contribution id');
    requireNonemptyString(contribution.title, `Contribution ${contribution.id} title`);
    if (contribution.url !== undefined) {
      requireString(contribution.url, `Contribution ${contribution.id} url`);
    }
    if (contribution.locator !== undefined) {
      requireString(contribution.locator, `Contribution ${contribution.id} locator`);
    }
    rejectDuplicate(contribution.id, contributionIds, 'contribution');
  }

  const evidenceIds = new Set<string>();
  const links = new Set<string>();
  for (const evidence of inquiry.evidence) {
    requireId(evidence?.id, 'Evidence id');
    rejectDuplicate(evidence.id, evidenceIds, 'evidence');
    requireId(evidence.contributionId, `Evidence ${evidence.id} contributionId`);
    requireId(evidence.premiseClaimId, `Evidence ${evidence.id} premiseClaimId`);
    requireId(evidence.targetClaimId, `Evidence ${evidence.id} targetClaimId`);
    if (evidence.premiseState !== undefined && evidence.premiseState !== 'true' && evidence.premiseState !== 'false') {
      throw new RangeError(`Evidence ${evidence.id} premiseState must be true or false.`);
    }
    if (!contributionIds.has(evidence.contributionId)) {
      throw new Error(
        `Evidence ${evidence.id} references missing contribution ${evidence.contributionId}.`,
      );
    }
    if (evidence.relayContributionIds !== undefined) {
      requireArray(evidence.relayContributionIds, `Evidence ${evidence.id} relayContributionIds`);
      const relayContributionIds = new Set<string>();
      for (const relayContributionId of evidence.relayContributionIds) {
        requireId(relayContributionId, `Evidence ${evidence.id} relay contribution id`);
        if (relayContributionId === evidence.contributionId) {
          throw new Error(
            `Evidence ${evidence.id} repeats canonical contribution ${relayContributionId} as a relay.`,
          );
        }
        if (!contributionIds.has(relayContributionId)) {
          throw new Error(
            `Evidence ${evidence.id} references missing relay contribution ${relayContributionId}.`,
          );
        }
        rejectDuplicate(relayContributionId, relayContributionIds, `relay contribution for evidence ${evidence.id}`);
      }
    }
    if (!claimIds.has(evidence.premiseClaimId)) {
      throw new Error(
        `Evidence ${evidence.id} references missing premise claim ${evidence.premiseClaimId}.`,
      );
    }
    if (!claimIds.has(evidence.targetClaimId)) {
      throw new Error(
        `Evidence ${evidence.id} references missing target claim ${evidence.targetClaimId}.`,
      );
    }
    const link = JSON.stringify([evidence.premiseClaimId, evidence.targetClaimId]);
    if (links.has(link)) {
      throw new Error(
        `Duplicate premise-target link: ${evidence.premiseClaimId} -> ${evidence.targetClaimId}`,
      );
    }
    links.add(link);
  }

  const graph: PropagationGraph = {
    rootId: inquiry.rootClaimId,
    claims: inquiry.claims.map(({ id, prior }) => ({ id, prior })),
    evidence: inquiry.evidence.map(({ id, premiseClaimId, targetClaimId, impact, premiseState }) => ({
      id,
      premiseId: premiseClaimId,
      targetId: targetClaimId,
      impact,
      premiseState,
    })),
  };
  const evaluated = evaluatePropagationGraph(graph, options);
  const claims = safeRecord<InquiryClaimEvaluation>();
  for (const [id, evaluation] of Object.entries(evaluated.claims)) {
    claims[id] = {
      prior: evaluation.prior,
      posterior: evaluation.posterior,
      probability: evaluation.probability,
      steps: evaluation.steps.map((step) => ({
        evidenceId: step.evidenceId,
        premiseClaimId: step.premiseId,
        premiseProbability: step.premiseProbability,
        premiseWeight: step.premiseWeight,
        premiseState: step.premiseState,
        before: step.before,
        after: step.after,
        impact: step.impact,
      })),
    };
  }
  return { rootClaimId: inquiry.rootClaimId, claims };
}
