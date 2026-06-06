import type { AIAnalysisAttachment } from "./analysisSchema";

export type AnalysisMode = "ai" | "fallback";
export type Confidence = "high" | "medium" | "low";

export interface AdminDetail {
  label: string;
  value: string;
  evidence?: string;
  confidence: Confidence;
}

export interface ActionItem {
  task: string;
  reason?: string;
  timing: "Before appointment" | "On the day" | "If needed" | "As soon as possible";
}

export interface AnalysisResult {
  mode: AnalysisMode;
  source?: "zai" | "mock";
  fallbackReason?: string;
  generatedAt: string;
  summary: string[];
  details: AdminDetail[];
  checklist: ActionItem[];
  preparationNotes: string[];
  clinicianQuestions: string[];
  missingOrUnclear: string[];
  safetyNotes: string[];
}

const SAFETY_NOTES = [
  "This tool explains healthcare admin and prescription paperwork only. It does not give diagnosis, treatment or medication advice.",
  "Do not start, stop, change or ignore medicine based on this tool.",
  "Please confirm important details with your NHS team, GP practice or pharmacist.",
  "No account is needed and this prototype does not store letters, prescriptions or files in a database.",
  "For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.",
];

const DEFAULT_QUESTIONS = [
  "Can you confirm the date, time, location or collection point shown in this paperwork?",
  "Is there anything I need to bring, complete or confirm before the next admin step?",
  "Who should I contact if I need to change an appointment or query prescription admin?",
  "What happens after this appointment, referral or prescription admin step?",
  "Is any information missing from my paperwork that I should check with the team?",
];

const UNSAFE_OUTPUT_PATTERNS = [
  /\byou should\s+(?:take|stop|start|change|increase|decrease|avoid)\b/i,
  /\b(?:take|stop|start|change|increase|decrease)\s+(?:your\s+)?(?:medicine|medication|dose|dosage)\b/i,
  /\b(?:ignore|disregard)\s+(?:this|the)\s+(?:letter|doctor|clinician|pharmacist|advice)\b/i,
  /\byou\s+(?:definitely\s+)?(?:have|do not have)\s+(?:this\s+)?condition\b/i,
  /\byou do not need to\s+(?:attend|see|contact|speak to)\b/i,
];

const SAFE_REPLACEMENT =
  "This point needs clinical judgement, so please confirm it with your NHS team, GP practice or pharmacist.";

export async function requestAnalysis(
  letterText: string,
  attachments: AIAnalysisAttachment[] = [],
): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 18000);
  const fallbackText = letterText || buildAttachmentFallbackText(attachments);

  try {
    const response = await requestServerAnalysis(letterText, attachments, controller.signal);

    if (!response) {
      throw new Error("Analysis endpoint unavailable");
    }

    return normalizeAnalysis(response, response.mode === "fallback" ? "fallback" : "ai", fallbackText);
  } catch {
    return analyzeLetterLocally(fallbackText);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestServerAnalysis(
  letterText: string,
  attachments: AIAnalysisAttachment[],
  signal: AbortSignal,
): Promise<Partial<AnalysisResult> | null> {
  const endpoints = ["/api/analyse-letter", "/api/analyze"];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ letterText, attachments }),
      signal,
    });

    if (!response.ok) {
      continue;
    }

    try {
      return (await response.json()) as Partial<AnalysisResult>;
    } catch {
      continue;
    }
  }

  return null;
}

export function analyzeLetterLocally(letterText: string): AnalysisResult {
  const text = letterText.trim();
  const lower = text.toLowerCase();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const details: AdminDetail[] = [];
  const date = findDate(text);
  const time = findTime(text);
  const location = findLocation(lines);
  const contact = findPhone(text);
  const reference = findReference(text);
  const service = findService(lines, text);
  const appointmentType = inferLetterType(lower);

  addDetail(details, "Likely letter type", appointmentType, undefined, "medium");
  addDetail(details, "Date", date, findEvidence(lines, date), "high");
  addDetail(details, "Time", time, findEvidence(lines, time), "high");
  addDetail(details, "Location", cleanLabelPrefix(location), location, "medium");
  addDetail(details, "Service or team", cleanLabelPrefix(service), service, "medium");
  addDetail(details, "Contact number", contact, findEvidence(lines, contact), "high");
  addDetail(details, "Reference", reference, findEvidence(lines, reference), "high");

  const checklist = buildChecklist(lower, { date, time, location, contact, reference });
  const preparationNotes = buildPreparationNotes(lower);
  const missingOrUnclear = buildMissingList({ date, time, location, contact, reference }, lower);
  const summary = buildSummary(appointmentType, { date, time, location, contact }, lower);

  return {
    mode: "fallback",
    generatedAt: new Date().toISOString(),
    summary,
    details,
    checklist,
    preparationNotes,
    clinicianQuestions: DEFAULT_QUESTIONS,
    missingOrUnclear,
    safetyNotes: SAFETY_NOTES,
  };
}

