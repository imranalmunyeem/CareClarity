import { z } from "zod";

const DEFAULT_ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/";
const DEFAULT_ZAI_MODEL = "glm-5.1";

const SAFETY_NOTES = [
  "This tool explains healthcare admin and prescription paperwork only. It does not give diagnosis, treatment or medication advice.",
  "Do not start, stop, change or ignore medicine based on this tool.",
  "Please confirm important details with your NHS team, GP practice or pharmacist.",
  "No account is needed and this prototype does not store letters, prescriptions or files in a database.",
  "For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.",
];

const analysisResponseSchema = z.object({
  summary: z.array(z.string().min(1)).min(1).max(5),
  details: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        evidence: z.string().optional(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(8),
  checklist: z
    .array(
      z.object({
        task: z.string().min(1),
        reason: z.string().optional(),
        timing: z.enum(["Before appointment", "On the day", "If needed", "As soon as possible"]),
      }),
    )
    .max(8),
  preparationNotes: z.array(z.string().min(1)).max(6),
  clinicianQuestions: z.array(z.string().min(1)).length(5),
  missingOrUnclear: z.array(z.string().min(1)).max(8),
  safetyNotes: z.array(z.string().min(1)).optional(),
});

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const letterText = String(request.body?.letterText ?? "").trim();
  if (!letterText) {
    return response.status(400).json({ error: "letterText is required" });
  }

  if (letterText.length > 12000) {
    return response.status(413).json({ error: "Letter text is too long for this demo" });
  }

  const mockResponse = buildMockResponse(letterText);
  const apiKey = process.env.ZAI_API_KEY;

  if (!apiKey) {
    return response.status(200).json(mockResponse);
  }

  try {
    const completion = await createZAIChatCompletion({
      apiKey,
      baseURL: process.env.ZAI_BASE_URL || DEFAULT_ZAI_BASE_URL,
      model: process.env.ZAI_MODEL || DEFAULT_ZAI_MODEL,
      letterText,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return response.status(200).json(mockResponse);
    }

    const parsed = analysisResponseSchema.parse(JSON.parse(content));

    return response.status(200).json({
      ...parsed,
      mode: "ai",
      generatedAt: new Date().toISOString(),
      safetyNotes: SAFETY_NOTES,
    });
  } catch {
    return response.status(200).json(mockResponse);
  }
}

async function createZAIChatCompletion({ apiKey, baseURL, model, letterText }) {
  const response = await fetch(new URL("chat/completions", normalizeBaseURL(baseURL)), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are CareClarity, a safe healthcare administration assistant for NHS-style letters and prescription paperwork. Explain admin content only. Do not diagnose, recommend medication, interpret medication suitability, tell users to ignore clinicians, or make clinical safety decisions. Return compact JSON only.",
        },
        {
          role: "user",
          content: buildPrompt(letterText),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Z.AI request failed with ${response.status}`);
  }

  return response.json();
}

function normalizeBaseURL(baseURL) {
  return baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
}

function buildPrompt(letterText) {
  return `Analyze this synthetic or user-provided NHS-style healthcare administration letter or prescription paperwork.

Return JSON with exactly these top-level keys:
- summary: array of 2 to 5 plain-English admin summary strings.
- details: array of objects with label, value, evidence and confidence. Confidence must be high, medium or low.
- checklist: array of objects with task, reason and timing. Timing must be one of: Before appointment, On the day, If needed, As soon as possible.
- preparationNotes: array of practical appointment/admin preparation strings.
- clinicianQuestions: exactly five safe admin-focused questions the patient can ask.
- missingOrUnclear: array of missing, uncertain or ambiguous admin details.
- safetyNotes: array of safety strings.

Rules:
- Focus on appointments, referrals, waiting-list admin, contact details, forms, prescription admin, preparation and travel/admin next steps.
- Prescription content is allowed only as paperwork/admin explanation. Never advise whether a medicine is right, safe, effective or suitable for the patient.
- Never tell the user to start, stop, change, increase, decrease, avoid or ignore medicine.
- Never give diagnosis, treatment advice, medication advice, interaction advice, dose advice or reassurance about symptoms.
- If medicine, dose, side-effect, interaction or treatment questions appear, say they should confirm with a pharmacist, GP practice, NHS team or 111/999 as appropriate.
- If information is missing, say it was not found. Do not invent dates, times, locations, names or phone numbers.
- Use this urgent-care distinction exactly if needed: For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.
- Do not ask the user to create an account or imply CareClarity stores data in a database.

Letter:
"""${letterText}"""`;
}

function buildMockResponse(letterText) {
  const text = letterText.trim();
  const lower = text.toLowerCase();
  const date = findDate(text);
  const time = findTime(text);
  const contact = findPhone(text);
  const reference = findReference(text);
  const location = findLocation(text);
  const prescriptionLike = isPrescriptionLike(lower);
  const type = prescriptionLike ? "Prescription admin paperwork" : "Healthcare admin paperwork";

  const details = [
    detail("Likely document type", type, undefined, "medium"),
    detail("Date", date, date, "high"),
    detail("Time", time, time, "high"),
    detail("Location or collection point", location, location, "medium"),
    detail("Contact number", contact, contact, "high"),
    detail("Reference", reference, reference, "high"),
  ].filter(Boolean);

  return {
    mode: "demo",
    generatedAt: new Date().toISOString(),
    summary: [
      `The document appears to be about ${type.toLowerCase()}.`,
      date || time || location
        ? `Key admin details found: ${[date, time, location].filter(Boolean).join(", ")}.`
        : "Some key admin details were not clearly found in the text.",
      prescriptionLike
        ? "CareClarity can explain prescription paperwork, but it cannot confirm whether a medicine, dose or treatment is right for you."
        : "CareClarity is explaining admin information only, not medical advice.",
    ],
    details,
    checklist: [
      {
        task: "Check any dates, times, locations, references and contact details against the original paperwork.",
        reason: "Important admin details should be confirmed before acting on them.",
        timing: "Before appointment",
      },
      {
        task: prescriptionLike
          ? "Ask your pharmacist, GP practice or NHS team about medicine, dose or label questions."
          : "Contact the service named in the paperwork if any admin detail is unclear.",
        reason: prescriptionLike
          ? "CareClarity cannot check medicine safety or suitability."
          : "The service can confirm missing or uncertain admin details.",
        timing: "As soon as possible",
      },
    ],
    preparationNotes: [
      "Keep the original paperwork available when contacting the service.",
      prescriptionLike
        ? "Do not change how you take medicine based on this tool."
        : "Write down any admin questions before contacting the service.",
    ],
    clinicianQuestions: [
      "Can you confirm the date, time, location or collection point shown in this paperwork?",
      "Is there anything I need to bring, complete or confirm before the next admin step?",
      "Who should I contact if I need to change an appointment or query prescription admin?",
      "What happens after this appointment, referral or prescription admin step?",
      "Is any information missing from my paperwork that I should check with the team?",
    ],
    missingOrUnclear: [
      prescriptionLike
        ? "Medicine suitability, dose changes, interactions and side-effect advice cannot be checked by this admin tool."
        : "Any missing or unclear admin details should be confirmed with the NHS team.",
    ],
    safetyNotes: SAFETY_NOTES,
  };
}

function detail(label, value, evidence, confidence) {
  return value ? { label, value, evidence, confidence } : null;
}

function findDate(text) {
  const monthNames =
    "january|february|march|april|may|june|july|august|september|october|november|december";
  const longDate = new RegExp(
    `\\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNames})\\s+\\d{4}\\b`,
    "i",
  );
  const shortDate = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
  return text.match(longDate)?.[0]?.trim() ?? text.match(shortDate)?.[0]?.trim();
}

function findTime(text) {
  const labelTime = text.match(/\btime:\s*([0-2]?\d[:.][0-5]\d\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
  const generalTime = text.match(/\b([0-2]?\d[:.][0-5]\d\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
  return labelTime?.[1]?.trim() ?? generalTime?.[1]?.trim();
}

function findPhone(text) {
  return text.match(/\b(?:0|\+44\s?)(?:\d[\s-]?){9,10}\b/)?.[0]?.trim();
}

function findReference(text) {
  const match = text.match(
    /\b(?:booking reference|referral reference|prescription reference|prescription number|hospital number|reference|ref|nhs number)\s*[:#-]?\s*([A-Z]{1,5}[-/]?[A-Z0-9]{3,}(?:[-/][A-Z0-9]+)?)\b/i,
  );
  return match?.[1]?.trim();
}

function findLocation(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^(location|collection point)\s*:/i.test(line))
    ?.replace(/^(location|collection point)\s*:\s*/i, "");
}

function isPrescriptionLike(lower) {
  return (
    lower.includes("prescription") ||
    lower.includes("prescribed medicine") ||
    lower.includes("medicine label") ||
    lower.includes("medication label") ||
    lower.includes("repeat medicine") ||
    lower.includes("repeat medication") ||
    lower.includes("pharmacy")
  );
}
