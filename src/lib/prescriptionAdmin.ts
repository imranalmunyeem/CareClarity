import type { Confidence } from "./analyzer";

export interface PrescriptionAdminDetail {
  label: string;
  value: string;
  needsCheck: boolean;
}

export interface PrescriptionAdminHelperResult {
  generatedAt: string;
  summary: string;
  adminDetails: PrescriptionAdminDetail[];
  nextSteps: string[];
  detailsToConfirm: string[];
  safetyNotice: string;
  confidence: Confidence;
}

const NOT_FOUND = "Not found in the pasted text";

export const PRESCRIPTION_ADMIN_SAFETY_NOTICE =
  "CareClarity explains prescription administration only. It does not provide medication advice, dose advice or medication-change instructions. For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.";

export function buildPrescriptionAdminHelper(text: string): PrescriptionAdminHelperResult {
  const normalizedText = text.trim();
  const lower = normalizedText.toLowerCase();
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const reference = findReference(normalizedText);
  const collectionPoint = findLineValue(lines, ["collection point", "collect from", "collection location", "pharmacy"]);
  const readyDate = findLineValue(lines, ["expected ready date", "ready date", "collection date", "available from"]);
  const contactNumber = findPhone(normalizedText);
  const pharmacyOrTeam = findPharmacyOrTeam(lines);
  const collectionProof = findCollectionProof(lower);
  const hasMedicineUnclearWarning = /\b(?:medicine|medication|dose|dosage|label)\b/i.test(normalizedText);

  const adminDetails: PrescriptionAdminDetail[] = [
    {
      label: "Paperwork type",
      value: isPrescriptionLike(lower) ? "Prescription collection/admin paperwork" : "Possible prescription/admin paperwork",
      needsCheck: !isPrescriptionLike(lower),
    },
    {
      label: "Prescription reference",
      value: reference ?? NOT_FOUND,
      needsCheck: !reference,
    },
    {
      label: "Collection point",
      value: collectionPoint ?? NOT_FOUND,
      needsCheck: !collectionPoint,
    },
    {
      label: "Expected ready date/time",
      value: readyDate ?? findDate(normalizedText) ?? NOT_FOUND,
      needsCheck: !(readyDate ?? findDate(normalizedText)),
    },
    {
      label: "Contact number",
      value: contactNumber ?? NOT_FOUND,
      needsCheck: !contactNumber,
    },
    {
      label: "Pharmacy or admin team",
      value: pharmacyOrTeam ?? NOT_FOUND,
      needsCheck: !pharmacyOrTeam,
    },
    {
      label: "Collection proof mentioned",
      value: collectionProof ?? "Not clearly mentioned",
      needsCheck: !collectionProof,
    },
  ];

  const detailsToConfirm = buildDetailsToConfirm(adminDetails, hasMedicineUnclearWarning);

  return {
    generatedAt: new Date().toISOString(),
    summary: buildSummary({ reference, collectionPoint, readyDate, contactNumber, hasMedicineUnclearWarning }),
    adminDetails,
    nextSteps: buildNextSteps({ reference, collectionPoint, readyDate, contactNumber, collectionProof, hasMedicineUnclearWarning }),
    detailsToConfirm,
    safetyNotice: PRESCRIPTION_ADMIN_SAFETY_NOTICE,
    confidence: inferConfidence(adminDetails),
  };
}

function buildSummary({
  reference,
  collectionPoint,
  readyDate,
  contactNumber,
  hasMedicineUnclearWarning,
}: {
  reference?: string;
  collectionPoint?: string;
  readyDate?: string;
  contactNumber?: string;
  hasMedicineUnclearWarning: boolean;
}): string {
  const found = [
    reference ? "a prescription reference" : "",
    collectionPoint ? "a collection point" : "",
    readyDate ? "a ready date/time" : "",
    contactNumber ? "a contact number" : "",
  ].filter(Boolean);

  const base = found.length
    ? `This looks like prescription admin paperwork with ${found.join(", ")}.`
    : "This may be prescription admin paperwork, but several key admin details were not clearly found.";

  return hasMedicineUnclearWarning
    ? `${base} Any medicine name, dose or label question should be checked with a pharmacist, GP practice or NHS team.`
    : base;
}

