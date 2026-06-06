import type {
  AIAnalysisAttachment,
  AIAnalysisResponse,
  MissingDetailFlag,
  MissingDetailFlagKey,
  SafetyValidation,
  StructuredInformationExtraction,
} from "./analysisSchema";

export type { MissingDetailFlag, MissingDetailFlagKey } from "./analysisSchema";

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

export interface AnalysisResult extends AIAnalysisResponse {
  mode: AnalysisMode;
  source?: "zai" | "mock";
  fallbackReason?: string;
  generatedAt: string;
  // Compatibility fields used by the current UI while the richer Z.AI schema rolls out.
  summary: string[];
  details: AdminDetail[];
  checklist: ActionItem[];
  preparationNotes: string[];
  clinicianQuestions: string[];
  missingOrUnclear: string[];
  missingDetailFlags: MissingDetailFlag[];
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
const NOT_FOUND = "Not found in document";

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
  const summary = buildSummary(appointmentType, { date, time, location, contact }, lower);
  const structuredInformationExtraction = buildStructuredInformation({
    appointmentType,
    service,
    date,
    time,
    location,
    contact,
    checklist,
    lines,
  });
  const missingDetailFlags = buildMissingDetailFlags({
    structuredInformationExtraction,
    lower,
    text,
    lines,
    date,
    time,
    location,
    contact,
  });
  const missingOrUnclear = mergeMissingFlags(
    buildMissingList({ date, time, location, contact, reference }, lower),
    missingDetailFlags,
  );
  const waitingOrReferralGuidance = buildWaitingOrReferralGuidance(lower, contact);
  const safetyValidation = buildSafetyValidation(lower);
  const plainEnglishTranslation = summary.join(" ");
  const patientDashboardSummary = buildPatientDashboardSummary(structuredInformationExtraction, summary);
  const confidence = inferOverallConfidence({ date, time, location, contact });

  return {
    mode: "fallback",
    generatedAt: new Date().toISOString(),
    structuredInformationExtraction,
    plainEnglishTranslation,
    actionChecklist: checklist,
    appointmentPreparationGuidance: preparationNotes,
    waitingOrReferralGuidance,
    missingOrUncertainInformation: missingOrUnclear,
    safetyValidation,
    patientDashboardSummary,
    confidence,
    summary,
    details,
    checklist,
    preparationNotes,
    clinicianQuestions: DEFAULT_QUESTIONS,
    missingOrUnclear,
    missingDetailFlags,
    safetyNotes: SAFETY_NOTES,
  };
}

function normalizeAnalysis(
  payload: Partial<AnalysisResult>,
  mode: AnalysisMode,
  fallbackText: string,
): AnalysisResult {
  const local = analyzeLetterLocally(fallbackText);
  const structuredInformationExtraction = cleanStructuredInformation(
    payload.structuredInformationExtraction,
    local.structuredInformationExtraction,
  );
  const actionChecklist = cleanChecklist(payload.actionChecklist, local.actionChecklist);
  const appointmentPreparationGuidance = cleanStringArray(
    payload.appointmentPreparationGuidance,
    local.appointmentPreparationGuidance,
  ).slice(0, 6);
  const waitingOrReferralGuidance = cleanStringArray(
    payload.waitingOrReferralGuidance,
    local.waitingOrReferralGuidance,
  ).slice(0, 6);
  const safetyValidation = cleanSafetyValidation(payload.safetyValidation, local.safetyValidation);
  const confidence = isConfidence(payload.confidence) ? payload.confidence : local.confidence;
  const plainEnglishTranslation = cleanText(payload.plainEnglishTranslation, local.plainEnglishTranslation);
  const patientDashboardSummary = cleanText(payload.patientDashboardSummary, local.patientDashboardSummary);
  const missingOrUncertainInformation = cleanStringArray(
    payload.missingOrUncertainInformation,
    local.missingOrUncertainInformation,
  ).slice(0, 8);
  const missingDetailFlags = cleanMissingDetailFlags(payload.missingDetailFlags, local.missingDetailFlags);
  const clinicianQuestions = cleanStringArray(payload.clinicianQuestions, DEFAULT_QUESTIONS).slice(0, 5);

  return {
    mode,
    generatedAt: new Date().toISOString(),
    structuredInformationExtraction,
    plainEnglishTranslation,
    actionChecklist,
    appointmentPreparationGuidance,
    clinicianQuestions,
    waitingOrReferralGuidance,
    missingOrUncertainInformation,
    safetyValidation,
    patientDashboardSummary,
    confidence,
    summary: cleanStringArray(payload.summary, [patientDashboardSummary, plainEnglishTranslation]).slice(0, 5),
    details: cleanDetails(payload.details, buildDetailsFromStructured(structuredInformationExtraction, confidence)),
    checklist: cleanChecklist(payload.checklist, actionChecklist),
    preparationNotes: cleanStringArray(payload.preparationNotes, appointmentPreparationGuidance).slice(0, 6),
    missingOrUnclear: cleanStringArray(payload.missingOrUnclear, missingOrUncertainInformation).slice(0, 8),
    missingDetailFlags,
    safetyNotes: buildSafetyNotes(safetyValidation),
    source: payload.source === "zai" ? "zai" : mode === "ai" ? "zai" : "mock",
    fallbackReason: typeof payload.fallbackReason === "string" ? payload.fallbackReason : undefined,
  };
}

