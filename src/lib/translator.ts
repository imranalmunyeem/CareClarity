import {
  translationSchema,
  type SupportedTranslationLanguage,
  type TranslationResponse,
} from "./translationSchema";

export async function requestLetterTranslation(
  letterText: string,
  targetLanguage: SupportedTranslationLanguage,
): Promise<TranslationResponse> {
  const response = await fetch("/api/translate-letter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ letterText, targetLanguage }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Translation is unavailable right now.";
    throw new Error(message);
  }

  const payload = await response.json();
  return translationSchema.parse(payload);
}
