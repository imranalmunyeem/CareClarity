import type { SupportedTranslationLanguage, TranslationResponse } from "./translationSchema";

export function buildMockTranslationResponse(
  letterText: string,
  targetLanguage: SupportedTranslationLanguage,
): TranslationResponse {
  const preview = letterText.trim().replace(/\s+/g, " ").slice(0, 220);

  return {
    targetLanguage,
    translatedLetter:
      `Safe fallback translation for ${targetLanguage} is unavailable right now. ` +
      `Please use the original letter text and confirm important details with the service named in the letter. ` +
      `Original preview: ${preview || "No readable letter text was provided."}`,
    importantTerms: [
      {
        originalTerm: "appointment",
        translatedOrExplainedMeaning:
          "A booked time to attend, speak with, or contact the healthcare service. Check the exact date, time and place in the original letter.",
      },
      {
        originalTerm: "reception",
        translatedOrExplainedMeaning:
          "The desk or team you report to when you arrive, if the letter asks you to attend in person.",
      },
    ],
    translationNotes: [
      "Z.AI translation was unavailable, so CareClarity returned a safe fallback instead of guessing.",
      "Dates, times, phone numbers, clinic names and locations should be checked against the original letter.",
      "If any wording is unclear, ask the service named in the letter, a trusted interpreter or your healthcare team.",
    ],
    safetyNotice:
      "This tool translates and explains administrative information only and does not provide medical advice. For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.",
    confidence: "low",
  };
}
