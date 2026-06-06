const DEFAULT_ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/";
const DEFAULT_ZAI_MODEL = "glm-5.1";
const ZAI_REQUEST_TIMEOUT_MS = 8000;

type ZAIMessage = {
  role: "system" | "user";
  content: string | ZAIContentPart[];
};

type ZAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { file_data: string; filename: string } };

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ZAI_REQUEST_TIMEOUT_MS);

      const response = await fetch(new URL("chat/completions", normalizeBaseURL(baseURL)), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      try {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Z.AI authentication failed. Check ZAI_API_KEY.");
          }

          throw new Error(`Z.AI request failed with ${response.status}`);
        }

        return (await response.json()) as ZAICompletionResponse;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function getAIModel(): string {
  return process.env.ZAI_MODEL || DEFAULT_ZAI_MODEL;
}

function normalizeBaseURL(baseURL: string): string {
  const url = new URL(baseURL.endsWith("/") ? baseURL : `${baseURL}/`);

  if (url.protocol !== "https:" || url.hostname !== "api.z.ai") {
    throw new Error("ZAI_BASE_URL must point to https://api.z.ai/");
  }

  return url.toString();
}
