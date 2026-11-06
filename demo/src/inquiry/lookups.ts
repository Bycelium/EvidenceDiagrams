import type {
  InquiryClaimEvaluation,
  InquiryEvaluation,
} from '@bycelium/evidence-diagrams';
import type {
  DemoClaim,
  DemoContribution,
  DemoInquiry,
} from '../state.ts';

export function claimById(inquiry: DemoInquiry, id: string): DemoClaim {
  const claim = inquiry.claims.find((candidate) => candidate.id === id);
  if (!claim) throw new Error(`Unknown claim: ${id}`);
  return claim;
}

export function contributionById(inquiry: DemoInquiry, id: string): DemoContribution {
  const contribution = inquiry.contributions.find((candidate) => candidate.id === id);
  if (!contribution) throw new Error(`Unknown contribution: ${id}`);
  return contribution;
}

export function resultForClaim(
  result: InquiryEvaluation,
  claimId: string,
): InquiryClaimEvaluation {
  const claim = result.claims[claimId];
  if (!claim) throw new Error(`Missing evaluation for claim: ${claimId}`);
  return claim;
}
