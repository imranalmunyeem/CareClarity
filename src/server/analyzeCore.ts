import { analyzeLetterLocally, type AnalysisResult } from "../lib/analyzer";
import { getAIClient, getAIModel } from "../lib/aiClient";
import { buildCareClarityPrompt, CARECLARITY_SYSTEM_PROMPT } from "../lib/aiPrompt";
import {
  analysisRequestSchema,
  analysisResponseSchema,
  letterTextAnalysisRequestSchema,
  safetyValidationSchema,
  type AIAnalysisAttachment,
  type AIAnalysisResponse,
  type SafetyValidation,
} from "../lib/analysisSchema";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type AnalyzePayloadResult = {
  status: number;
  body: Partial<AnalysisResult> | { error: string };
};

type AnalyzePayloadOptions = {
  requireLetterTextOnly?: boolean;
};

type ZAIUserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { file_data: string; filename: string } };

const MIN_LETTER_TEXT_LENGTH = 30;

const SAFETY_VALIDATION_SYSTEM_PROMPT =
  "You are CareClarity's safety validation layer. Check generated healthcare admin summaries for unsafe medical advice and unsupported official claims. Return compact JSON only.";

export async function analyzePayload(
  payload: unknown,
  options: AnalyzePayloadOptions = {},
): Promise<AnalyzePayloadResult> {
  const requestResult = options.requireLetterTextOnly
    ? letterTextAnalysisRequestSchema.safeParse(payload)
    : analysisRequestSchema.safeParse(payload);

  if (!requestResult.success) {
    return {
      status: 400,
      body: {
        error: options.requireLetterTextOnly
          ? "Add letter text before analysis."
          : "Add letter text or upload a PDF/image before analysis.",
      },
    };
  }

  const requestData = requestResult.data as { letterText: string; attachments?: AIAnalysisAttachment[] };
  const { letterText } = requestData;
  const attachments: AIAnalysisAttachment[] = options.requireLetterTextOnly ? [] : requestData.attachments ?? [];

  if (letterText.length > 0 && letterText.length < MIN_LETTER_TEXT_LENGTH && !attachments.length) {
    return {
      status: 400,
      body: { error: "Add more letter text before analysis." },
    };
  }

  const fallbackText = letterText || buildAttachmentFallbackText(attachments);
  const fallbackResponse = analyzeLetterLocally(fallbackText);
  const client = getAIClient();

  if (!client) {
    return {
      status: 200,
      body: withFallback(fallbackResponse, "Z.AI is not configured."),
    };
  }

  try {
    const analysis = await generateStructuredAnalysis({
      client,
      letterText,
      attachments,
    });
    const safetyValidation = await validateAnalysisSafety({
      client,
      letterText: fallbackText,
      analysis,
    });

    if (safetyValidation.status !== "SAFE") {
      return {
        status: 200,
        body: withFallback(fallbackResponse, "Z.AI safety validation marked the analysis as unsafe."),
      };
    }

    return {
      status: 200,
      body: {
        ...analysis,
        safetyValidation,
        mode: "ai",
        source: "zai",
        generatedAt: new Date().toISOString(),
        safetyNotes: fallbackResponse.safetyNotes,
      },
    };
  } catch (error) {
    return {
      status: 200,
      body: withFallback(fallbackResponse, buildFallbackReason(error)),
    };
  }
}

async function generateStructuredAnalysis({
  client,
  letterText,
  attachments,
}: {
  client: NonNullable<ReturnType<typeof getAIClient>>;
  letterText: string;
  attachments: AIAnalysisAttachment[];
}): Promise<AIAnalysisResponse> {
  const completion = await client.createChatCompletion({
    model: getAIModel(),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: CARECLARITY_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildZAIUserContent(letterText, attachments),
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Z.AI returned an empty response.");
  }

  return analysisResponseSchema.parse(parseAIJson(content));
}

async function validateAnalysisSafety({
  client,
  letterText,
  analysis,
}: {
  client: NonNullable<ReturnType<typeof getAIClient>>;
  letterText: string;
  analysis: AIAnalysisResponse;
}): Promise<SafetyValidation> {
  const completion = await client.createChatCompletion({
    model: getAIModel(),
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: SAFETY_VALIDATION_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildSafetyValidationPrompt(letterText, analysis),
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Z.AI safety validation returned an empty response.");
  }

  return safetyValidationSchema.parse(parseAIJson(content));
}

export function parseRequestBody(body: unknown): unknown {
  if (typeof body !== "string") {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function buildZAIUserContent(letterText: string, attachments: AIAnalysisAttachment[]): ZAIUserContentPart[] {
  const documentText =
    letterText ||
    "The user uploaded healthcare paperwork as an attachment. Read the attached file or image directly. If text is unreadable, say what is missing instead of guessing.";

  const prompt = [
    buildCareClarityPrompt(documentText),
    attachments.length
      ? `\nAttached files for analysis: ${attachments.map((file) => file.name).join(", ")}. Do not store or retain them.`
      : "",
  ].join("");

  return [
    { type: "text", text: prompt },
    ...attachments.map((attachment) =>
      attachment.kind === "image"
        ? {
            type: "image_url" as const,
            image_url: { url: attachment.dataUrl },
          }
        : {
            type: "file" as const,
            file: { file_data: attachment.dataUrl, filename: attachment.name },
          },
    ),
  ];
}

function buildAttachmentFallbackText(attachments: AIAnalysisAttachment[]): string {
  const names = attachments.map((attachment) => `${attachment.kind.toUpperCase()} ${attachment.name}`).join(", ");
  return `Uploaded healthcare paperwork attachment: ${names || "file"}`;
}

function buildSafetyValidationPrompt(letterText: string, analysis: AIAnalysisResponse): string {
  return `Review this generated CareClarity admin analysis before it is shown to a patient.

Return JSON with exactly these keys:
- status: "SAFE" or "UNSAFE"
- issuesFound: array of strings
- safetyNotice: string

Mark status as UNSAFE if the analysis contains any of the following:
- diagnosis or ruling out a diagnosis
- medication advice, prescribing advice, dose advice or medication-change instructions
- treatment recommendation
- unsafe reassurance about symptoms, risk, severity or urgency
- claim that CareClarity is official NHS, NHS-endorsed, NHS-approved or replacing NHS advice

Keep the standard admin-only boundary:
- no diagnosis
- no prescribing
- no treatment advice
- no medication changes
- no claim of NHS endorsement

If the analysis is admin-only and uses appropriate safety boundaries, return SAFE.
Do not rewrite the analysis. Do not include the original letter text in your response.

Original letter context is provided only for safety checking:
"""${letterText}"""

Generated analysis:
${JSON.stringify(analysis)}`;
}

function parseAIJson(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenceMatch?.[1] ?? trimmed);
}

function buildFallbackReason(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "Z.AI timed out, so a safe fallback result was used.";
    }

    if (error.message.includes("authentication failed")) {
      return "Z.AI authentication failed. Check ZAI_API_KEY.";
    }
  }

  return "Z.AI analysis was unavailable, so a safe fallback result was used.";
}

function withFallback(response: AnalysisResult, fallbackReason: string): AnalysisResult {
  return {
    ...response,
    mode: "fallback",
    source: "mock",
    fallbackReason,
  };
}
