import { z } from "zod";

export const analysisRequestSchema = z.object({
  letterText: z.string().trim().min(1).max(12000),
});

export const analysisResponseSchema = z.object({
  summary: z.array(z.string().min(1)).min(1).max(5),
  details: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        evidence: z.string().optional(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(8),
  checklist: z
    .array(
      z.object({
        task: z.string().min(1),
        reason: z.string().optional(),
        timing: z.enum(["Before appointment", "On the day", "If needed", "As soon as possible"]),
      }),
    )
    .max(8),
  preparationNotes: z.array(z.string().min(1)).max(6),
  clinicianQuestions: z.array(z.string().min(1)).length(5),
  missingOrUnclear: z.array(z.string().min(1)).max(8),
  safetyNotes: z.array(z.string().min(1)).optional(),
});

export type AIAnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AIAnalysisResponse = z.infer<typeof analysisResponseSchema>;
