import {
  explainSentenceResponseSchema,
  type ExplainSentenceResponse,
} from "./sentenceExplainerSchema";

export async function requestSentenceExplanation(sentence: string): Promise<ExplainSentenceResponse> {
  const response = await fetch("/api/explain-sentence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sentence }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Sentence explanation is unavailable right now.";
    throw new Error(message);
  }

  const payload = await response.json();
  return explainSentenceResponseSchema.parse(payload);
}