function normalizeAnalysis(
  payload: Partial<AnalysisResult>,
  mode: AnalysisMode,
  fallbackText: string,
): AnalysisResult {
  const local = analyzeLetterLocally(fallbackText);

  return {
    mode,
    generatedAt: new Date().toISOString(),
    summary: cleanStringArray(payload.summary, local.summary).slice(0, 5),
    details: cleanDetails(payload.details, local.details),
    checklist: cleanChecklist(payload.checklist, local.checklist),
    preparationNotes: cleanStringArray(payload.preparationNotes, local.preparationNotes).slice(0, 6),
    clinicianQuestions: cleanStringArray(payload.clinicianQuestions, DEFAULT_QUESTIONS).slice(0, 5),
    missingOrUnclear: cleanStringArray(payload.missingOrUnclear, local.missingOrUnclear).slice(0, 8),
    safetyNotes: SAFETY_NOTES,
    source: payload.source === "zai" ? "zai" : mode === "ai" ? "zai" : "mock",
    fallbackReason: typeof payload.fallbackReason === "string" ? payload.fallbackReason : undefined,
  };
}

function buildAttachmentFallbackText(attachments: AIAnalysisAttachment[]): string {
  if (!attachments.length) return "Uploaded healthcare paperwork";
  return `Uploaded healthcare paperwork attachment: ${attachments.map((attachment) => attachment.name).join(", ")}`;
}

function buildSummary(
  appointmentType: string,
  facts: { date?: string; time?: string; location?: string; contact?: string },
  lower: string,
): string[] {
  const first = `The letter appears to be about ${appointmentType.toLowerCase()}.`;
  const detailParts = [
    facts.date ? `date: ${facts.date}` : "",
    facts.time ? `time: ${facts.time}` : "",
    facts.location ? `place: ${cleanLabelPrefix(facts.location)}` : "",
  ].filter(Boolean);

  const summary = [
    first,
    detailParts.length
      ? `The key appointment details found were ${detailParts.join(", ")}.`
      : "Some key appointment details were not clearly found in the letter.",
  ];

  if (lower.includes("cannot attend") || lower.includes("unable to attend") || lower.includes("rearrange")) {
    summary.push(
      facts.contact
        ? `If you cannot attend, the letter gives this contact number: ${facts.contact}.`
        : "The letter mentions changing or rearranging, but no clear contact number was found.",
    );
  }

  if (lower.includes("waiting list") || lower.includes("wait")) {
    summary.push("The letter appears to be giving an update about waiting-list or referral admin.");
  }

  if (isPrescriptionLike(lower)) {
    summary.push(
      "The document appears to include prescription or medicine-related admin. CareClarity can explain the paperwork, but it cannot confirm whether a medicine, dose or treatment is right for you.",
    );
  }

  return summary;
}

function buildChecklist(
  lower: string,
  facts: { date?: string; time?: string; location?: string; contact?: string; reference?: string },
): ActionItem[] {
  const items: ActionItem[] = [];

  if (facts.date || facts.time || facts.location) {
    items.push({
      task: "Check the date, time and location before making travel plans.",
      reason: "These are the main admin details needed to attend correctly.",
      timing: "Before appointment",
    });
  } else {
    items.push({
      task: "Contact the service to confirm the appointment date, time and location.",
      reason: "The letter text did not show all of these details clearly.",
      timing: "As soon as possible",
    });
  }

  if (lower.includes("bring")) {
    items.push({
      task: "Bring the items named in the letter.",
      reason: "The letter asks you to take specific documents or information.",
      timing: "On the day",
    });
  }

  if (lower.includes("form")) {
    items.push({
      task: "Complete any forms mentioned in the letter.",
      reason: "Incomplete forms can delay appointment admin.",
      timing: "Before appointment",
    });
  }

  if (lower.includes("cannot attend") || lower.includes("unable to attend") || lower.includes("rearrange")) {
    items.push({
      task: facts.contact
        ? `Use ${facts.contact} if you need to rearrange or cannot attend.`
        : "Use the contact details in the letter if you need to rearrange or cannot attend.",
      reason: "The appointment slot may be offered to another patient.",
      timing: "If needed",
    });
  }

  if (lower.includes("waiting list") || lower.includes("referral")) {
    items.push({
      task: "Keep the referral reference and wait-time information somewhere easy to find.",
      reason: "It can help when asking the service about referral admin.",
      timing: "Before appointment",
    });
  }

  if (lower.includes("fast") || lower.includes("blood test") || lower.includes("test")) {
    items.push({
      task: "Confirm any test preparation instructions that are unclear.",
      reason: "The app cannot safely infer missing preparation details.",
      timing: "Before appointment",
    });
  }

  if (isPrescriptionLike(lower)) {
    items.push({
      task: "Ask your pharmacist, GP practice or NHS team about any medicine, dose or label questions.",
      reason: "CareClarity can explain prescription admin, but cannot check medicine safety or suitability.",
      timing: "As soon as possible",
    });
  }

  if (facts.reference) {
    items.push({
      task: `Save the reference number: ${facts.reference}.`,
      reason: "Reference numbers help the service find your booking or referral.",
      timing: "Before appointment",
    });
  }

  return dedupeActions(items).slice(0, 7);
}

