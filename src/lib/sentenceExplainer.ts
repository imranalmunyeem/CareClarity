import {
  explainSentenceResponseSchema,
  type ExplainSentenceResponse,
} from "./sentenceExplainerSchema";
import { buildMockSentenceExplanation } from "./mockSentenceExplanation";

export async function requestSentenceExplanation(sentence: string): Promise<ExplainSentenceResponse> {
  try {
    const response = await fetch("/api/explain-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence }),
    });

    if (!response.ok) {
      return buildMockSentenceExplanation(sentence);
    }

    const payload = await response.json();
    return explainSentenceResponseSchema.parse(payload);
  } catch {
    return buildMockSentenceExplanation(sentence);
  }
}
