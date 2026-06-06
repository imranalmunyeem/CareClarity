import type { ExplainSentenceResponse } from "./sentenceExplainerSchema";

export function buildMockSentenceExplanation(sentence: string): ExplainSentenceResponse {
  return {
    originalSentence: sentence,
    plainEnglishMeaning:
      "This sentence appears to be giving an admin instruction from the paperwork. Check the original letter for the exact date, place, team or contact detail it refers to.",
    whyItMatters:
      "It may affect what you need to bring, where you need to go, or who you should contact if something is unclear.",
    actionIfAny:
      "If the sentence names a form, appointment, contact number or deadline, keep that detail handy and confirm anything unclear with the service named in the letter.",
    safetyNotice:
      "CareClarity explains admin wording only. It does not provide diagnosis, treatment advice, medication advice or medication-change instructions.",
  };
}