function buildPreparationNotes(lower: string): string[] {
  const notes = [
    "Keep the letter available on the day, either printed or on your phone.",
    "Write down any admin questions before contacting the service.",
  ];

  if (lower.includes("medicine") || lower.includes("medication")) {
    notes.push("Keep the medication list or prescription paperwork available when speaking to the NHS team or pharmacist.");
  }

  if (lower.includes("photo id") || lower.includes("identification")) {
    notes.push("Take photo ID if you have it and the letter asks for it.");
  }

  if (lower.includes("arrive")) {
    notes.push("Allow enough time to arrive by the time stated in the letter.");
  }

  if (lower.includes("fast")) {
    notes.push("Check the fasting instruction with the service if the letter does not clearly say how long.");
  }

  if (isPrescriptionLike(lower)) {
    notes.push("Do not change how you take medicine based on this tool; check unclear prescription details with a pharmacist or clinician.");
  }

  return notes.slice(0, 6);
}

function buildMissingList(
  facts: { date?: string; time?: string; location?: string; contact?: string; reference?: string },
  lower: string,
): string[] {
  const missing: string[] = [];
  const appointmentLike = lower.includes("appointment") || lower.includes("test") || lower.includes("clinic");
  const referralLike = lower.includes("referral") || lower.includes("waiting list");
  const prescriptionLike = isPrescriptionLike(lower);

  if (!facts.date && (appointmentLike || referralLike)) {
    missing.push("No clear appointment or referral date was found.");
  }
  if (!facts.time && appointmentLike) {
    missing.push("No clear appointment time was found.");
  }
  if (!facts.location && appointmentLike) {
    missing.push("No clear appointment location was found.");
  }
  if (!facts.contact && !prescriptionLike) missing.push("No clear contact phone number was found.");
  if (!facts.reference) missing.push("No booking, hospital, referral or prescription reference was found.");
  if (lower.includes("may need to fast") || lower.includes("might need to fast")) {
    missing.push("The fasting instruction appears uncertain and should be confirmed.");
  }
  if (prescriptionLike) {
    missing.push(
      "Medicine suitability, dose changes, interactions and side-effect advice cannot be checked by this admin tool.",
    );
  }

  if (!missing.length) {
    missing.push("No obvious missing admin details were detected, but important details should still be confirmed with the NHS team.");
  }

  return missing;
}

function inferLetterType(lower: string): string {
  if (isPrescriptionLike(lower)) return "Prescription admin paperwork";
  if (lower.includes("waiting list")) return "Referral waiting-list update";
  if (lower.includes("referral")) return "Referral admin message";
  if (lower.includes("blood test") || lower.includes("diagnostic") || lower.includes("test")) {
    return "Test appointment instructions";
  }
  if (lower.includes("outpatient") || lower.includes("clinic") || lower.includes("appointment")) {
    return "Healthcare appointment letter";
  }
  return "Healthcare admin letter";
}

function findDate(text: string): string | undefined {
  const monthNames =
    "january|february|march|april|may|june|july|august|september|october|november|december";
  const longDate = new RegExp(
    `\\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNames})\\s+\\d{4}\\b`,
    "i",
  );
  const shortDate = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
  return text.match(longDate)?.[0]?.trim() ?? text.match(shortDate)?.[0]?.trim();
}

