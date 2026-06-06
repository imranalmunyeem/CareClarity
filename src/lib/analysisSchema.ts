import { z } from "zod";

const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,[A-Za-z0-9+/=]+$/i;

export const analysisAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  mimeType: z
    .string()
    .trim()
    .regex(/^(image\/[a-z0-9.+-]+|application\/pdf)$/i, "Only image and PDF files can be analyzed."),
  dataUrl: z.string().max(8_000_000).regex(DATA_URL_PATTERN, "Attachment must be a base64 data URL."),
  kind: z.enum(["image", "pdf"]),
});

export const analysisRequestSchema = z
  .object({
    letterText: z.string().trim().max(12000).optional().default(""),
    attachments: z.array(analysisAttachmentSchema).max(4).optional().default([]),
  })
  .refine((value) => value.letterText.length > 0 || value.attachments.length > 0, {
    message: "Add letter text or upload a PDF/image before analysis.",
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
export type AIAnalysisAttachment = z.infer<typeof analysisAttachmentSchema>;
export type AIAnalysisResponse = z.infer<typeof analysisResponseSchema>;
