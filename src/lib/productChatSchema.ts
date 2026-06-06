import { z } from "zod";

export const productChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});

export const productChatRequestSchema = z.object({
  question: z.string().trim().min(3).max(1200),
  history: z.array(productChatMessageSchema).max(8).optional().default([]),
});

export const productChatResponseSchema = z.object({
  answer: z.string().min(1),
  language: z.string().min(1),
  refused: z.boolean(),
  reason: z.string().optional(),
  suggestedNextStep: z.string().min(1),
  safetyNotice: z.string().min(1),
});

export type ProductChatMessage = z.infer<typeof productChatMessageSchema>;
export type ProductChatRequest = z.infer<typeof productChatRequestSchema>;
export type ProductChatResponse = z.infer<typeof productChatResponseSchema>;
