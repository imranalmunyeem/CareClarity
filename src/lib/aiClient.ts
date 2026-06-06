const DEFAULT_ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/";
const DEFAULT_ZAI_MODEL = "glm-5.1";

type ZAIMessage = {
  role: "system" | "user";
  content: string;
};

type ZAICompletionRequest = {
  model: string;
  temperature: number;
  response_format: { type: "json_object" };
  messages: ZAIMessage[];
};

type ZAICompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export type ZAIClient = {
  createChatCompletion(request: ZAICompletionRequest): Promise<ZAICompletionResponse>;
};

export function getAIClient(): ZAIClient | null {
  const apiKey = process.env.ZAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const baseURL = process.env.ZAI_BASE_URL || DEFAULT_ZAI_BASE_URL;

  return {
    async createChatCompletion(request) {
      const response = await fetch(new URL("chat/completions", normalizeBaseURL(baseURL)), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Z.AI request failed with ${response.status}`);
      }

      return (await response.json()) as ZAICompletionResponse;
    },
  };
}

export function getAIModel(): string {
  return process.env.ZAI_MODEL || DEFAULT_ZAI_MODEL;
}

function normalizeBaseURL(baseURL: string): string {
  return baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
}
