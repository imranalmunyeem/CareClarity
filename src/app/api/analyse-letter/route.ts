import { analyzeLetterLocally } from "../../../lib/analyzer";
import { getAIClient, getAIModel } from "../../../lib/aiClient";
import { buildCareClarityPrompt, CARECLARITY_SYSTEM_PROMPT } from "../../../lib/aiPrompt";
import { analysisResponseSchema } from "../../../lib/analysisSchema";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const letterText = typeof body?.letterText === "string" ? body.letterText.trim() : "";

  if (!letterText) {
    return Response.json({ error: "letterText is required" }, { status: 400 });
  }

  const mockResponse = analyzeLetterLocally(letterText);
  const client = getAIClient();

  if (!client) {
    return Response.json(mockResponse);
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
      return Response.json(mockResponse);
    }

    const parsed = analysisResponseSchema.parse(JSON.parse(content));

    return Response.json({
      ...parsed,
      mode: "ai",
      generatedAt: new Date().toISOString(),
      safetyNotes: mockResponse.safetyNotes,
    });
  } catch {
    return Response.json(mockResponse);
  }
}
