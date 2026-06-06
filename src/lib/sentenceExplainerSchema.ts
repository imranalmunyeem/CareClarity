import { z } from "zod";

export const explainSentenceRequestSchema = z.object({
  sentence: z.string().trim().min(8).max(1200),
});

export const explainSentenceResponseSchema = z.object({
  originalSentence: z.string().min(1),
  plainEnglishMeaning: z.string().min(1),
  whyItMatters: z.string().min(1),
  actionIfAny: z.string().min(1),
  safetyNotice: z.string().min(1),
});

export type ExplainSentenceRequest = z.infer<typeof explainSentenceRequestSchema>;
export type ExplainSentenceResponse = z.infer<typeof explainSentenceResponseSchema>;