function buildAttachmentFallbackText(attachments: AIAnalysisAttachment[]): string {
  if (!attachments.length) return "Uploaded healthcare paperwork";
  return `Uploaded healthcare paperwork attachment: ${attachments.map((attachment) => attachment.name).join(", ")}`;
}

function buildStructuredInformation({
  appointmentType,
  service,
  date,
  time,
  location,
  contact,
  checklist,
  lines,
}: {
  appointmentType: string;
  service?: string;
  date?: string;
  time?: string;
  location?: string;
  contact?: string;
  checklist: ActionItem[];
  lines: string[];
}): StructuredInformationExtraction {
  const departmentOrClinic = cleanLabelPrefix(service) ?? NOT_FOUND;
  const namedClinicianOrTeam = findNamedClinicianOrTeam(lines) ?? departmentOrClinic;

  return {
    letterType: appointmentType,
    departmentOrClinic,
    appointmentDate: date ?? NOT_FOUND,
    appointmentTime: time ?? NOT_FOUND,
    location: cleanLabelPrefix(location) ?? NOT_FOUND,
    contactInfo: contact ?? NOT_FOUND,
    namedClinicianOrTeam,
    actionRequired: checklist[0]?.task ?? "Check the paperwork and confirm any unclear admin details with the service.",
  };
}

function buildWaitingOrReferralGuidance(lower: string, contact?: string): string[] {
  const guidance: string[] = [];

  if (lower.includes("waiting list") || lower.includes("wait")) {
    guidance.push("Keep the waiting-list update and any reference details somewhere easy to find.");
  }

  if (lower.includes("referral")) {
    guidance.push("Use the referral details in the paperwork when contacting the service about admin progress.");
  }

  if (contact && (lower.includes("waiting list") || lower.includes("referral"))) {
    guidance.push(`If the waiting-list or referral admin is unclear, use the contact number shown: ${contact}.`);
  }

  if (!guidance.length) {
    guidance.push("No specific waiting-list or referral instruction was clearly found.");
  }

  return guidance.slice(0, 6);
}

function buildSafetyValidation(lower: string): SafetyValidation {
  const issuesFound = isPrescriptionLike(lower)
    ? ["Prescription or medicine-related wording must stay within admin explanation only."]
    : [];

  return {
    status: "SAFE",
    issuesFound,
    safetyNotice:
      "CareClarity explains healthcare admin paperwork only and does not provide diagnosis, treatment or medication advice.",
  };
}

function buildPatientDashboardSummary(
  structuredInformationExtraction: StructuredInformationExtraction,
  summary: string[],
): string {
  const parts = [
    structuredInformationExtraction.letterType,
    structuredInformationExtraction.appointmentDate !== NOT_FOUND
      ? structuredInformationExtraction.appointmentDate
      : "",
    structuredInformationExtraction.appointmentTime !== NOT_FOUND
      ? structuredInformationExtraction.appointmentTime
      : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" - ") : summary[0] ?? "Healthcare admin paperwork reviewed.";
}

function inferOverallConfidence(facts: {
  date?: string;
  time?: string;
  location?: string;
  contact?: string;
}): Confidence {
  const foundCount = [facts.date, facts.time, facts.location, facts.contact].filter(Boolean).length;
  if (foundCount >= 3) return "high";
  if (foundCount >= 1) return "medium";
  return "low";
}

function buildDetailsFromStructured(
  structuredInformationExtraction: StructuredInformationExtraction,
  confidence: Confidence,
): AdminDetail[] {
  return [
    ["Likely letter type", structuredInformationExtraction.letterType],
    ["Department or clinic", structuredInformationExtraction.departmentOrClinic],
    ["Date", structuredInformationExtraction.appointmentDate],
    ["Time", structuredInformationExtraction.appointmentTime],
    ["Location", structuredInformationExtraction.location],
    ["Contact information", structuredInformationExtraction.contactInfo],
    ["Clinician or team", structuredInformationExtraction.namedClinicianOrTeam],
    ["Action required", structuredInformationExtraction.actionRequired],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({
      label,
      value,
      confidence,
    }));
}

