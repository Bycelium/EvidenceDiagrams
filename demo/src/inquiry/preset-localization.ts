import type { DemoInquiry, InquirySession } from '../state.ts';

function findById<Item extends { id: string }>(items: readonly Item[], id: string): Item | undefined {
  return items.find((item) => item.id === id);
}

export function localizePresetSession(
  session: InquirySession,
  previousPreset: DemoInquiry,
  localizedPreset: DemoInquiry,
): void {
  for (const claim of session.inquiry.claims) {
    const previous = findById(previousPreset.claims, claim.id);
    const localized = findById(localizedPreset.claims, claim.id);
    if (!previous || !localized) continue;
    if (claim.title === previous.title) claim.title = localized.title;
    if (claim.description === previous.description) claim.description = localized.description;
  }
  for (const source of session.inquiry.contributions) {
    const previous = findById(previousPreset.contributions, source.id);
    const localized = findById(localizedPreset.contributions, source.id);
    if (!previous || !localized) continue;
    if (source.title === previous.title) source.title = localized.title;
    if (source.locator === previous.locator) {
      if (localized.locator === undefined) delete source.locator;
      else source.locator = localized.locator;
    }
    if (source.url === previous.url) {
      if (localized.url === undefined) delete source.url;
      else source.url = localized.url;
    }
  }
}