function buildNextSteps({
  reference,
  collectionPoint,
  readyDate,
  contactNumber,
  collectionProof,
  hasMedicineUnclearWarning,
}: {
  reference?: string;
  collectionPoint?: string;
  readyDate?: string;
  contactNumber?: string;
  collectionProof?: string;
  hasMedicineUnclearWarning: boolean;
}): string[] {
  const steps = [
    collectionPoint
      ? `Check the collection point before travelling: ${collectionPoint}.`
      : "Confirm the collection point with the pharmacy, GP practice or service named in the paperwork.",
    readyDate
      ? `Check when it says the prescription should be ready: ${readyDate}.`
      : "Confirm when the prescription is expected to be ready before travelling.",
    collectionProof
      ? `Bring what the paperwork asks for when collecting: ${collectionProof}.`
      : "Bring the message, letter or ID if the paperwork says this is needed.",
  ];

  if (reference) {
    steps.push(`Keep the prescription reference handy: ${reference}.`);
  }

  if (contactNumber) {
    steps.push(`Use the admin contact number for prescription collection queries: ${contactNumber}.`);
  }

  if (hasMedicineUnclearWarning) {
    steps.push("If the medicine name, dose or label is unclear, ask a pharmacist, GP practice or NHS team before taking or changing anything.");
  }

  return dedupe(steps).slice(0, 6);
}

function buildDetailsToConfirm(
  details: PrescriptionAdminDetail[],
  hasMedicineUnclearWarning: boolean,
): string[] {
  const missing = details
    .filter((detail) => detail.needsCheck)
    .map((detail) => `Confirm ${detail.label.toLowerCase()} with the service named in the paperwork.`);

  if (hasMedicineUnclearWarning) {
    missing.push("Confirm any medicine name, dose, label, side-effect or suitability question with a pharmacist, GP practice or NHS team.");
  }

  if (!missing.length) {
    missing.push("No obvious missing admin detail was detected, but still check the original paperwork before acting.");
  }

  return dedupe(missing).slice(0, 7);
}

function inferConfidence(details: PrescriptionAdminDetail[]): Confidence {
  const foundCount = details.filter((detail) => !detail.needsCheck).length;

  if (foundCount >= 5) return "high";
  if (foundCount >= 3) return "medium";
  return "low";
}

function findLineValue(lines: string[], labels: string[]): string | undefined {
  const labelPattern = labels.map(escapeRegex).join("|");
  const pattern = new RegExp(`^(?:${labelPattern})\\s*[:#-]?\\s*(.+)$`, "i");
  const line = lines.find((item) => pattern.test(item));
  return line?.match(pattern)?.[1]?.trim();
}

function findReference(text: string): string | undefined {
  return text
    .match(
      /\b(?:prescription reference|prescription number|rx reference|reference|ref)\s*[:#-]?\s*([A-Z]{1,5}[-/]?[A-Z0-9]{3,}(?:[-/][A-Z0-9]+)?)\b/i,
    )?.[1]
    ?.trim();
}

function findPhone(text: string): string | undefined {
  return text.match(/\b(?:0|\+44\s?)(?:\d[\s-]?){9,10}\b/)?.[0]?.trim();
}

function findDate(text: string): string | undefined {
  const monthNames =
    "january|february|march|april|may|june|july|august|september|october|november|december";
  const longDate = new RegExp(
    `\\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNames})\\s+\\d{4}(?:\\s+after\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)?\\b`,
    "i",
  );
  const shortDate = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
  return text.match(longDate)?.[0]?.trim() ?? text.match(shortDate)?.[0]?.trim();
}

function findPharmacyOrTeam(lines: string[]): string | undefined {
  return lines.find((line) => /\b(?:pharmacy|gp practice|prescription team|medicines team|dispensary)\b/i.test(line));
}

function findCollectionProof(lower: string): string | undefined {
  const requested: string[] = [];
  if (lower.includes("photo id") || lower.includes("identification")) requested.push("photo ID if available");
  if (lower.includes("message")) requested.push("this message");
  if (lower.includes("letter")) requested.push("this letter");
  return requested.length ? requested.join(" or ") : undefined;
}

function isPrescriptionLike(lower: string): boolean {
  return (
    lower.includes("prescription") ||
    lower.includes("repeat medicine") ||
    lower.includes("repeat medication") ||
    lower.includes("pharmacy") ||
    lower.includes("dispensary")
  );
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