function findTime(text: string): string | undefined {
  const labelTime = text.match(/\btime:\s*([0-2]?\d[:.][0-5]\d\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
  const generalTime = text.match(/\b([0-2]?\d[:.][0-5]\d\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
  return labelTime?.[1]?.trim() ?? generalTime?.[1]?.trim();
}

function findPhone(text: string): string | undefined {
  return text.match(/\b(?:0|\+44\s?)(?:\d[\s-]?){9,10}\b/)?.[0]?.trim();
}

function findReference(text: string): string | undefined {
  const match = text.match(
    /\b(?:booking reference|referral reference|prescription reference|prescription number|hospital number|reference|ref|nhs number)\s*[:#-]?\s*([A-Z]{1,5}[-/]?[A-Z0-9]{3,}(?:[-/][A-Z0-9]+)?)\b/i,
  );
  return match?.[1]?.trim();
}

function findLine(lines: string[], pattern: RegExp): string | undefined {
  return lines.find((line) => pattern.test(line));
}

function findLocation(lines: string[]): string | undefined {
  const explicit = lines.find((line) => /^(location|collection point)\s*:/i.test(line));
  if (explicit) return explicit;

  return lines.find((line) =>
    /\b(level|wing|hospital|centre|center|road|street|avenue|approach|drive|lane|postcode|[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2})\b/i.test(
      line,
    ),
  );
}

function findService(lines: string[], text: string): string | undefined {
  const withClinic = text.match(/\bwith\s+(?:the\s+)?([A-Z][A-Za-z\s&-]+(?:Clinic|Service|Department|Team|Centre|Center|Unit))\b/);
  if (withClinic?.[1]) return withClinic[1].trim();

  return findLine(lines, /(clinic|service|department|team|diagnostic|referral|pharmacy)/i);
}

function findEvidence(lines: string[], value?: string): string | undefined {
  if (!value) return undefined;
  return lines.find((line) => line.toLowerCase().includes(value.toLowerCase()));
}

function addDetail(
  details: AdminDetail[],
  label: string,
  value: string | undefined,
  evidence: string | undefined,
  confidence: Confidence,
) {
  if (!value) return;
  const normalized = value.trim();
  if (!normalized) return;
  if (details.some((detail) => detail.label === label && detail.value === normalized)) return;
  details.push({ label, value: normalized, evidence, confidence });
}

function cleanLabelPrefix(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .replace(
      /^(appointment date|date|time|location|collection point|hospital number|booking reference|referral reference|prescription reference):\s*/i,
      "",
    )
    .trim();
}

function dedupeActions(items: ActionItem[]): ActionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.task.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => (typeof item === "string" ? sanitizeUserFacingText(item) : ""))
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function cleanDetails(value: unknown, fallback: AdminDetail[]): AdminDetail[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned: AdminDetail[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const maybe = item as Partial<AdminDetail>;
    if (!maybe.label || !maybe.value) continue;
    cleaned.push({
      label: sanitizeUserFacingText(String(maybe.label)),
      value: sanitizeUserFacingText(String(maybe.value)),
      evidence: maybe.evidence ? sanitizeUserFacingText(String(maybe.evidence)) : undefined,
      confidence: isConfidence(maybe.confidence) ? maybe.confidence : "medium",
    });
  }

  return cleaned.length ? cleaned.slice(0, 8) : fallback;
}

function cleanChecklist(value: unknown, fallback: ActionItem[]): ActionItem[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned: ActionItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const maybe = item as Partial<ActionItem>;
    if (!maybe.task) continue;
    cleaned.push({
      task: sanitizeUserFacingText(String(maybe.task)),
      reason: maybe.reason ? sanitizeUserFacingText(String(maybe.reason)) : undefined,
      timing: isTiming(maybe.timing) ? maybe.timing : "Before appointment",
    });
  }

  return cleaned.length ? cleaned.slice(0, 8) : fallback;
}

function isConfidence(value: unknown): value is Confidence {
  return value === "high" || value === "medium" || value === "low";
}

function isTiming(value: unknown): value is ActionItem["timing"] {
  return (
    value === "Before appointment" ||
    value === "On the day" ||
    value === "If needed" ||
    value === "As soon as possible"
  );
}

function isPrescriptionLike(lower: string): boolean {
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

function sanitizeUserFacingText(value: string): string {
  const text = value.trim();
  if (!text) return "";
  return UNSAFE_OUTPUT_PATTERNS.some((pattern) => pattern.test(text)) ? SAFE_REPLACEMENT : text;
}
