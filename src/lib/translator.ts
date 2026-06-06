import {
  translationSchema,
  type SupportedTranslationLanguage,
  type TranslationResponse,
} from "./translationSchema";
import { buildMockTranslationResponse } from "./mockTranslationResponse";

export async function requestLetterTranslation(
  letterText: string,
  targetLanguage: SupportedTranslationLanguage,
): Promise<TranslationResponse> {
  try {
    const response = await fetch("/api/translate-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ letterText, targetLanguage }),
    });

    if (!response.ok) {
      return buildMockTranslationResponse(letterText, targetLanguage);
    }

    const payload = await response.json();
    return translationSchema.parse(payload);
  } catch {
    return buildMockTranslationResponse(letterText, targetLanguage);
  }
}
