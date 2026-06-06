import OpenAI from "openai";

const DEFAULT_ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/";
const DEFAULT_ZAI_MODEL = "glm-5.1";

export function getAIClient(): OpenAI | null {
  const apiKey = process.env.ZAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.ZAI_BASE_URL || DEFAULT_ZAI_BASE_URL,
  });
}

export function getAIModel(): string {
  return process.env.ZAI_MODEL || DEFAULT_ZAI_MODEL;
}
