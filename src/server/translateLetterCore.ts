import { getAIClient, getAIModel } from "../lib/aiClient";
import { buildMockTranslationResponse } from "../lib/mockTranslationResponse";
import { buildTranslationPrompt, TRANSLATION_SYSTEM_PROMPT } from "../lib/translationPrompt";
import {
  translationRequestSchema,
  translationSchema,
  type TranslationResponse,
} from "../lib/translationSchema";
import { NO_STORE_HEADERS, parseRequestBody } from "./analyzeCore";

type TranslateLetterPayloadResult = {
  status: number;
  body: TranslationResponse | { error: string };
};

export { NO_STORE_HEADERS, parseRequestBody };

export async function translateLetterPayload(payload: unknown): Promise<TranslateLetterPayloadResult> {
  const requestResult = translationRequestSchema.safeParse(payload);

  if (!requestResult.success) {
    return {
      status: 400,
      body: { error: "Add enough letter text and choose a supported language before translation." },
    };
  }

  const { letterText, targetLanguage } = requestResult.data;
  const fallbackResponse = buildMockTranslationResponse(letterText, targetLanguage);
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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: TRANSLATION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildTranslationPrompt(letterText, targetLanguage),
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

    const parsed = translationSchema.parse({
      ...(parseAIJson(content) as object),
      targetLanguage,
    });

    if (containsUnsafeTranslationAdvice(parsed)) {
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

function parseAIJson(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

function containsUnsafeTranslationAdvice(response: TranslationResponse): boolean {
  const text = [
    response.translatedLetter,
    ...response.importantTerms.map((term) => `${term.originalTerm} ${term.translatedOrExplainedMeaning}`),
    ...response.translationNotes,
    response.safetyNotice,
  ].join(" ");

  return [
    /\byou should\s+(?:take|stop|start|change|increase|decrease|avoid)\b/i,
    /\b(?:take|stop|start|change|increase|decrease)\s+(?:your\s+)?(?:medicine|medication|dose|dosage)\b/i,
    /\byou\s+(?:definitely\s+)?(?:have|do not have)\s+(?:this\s+)?condition\b/i,
    /\bofficial\s+NHS\b/i,
    /\bNHS[-\s]?(?:endorsed|approved)\b/i,
  ].some((pattern) => pattern.test(text));
}
