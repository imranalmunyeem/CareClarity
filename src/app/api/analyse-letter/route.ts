import { analyzeLetterLocally } from "../../../lib/analyzer";
import { getAIClient, getAIModel } from "../../../lib/aiClient";
import { buildCareClarityPrompt, CARECLARITY_SYSTEM_PROMPT } from "../../../lib/aiPrompt";
import { analysisRequestSchema, analysisResponseSchema } from "../../../lib/analysisSchema";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const requestResult = analysisRequestSchema.safeParse(body);

  if (!requestResult.success) {
    return json({ error: "Paste letter or prescription text before analysis." }, 400);
  }

  const { letterText } = requestResult.data;
  const mockResponse = analyzeLetterLocally(letterText);
  const client = getAIClient();

  if (!client) {
    return json(withFallback(mockResponse, "Z.AI is not configured."));
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
          content: buildCareClarityPrompt(letterText),
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return json(withFallback(mockResponse, "Z.AI returned an empty response."));
    }

    const parsed = analysisResponseSchema.parse(JSON.parse(content));

    return json({
      ...parsed,
      mode: "ai",
      source: "zai",
      generatedAt: new Date().toISOString(),
      safetyNotes: mockResponse.safetyNotes,
    });
  } catch {
    return json(withFallback(mockResponse, "Z.AI analysis was unavailable, so the safe demo analyzer was used."));
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function withFallback<T extends object>(mockResponse: T, fallbackReason: string): T & {
  fallbackReason: string;
  source: "mock";
} {
  return {
    ...mockResponse,
    source: "mock",
    fallbackReason,
  };
}
