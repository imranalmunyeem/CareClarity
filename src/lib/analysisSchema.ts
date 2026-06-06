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

export const letterTextAnalysisRequestSchema = z.object({
  letterText: z.string().trim().min(1).max(12000),
});

export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const actionChecklistItemSchema = z.object({
  task: z.string().min(1),
  reason: z.string().optional(),
  timing: z.enum(["Before appointment", "On the day", "If needed", "As soon as possible"]),
});

export const structuredInformationExtractionSchema = z.object({
  letterType: z.string().min(1),
  departmentOrClinic: z.string().min(1),
  appointmentDate: z.string().min(1),
  appointmentTime: z.string().min(1),
  location: z.string().min(1),
  contactInfo: z.string().min(1),
  namedClinicianOrTeam: z.string().min(1),
  actionRequired: z.string().min(1),
});

export const safetyValidationSchema = z.object({
  status: z.enum(["SAFE", "UNSAFE"]),
  issuesFound: z.array(z.string().min(1)).max(8),
  safetyNotice: z.string().min(1),
});

export const analysisResponseSchema = z.object({
  structuredInformationExtraction: structuredInformationExtractionSchema,
  plainEnglishTranslation: z.string().min(1),
  actionChecklist: z.array(actionChecklistItemSchema).min(1).max(8),
  appointmentPreparationGuidance: z.array(z.string().min(1)).max(6),
  clinicianQuestions: z.array(z.string().min(1)).length(5),
  waitingOrReferralGuidance: z.array(z.string().min(1)).max(6),
  missingOrUncertainInformation: z.array(z.string().min(1)).max(8),
  safetyValidation: safetyValidationSchema,
  patientDashboardSummary: z.string().min(1),
  confidence: confidenceSchema,
});

export type AIAnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type LetterTextAnalysisRequest = z.infer<typeof letterTextAnalysisRequestSchema>;
export type AIAnalysisAttachment = z.infer<typeof analysisAttachmentSchema>;
export type AIActionChecklistItem = z.infer<typeof actionChecklistItemSchema>;
export type StructuredInformationExtraction = z.infer<typeof structuredInformationExtractionSchema>;
export type SafetyValidation = z.infer<typeof safetyValidationSchema>;
export type AIAnalysisResponse = z.infer<typeof analysisResponseSchema>;
