import { getAIClient, getAIModel } from "../lib/aiClient.js";
import { buildMockSentenceExplanation } from "../lib/mockSentenceExplanation.js";
import {
  explainSentenceRequestSchema,
  explainSentenceResponseSchema,
  type ExplainSentenceResponse,
} from "../lib/sentenceExplainerSchema.js";
import { NO_STORE_HEADERS, parseRequestBody } from "./analyzeCore.js";

type ExplainSentencePayloadResult = {
  status: number;
  body: ExplainSentenceResponse | { error: string };
};

const SENTENCE_SYSTEM_PROMPT =
  "You are CareClarity, a healthcare admin-only sentence explainer. Explain confusing paperwork wording in plain English. Do not diagnose, recommend treatment, give medication advice, suggest medication changes, or claim NHS endorsement. Return compact JSON only.";

export { NO_STORE_HEADERS, parseRequestBody };

export async function explainSentencePayload(payload: unknown): Promise<ExplainSentencePayloadResult> {
  const requestResult = explainSentenceRequestSchema.safeParse(payload);

  if (!requestResult.success) {
    return {
      status: 400,
      body: { error: "Paste one sentence from the letter before asking for an explanation." },
    };
  }

  const { sentence } = requestResult.data;
  const fallbackResponse = buildMockSentenceExplanation(sentence);
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
          content: SENTENCE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildSentencePrompt(sentence),
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

    const parsed = explainSentenceResponseSchema.parse(parseAIJson(content));
    if (containsUnsafeAdvice(parsed)) {
      return {
        status: 200,
        body: fallbackResponse,
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

function buildSentencePrompt(sentence: string): string {
  return `Explain this one sentence from healthcare admin paperwork.

Return JSON with exactly these keys:
- originalSentence
- plainEnglishMeaning
- whyItMatters
- actionIfAny
- safetyNotice

Rules:
- Explain admin meaning only.
- No diagnosis.
- No treatment advice.
- No medication advice.
- No medication changes.
- Do not claim official NHS endorsement.
- If the sentence asks about symptoms, medicines, diagnosis or treatment, explain that the user should ask their GP practice, pharmacist, NHS team, NHS 111 or 999 as appropriate.
- Keep the explanation concise and patient-friendly.

Sentence:
"""${sentence}"""`;
}

function parseAIJson(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

function containsUnsafeAdvice(response: ExplainSentenceResponse): boolean {
  const text = Object.values(response).join(" ");

  return [
    /\byou should\s+(?:take|stop|start|change|increase|decrease|avoid)\b/i,
    /\b(?:take|stop|start|change|increase|decrease)\s+(?:your\s+)?(?:medicine|medication|dose|dosage)\b/i,
    /\byou\s+(?:definitely\s+)?(?:have|do not have)\s+(?:this\s+)?condition\b/i,
    /\bofficial\s+NHS\b/i,
    /\bNHS[-\s]?(?:endorsed|approved)\b/i,
  ].some((pattern) => pattern.test(text));
}
