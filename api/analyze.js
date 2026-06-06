const SAFETY_NOTES = [
  "This tool explains admin information only and does not give medical advice.",
  "Please confirm important details with your NHS team.",
  "For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.",
];

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({ error: "AI endpoint is not configured" });
  }

  const letterText = String(request.body?.letterText ?? "").trim();
  if (!letterText) {
    return response.status(400).json({ error: "letterText is required" });
  }

  if (letterText.length > 12000) {
    return response.status(413).json({ error: "Letter text is too long for this demo" });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are CareClarity, a safe healthcare administration assistant for NHS-style letters. Explain admin content only. Do not diagnose, recommend medication, tell users to ignore clinicians, or make clinical safety decisions. Return compact JSON only.",
          },
          {
            role: "user",
            content: buildPrompt(letterText),
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return response.status(502).json({ error: "AI provider error", detail: errorText.slice(0, 500) });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return response.status(200).json({
      ...parsed,
      mode: "ai",
      generatedAt: new Date().toISOString(),
      safetyNotes: SAFETY_NOTES,
    });
  } catch (error) {
    return response.status(500).json({
      error: "Analysis failed",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function buildPrompt(letterText) {
  return `Analyze this synthetic or user-provided NHS-style healthcare administration letter.

Return JSON with exactly these top-level keys:
- summary: array of 2 to 5 plain-English admin summary strings.
- details: array of objects with label, value, evidence and confidence. Confidence must be high, medium or low.
- checklist: array of objects with task, reason and timing. Timing must be one of: Before appointment, On the day, If needed, As soon as possible.
- preparationNotes: array of practical appointment/admin preparation strings.
- clinicianQuestions: exactly five safe admin-focused questions the patient can ask.
- missingOrUnclear: array of missing, uncertain or ambiguous admin details.
- safetyNotes: array of safety strings.

Rules:
- Focus on appointments, referrals, waiting-list admin, contact details, forms, preparation and travel/admin next steps.
- Never give diagnosis, treatment advice, medication advice or reassurance about symptoms.
- If information is missing, say it was not found. Do not invent dates, times, locations, names or phone numbers.
- Use this urgent-care distinction exactly if needed: For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.

Letter:
"""${letterText}"""`;
}
