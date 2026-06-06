import { z } from "zod";

export const SUPPORTED_TRANSLATION_LANGUAGES = [
  "Bengali",
  "Urdu",
  "Arabic",
  "Polish",
  "Romanian",
  "Punjabi",
  "Hindi",
  "Gujarati",
  "Somali",
  "Spanish",
  "French",
  "Chinese",
  "Ukrainian",
] as const;

export const supportedTranslationLanguageSchema = z.enum(SUPPORTED_TRANSLATION_LANGUAGES);

export const translationRequestSchema = z.object({
  letterText: z.string().trim().min(30).max(12000),
  targetLanguage: supportedTranslationLanguageSchema,
});

export const translationSchema = z.object({
  targetLanguage: supportedTranslationLanguageSchema,
  translatedLetter: z.string().min(1),
  importantTerms: z
    .array(
      z.object({
        originalTerm: z.string().min(1),
        translatedOrExplainedMeaning: z.string().min(1),
      }),
    )
    .max(10),
  translationNotes: z.array(z.string().min(1)).max(8),
  safetyNotice: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});

export type SupportedTranslationLanguage = z.infer<typeof supportedTranslationLanguageSchema>;
export type TranslationRequest = z.infer<typeof translationRequestSchema>;
export type TranslationResponse = z.infer<typeof translationSchema>;
