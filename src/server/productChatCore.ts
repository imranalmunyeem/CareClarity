import { getAIClient, getAIModel } from "../lib/aiClient";
import { buildMockProductChatResponse, buildProductChatRefusal } from "../lib/mockProductChatResponse";
import { buildProductChatPrompt, PRODUCT_CHAT_SYSTEM_PROMPT } from "../lib/productChatPrompt";
import { getUnsafeProductChatReason } from "../lib/productChatSafety";
import {
  productChatRequestSchema,
  productChatResponseSchema,
  type ProductChatResponse,
} from "../lib/productChatSchema";
import { NO_STORE_HEADERS, parseRequestBody } from "./analyzeCore";

type ProductChatPayloadResult = {
  status: number;
  body: ProductChatResponse | { error: string };
};

export { NO_STORE_HEADERS, parseRequestBody };

export async function productChatPayload(payload: unknown): Promise<ProductChatPayloadResult> {
  const requestResult = productChatRequestSchema.safeParse(payload);

  if (!requestResult.success) {
    return {
      status: 400,
      body: { error: "Ask a CareClarity product question before sending." },
    };
  }

  const { question, history } = requestResult.data;
  const refusalReason = getUnsafeProductChatReason(question);

  if (refusalReason) {
    return {
      status: 200,
      body: buildProductChatRefusal(refusalReason, question),
    };
  }

  const fallbackResponse = buildMockProductChatResponse(question);
  const client = getAIClient();

  if (!client) {
    return {
      status: 200,
      body: fallbackResponse,
    };
  }

  try {
    const completion = await client.createChatCompletion({
      model: getAIModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: PRODUCT_CHAT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildProductChatPrompt(question, history),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return {
        status: 200,
        body: fallbackResponse,
      };
    }

    const parsed = productChatResponseSchema.parse(parseAIJson(content));
    if (containsUnsafeProductChatOutput(parsed)) {
      return {
        status: 200,
        body: buildProductChatRefusal("The response crossed CareClarity safety boundaries.", question),
      };
    }

    return {
      status: 200,
      body: parsed,
    };
  } catch {
    return {
      status: 200,
      body: fallbackResponse,
    };
  }
}

function containsUnsafeProductChatOutput(response: ProductChatResponse): boolean {
  const text = Object.values(response).join(" ");

  return [
    /\byou should\s+(?:take|stop|start|change|increase|decrease|avoid)\b/i,
    /\b(?:take|stop|start|change|increase|decrease)\s+(?:your\s+)?(?:medicine|medication|dose|dosage)\b/i,
    /\byou\s+(?:definitely\s+)?(?:have|do not have)\s+(?:this\s+)?condition\b/i,
    /\bofficial\s+NHS\b/i,
    /\bNHS[-\s]?(?:endorsed|approved)\b/i,
    /\b(?:hack|phish|malware|ransomware|steal|fraud)\b/i,
  ].some((pattern) => pattern.test(text));
}

function parseAIJson(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}
