import { cloneInquiry } from '../state.ts';
import { nuclearFrenchTranslations } from './nuclear.fr.ts';
import { nuclearPreset } from './nuclear.ts';

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export const INQUIRY_PRESETS = deepFreeze([nuclearPreset]);

function localizeNuclear(inquiry: typeof nuclearPreset.inquiry) {
  const translation = nuclearFrenchTranslations.nuclear;
  return {
    rootClaimId: inquiry.rootClaimId,
    claims: inquiry.claims.map((claim) => ({
      ...claim,
      title: translation.titles[claim.id],
      description: translation.descriptions[claim.id],
      prior: { ...claim.prior },
    })),
    contributions: inquiry.contributions.map((contribution) => ({
      ...contribution,
      title: translation.contributions[contribution.id],
      url: translation.urls?.[contribution.id] ?? contribution.url,
      locator: translation.locators[contribution.id],
    })),
    evidence: inquiry.evidence.map((item) => ({
      ...item,
      ...(item.relayContributionIds
        ? { relayContributionIds: [...item.relayContributionIds] }
        : {}),
      impact: { ...item.impact },
    })),
  };
}

export function createInquiryPreset(id: string, locale = 'en') {
  const preset = INQUIRY_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown inquiry preset: ${id}`);
  return cloneInquiry(locale === 'fr' ? localizeNuclear(preset.inquiry) : preset.inquiry);
}
