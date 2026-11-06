import type { InquiryMessages } from '../../index.ts';

export const inquiry: InquiryMessages = {
  "page": {
    "pageTitle": "Evidence Inquiry | Bycelium",
    "heading": "Evidence inquiry",
    "intro": "Trace how uncertain premises and their sources affect a claim.",
    "temporaryChangesTitle": "Temporary changes",
    "temporaryChangesBody": "Changes to claims, evidence and credibility stay in this browser tab. They are not saved or shared. Reloading or closing the page resets the demo.",
    "temporaryChangesAcknowledge": "I understand that no inquiry data is stored and all inquiry data will be lost when I reload the page.",
    "temporaryChangesContact": "If you would like to save your inquiries, contact us at",
    "temporaryChangesDismiss": "Got it"
  },
  "navigation": {
    "breadcrumbLabel": "Open claim path",
    "addRoot": "Add a claim",
    "rootListLabel": "Claims",
    "openRootNamed": "Open claim: {root}"
  },
  "claim": {
    "currentCredibility": "Current credibility"
  },
  "diagram": {
    "prior": "Credibility before evidence",
    "current": "Credibility after evidence",
    "trajectoryAria": "Evidence updates connecting starting credibility upward to current credibility",
    "evidenceDisclosure": "Evidence",
    "combinedEvidence": "Combined evidence: {strength}",
    "hideEvidencePath": "Hide evidence path",
    "showEvidencePath": "Show evidence path",
    "priorLowerHandle": "Adjust the lower starting credibility bound",
    "priorUpperHandle": "Adjust the upper starting credibility bound",
    "resetPrior": "Reset credibility before evidence",
    "evidenceNumber": "Evidence {number}",
    "addDirectionalEvidence": "Add supporting or opposing evidence"
  },
  "strength": {
    "combinedNone": "No combined effect",
    "strengthSupport": "{strength} support",
    "strengthOpposition": "{strength} opposition",
    "strengthWidth": "Uncertainty changed",
    "strengthSupportDetail": "{strength} support ({amount})",
    "strengthOppositionDetail": "{strength} opposition ({amount})",
    "strengthWidthDetail": "Uncertainty change (Δσ {amount})",
    "strengthNone": "No current effect",
    "noAdditionalEffectShort": "No additional effect assigned"
  },
  "detail": {
    "evidenceDetails": "Evidence details",
    "closeEvidenceDetails": "Close evidence details",
    "basedOn": "Based on",
    "ifClaimIsTrue": "If",
    "currentImpactIntro": "The impact is therefore",
    "selectedEvidenceImpact": "Current impact of this evidence on the credibility of “{target}”",
    "credibilityInterval": "between {lower} and {upper}",
    "premiseWeightingSentence": "{claim} has credence {interval}, giving it a weight of {weight}.",
    "andGivenClaimCredibility": "And given that",
    "butGivenClaimCredibility": "But given that",
    "investigateClaimNamed": "Explore claim: {claim}",
    "inspectEvidence": "Inspect {source}",
    "removeEvidence": "Remove evidence"
  },
  "conditional": {
    "thenEvidenceStrength": "Then, this is {strength} evidence",
    "thenEvidenceNoDirection": "Then, this evidence has no directional effect",
    "conditionalMagnitude": "{strength} ({amount})",
    "conditionalBand": {
      "anecdotal": "Anecdotal",
      "weak": "Weak",
      "moderate": "Moderate",
      "strong": "Strong",
      "very_strong": "Very strong",
      "decisive": "Decisive"
    },
    "conditionalBandSentence": {
      "anecdotal": "anecdotal",
      "weak": "weak",
      "moderate": "moderate",
      "strong": "strong",
      "very_strong": "very strong",
      "decisive": "decisive"
    },
    "conditionalRelationOpposition": "against",
    "conditionalRelationSupport": "for",
    "conditionalRelationNeutral": "on",
    "conditionalRelationHeadingOpposition": "Against",
    "conditionalRelationHeadingSupport": "For",
    "conditionalRelationHeadingNeutral": "On",
    "conditionalScaleTick": "{strength}, {amount}",
    "adaptedJeffreysScale": "Adapted Jeffreys scale",
    "conditionalStrengthHandle": "Adjust the conditional evidence strength for “{target}”",
    "resetConditionalStrength": "Reset conditional evidence strength",
    "conditionalOpposition": "Opposition",
    "conditionalSupport": "Support",
    "directionalStrengthNone": "No directional effect (0 dBan)",
    "ifThisWereTrue": "Impact if this were true"
  },
  "form": {
    "requiredText": "Enter text without relying on spaces alone.",
    "invalidRelationship": "Choose a relationship that keeps the inquiry valid and acyclic.",
    "source": "Source",
    "sourceReference": "Name or reference",
    "sourceTitle": "Source title",
    "sourceUrl": "Source URL",
    "sourceUrlError": "Enter an http or https URL.",
    "sourceLocator": "Page, table, or locator (optional)",
    "premise": "Premise",
    "newPremise": "Create a new premise",
    "premiseAssertion": "Premise assertion",
    "useExistingPremise": "Use an existing premise",
    "premiseDescription": "Premise description",
    "addEvidence": "Add evidence",
    "editDetails": "Edit source",
    "save": "Save",
    "cancel": "Cancel",
    "rootAssertion": "Claim",
    "rootDescription": "Description"
  }
};
