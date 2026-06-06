import { analyzeLetterLocally, type AnalysisResult } from "../lib/analyzer";
import { getAIClient, getAIModel } from "../lib/aiClient";
import { buildCareClarityPrompt, CARECLARITY_SYSTEM_PROMPT } from "../lib/aiPrompt";
import { analysisRequestSchema, analysisResponseSchema, type AIAnalysisAttachment } from "../lib/analysisSchema";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

type AnalyzePayloadResult = {
  status: number;
  body: Partial<AnalysisResult> | { error: string };
};

type ZAIUserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { file_data: string; filename: string } };

export async function analyzePayload(payload: unknown): Promise<AnalyzePayloadResult> {
  const requestResult = analysisRequestSchema.safeParse(payload);

  if (!requestResult.success) {
    return {
      status: 400,
      body: { error: "Add letter text or upload a PDF/image before analysis." },
    };
  }

  const { letterText, attachments } = requestResult.data;
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
      return {
        status: 200,
        body: withFallback(fallbackResponse, "Z.AI returned an empty response."),
      };
    }

    const parsed = analysisResponseSchema.parse(parseAIJson(content));

    return {
      status: 200,
      body: {
        ...parsed,
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