function buildSafetyNotes(safetyValidation: SafetyValidation): string[] {
  return [
    safetyValidation.safetyNotice,
    ...safetyValidation.issuesFound,
    ...SAFETY_NOTES,
  ].filter((item, index, all) => item && all.indexOf(item) === index);
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

function buildMissingDetailFlags({
  structuredInformationExtraction,
  lower,
  text,
  lines,
  date,
  time,
  location,
  contact,
}: {
  structuredInformationExtraction: StructuredInformationExtraction;
  lower: string;
  text: string;
  lines: string[];
  date?: string;
  time?: string;
  location?: string;
  contact?: string;
}): MissingDetailFlag[] {
  const flags: MissingDetailFlag[] = [];
  const appointmentLike = isAppointmentLike(lower);
  const referralLike = isReferralLike(lower);
  const prescriptionLike = isPrescriptionLike(lower);
  const dateMissing = !date || isMissingValue(structuredInformationExtraction.appointmentDate);
  const timeMissing = !time || isMissingValue(structuredInformationExtraction.appointmentTime);
  const locationMissing = !location || isMissingValue(structuredInformationExtraction.location);

  if (dateMissing && (appointmentLike || referralLike)) {
    flags.push({
      key: "no-date",
      label: "No date found",
      detail: "No clear appointment or referral date was found. Confirm the date before making travel, work or carer arrangements.",
      severity: "warning",
    });
  }

  if (timeMissing && appointmentLike) {
    flags.push({
      key: "no-time",
      label: "No time found",
      detail: "No clear appointment time was found. Confirm the time before attending or arranging transport.",
      severity: "warning",
    });
  }

  if (locationMissing && appointmentLike) {
    flags.push({
      key: "no-location",
      label: "No location found",
      detail: "No clear clinic, building, collection point or appointment location was found. Confirm where to go before travelling.",
      severity: "warning",
    });
  }

  if (hasUnclearContactNumber({ lower, text, contact, prescriptionLike })) {
    flags.push({
      key: "unclear-contact-number",
      label: "Unclear contact number",
      detail: "No complete contact number was found, or the contact number appears incomplete. Confirm the number before calling.",
      severity: "check",
    });
  }

  if (hasConflictingInstructions(lines)) {
    flags.push({
      key: "conflicting-instructions",
      label: "Conflicting instructions",
      detail: "Some instructions appear to conflict. Confirm the current instruction with the service before acting.",
      severity: "warning",
    });
  }

  if (hasActionWithoutDeadline({ lower, date, time })) {
    flags.push({
      key: "action-required-no-deadline",
      label: "Action required but no deadline",
      detail: "The paperwork asks for an action, but no clear deadline or timeframe was found. Confirm when it must be done.",
      severity: "check",
    });
  }

  return dedupeFlags(flags);
}

function mergeMissingFlags(missing: string[], flags: MissingDetailFlag[]): string[] {
  return dedupeStrings([...flags.map((flag) => `${flag.label}: ${flag.detail}`), ...missing]).slice(0, 8);
}

function hasUnclearContactNumber({
  lower,
  text,
  contact,
  prescriptionLike,
}: {
  lower: string;
  text: string;
  contact?: string;
  prescriptionLike: boolean;
}): boolean {
  if (contact) return false;
  if (prescriptionLike) return false;

  const contactMentioned = /\b(?:call|phone|telephone|tel|contact|ring|queries|query|booking team)\b/i.test(lower);
  const incompletePhone = /\b(?:0|\+44\s?)(?:\d[\s-]?){3,8}\b/.test(text);
  return contactMentioned || incompletePhone || isAppointmentLike(lower) || isReferralLike(lower);
}

function hasConflictingInstructions(lines: string[]): boolean {
  const text = lines.join(" ").toLowerCase();
  const pairs = [
    [
      /\b(?:do not|don't|dont|no need to)\s+(?:attend|come|arrive)\b/,
      /\b(?:please\s+)?(?:attend|come to|arrive(?:\s+\d+|\s+at|\s+before)?)\b/,
    ],
    [
      /\b(?:do not|don't|dont|no need to)\s+fast\b|\bno fasting\b/,
      /\b(?:must|need to|required to|please|may need to|might need to)\s+fast\b|\bfast(?:ing)?\s+(?:is|required|for)\b/,
    ],
    [
      /\b(?:do not|don't|dont)\s+bring\b/,
      /\b(?:please\s+bring|must\s+bring|bring\s+(?:this|your|photo|letter|form))\b/,
    ],
    [
      /\b(?:do not|don't|dont|no need to)\s+(?:call|contact)\s+(?:us\s+)?to\s+confirm\b/,
      /\b(?:please|must|need to|required to)\s+(?:call|contact)\s+(?:us\s+)?to\s+confirm\b/,
    ],
    [
      /\b(?:do not|don't|dont)\s+complete\b/,
      /\b(?:please|must|need to|required to)\s+complete\b/,
    ],
  ] as const;

  if (pairs.some(([negative, positive]) => negative.test(text) && positive.test(text))) {
    return true;
  }

  return false;
}

function hasActionWithoutDeadline({
  lower,
  date,
  time,
}: {
  lower: string;
  date?: string;
  time?: string;
}): boolean {
  const actionRequired = /\baction required\b/.test(lower) || /\b(?:please|must|need to|required to)\s+(?:complete|return|send|book|confirm|call|contact|register|provide|upload|reply)\b/.test(lower);
  if (!actionRequired) return false;

  const hasDeadlineSignal =
    Boolean(date || time) ||
    /\b(?:by|before|within|no later than|deadline|as soon as possible|on the day|prior to|at least\s+\d+|after\s+\d+|from\s+\d+)\b/.test(
      lower,
    );

  return !hasDeadlineSignal;
}

function isAppointmentLike(lower: string): boolean {
  return (
    lower.includes("appointment") ||
    lower.includes("clinic") ||
    lower.includes("outpatient") ||
    lower.includes("diagnostic") ||
    lower.includes("blood test") ||
    lower.includes("attend")
  );
}

function isReferralLike(lower: string): boolean {
  return lower.includes("referral") || lower.includes("waiting list");
}

function isMissingValue(value: string): boolean {
  return /^(?:not found|not provided|not specified|unclear|unknown|n\/a|none found)/i.test(value.trim());
}

function dedupeFlags(flags: MissingDetailFlag[]): MissingDetailFlag[] {
  const seen = new Set<MissingDetailFlagKey>();

  return flags.filter((flag) => {
    if (seen.has(flag.key)) return false;
    seen.add(flag.key);
    return true;
  });
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function findNamedClinicianOrTeam(lines: string[]): string | undefined {
  return lines.find((line) =>
    /\b(?:dr|doctor|mr|mrs|ms|miss|professor|consultant|nurse|pharmacist|clinic|service|department|team|unit)\b/i.test(
      line,
    ),
  );
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

function cleanText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = sanitizeUserFacingText(value);
  return cleaned || fallback;
}

function cleanStructuredInformation(
  value: unknown,
  fallback: StructuredInformationExtraction,
): StructuredInformationExtraction {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<keyof StructuredInformationExtraction, unknown>;

  return {
    letterType: cleanText(record.letterType, fallback.letterType),
    departmentOrClinic: cleanText(record.departmentOrClinic, fallback.departmentOrClinic),
    appointmentDate: cleanText(record.appointmentDate, fallback.appointmentDate),
    appointmentTime: cleanText(record.appointmentTime, fallback.appointmentTime),
    location: cleanText(record.location, fallback.location),
    contactInfo: cleanText(record.contactInfo, fallback.contactInfo),
    namedClinicianOrTeam: cleanText(record.namedClinicianOrTeam, fallback.namedClinicianOrTeam),
    actionRequired: cleanText(record.actionRequired, fallback.actionRequired),
  };
}

function cleanSafetyValidation(value: unknown, fallback: SafetyValidation): SafetyValidation {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Partial<SafetyValidation>;

  return {
    status: isSafetyStatus(record.status) ? record.status : fallback.status,
    issuesFound: cleanStringArray(record.issuesFound, fallback.issuesFound).slice(0, 8),
    safetyNotice: cleanText(record.safetyNotice, fallback.safetyNotice),
  };
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

function cleanMissingDetailFlags(value: unknown, fallback: MissingDetailFlag[]): MissingDetailFlag[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned: MissingDetailFlag[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const maybe = item as Partial<MissingDetailFlag>;
    if (!isMissingDetailFlagKey(maybe.key) || !maybe.label || !maybe.detail) continue;
    cleaned.push({
      key: maybe.key,
      label: sanitizeUserFacingText(String(maybe.label)),
      detail: sanitizeUserFacingText(String(maybe.detail)),
      severity: maybe.severity === "warning" ? "warning" : "check",
    });
  }

  return cleaned.length ? dedupeFlags(cleaned).slice(0, 6) : fallback;
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

function isSafetyStatus(value: unknown): value is SafetyValidation["status"] {
  return value === "SAFE" || value === "UNSAFE";
}

function isMissingDetailFlagKey(value: unknown): value is MissingDetailFlagKey {
  return (
    value === "no-date" ||
    value === "no-time" ||
    value === "no-location" ||
    value === "unclear-contact-number" ||
    value === "conflicting-instructions" ||
    value === "action-required-no-deadline"
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
