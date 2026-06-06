import type { ActionItem, AnalysisResult } from "./analyzer";
import type { StructuredInformationExtraction } from "./analysisSchema";

export type LetterComparisonFieldKey = keyof StructuredInformationExtraction;
export type LetterComparisonImpact = "critical" | "important" | "context";

export interface LetterComparisonField {
  key: LetterComparisonFieldKey;
  before: string;
  after: string;
  changed: boolean;
  impact: LetterComparisonImpact;
}

export interface LetterComparisonActionChanges {
  added: string[];
  removed: string[];
}

export interface LetterComparisonResult {
  comparedAt: string;
  summary: string;
  changedCount: number;
  unchangedCount: number;
  fields: LetterComparisonField[];
  actionChanges: LetterComparisonActionChanges;
  detailsToCheck: string[];
  safetyNotice: string;
}

const COMPARISON_FIELDS: LetterComparisonFieldKey[] = [
  "letterType",
  "departmentOrClinic",
  "appointmentDate",
  "appointmentTime",
  "location",
  "contactInfo",
  "namedClinicianOrTeam",
  "actionRequired",
];

const CRITICAL_FIELDS = new Set<LetterComparisonFieldKey>([
  "appointmentDate",
  "appointmentTime",
  "location",
  "contactInfo",
  "actionRequired",
]);

const IMPORTANT_FIELDS = new Set<LetterComparisonFieldKey>(["departmentOrClinic", "namedClinicianOrTeam"]);

const MISSING_VALUE_PATTERNS = [
  /^not found/i,
  /^not provided/i,
  /^not specified/i,
  /^unclear/i,
  /^unknown/i,
  /^n\/a$/i,
  /^none found/i,
];

export function buildLetterComparison(
  previous: AnalysisResult,
  updated: AnalysisResult,
): LetterComparisonResult {
  const fields = COMPARISON_FIELDS.map((key) => {
    const before = previous.structuredInformationExtraction[key];
    const after = updated.structuredInformationExtraction[key];

    return {
      key,
      before,
      after,
      changed: normalizeComparableValue(before) !== normalizeComparableValue(after),
      impact: getFieldImpact(key),
    };
  });
  const changedFields = fields.filter((field) => field.changed);
  const actionChanges = compareActions(previous.actionChecklist, updated.actionChecklist);
  const detailsToCheck = buildDetailsToCheck(changedFields, updated);

  return {
    comparedAt: new Date().toISOString(),
    summary: buildComparisonSummary(changedFields, actionChanges),
    changedCount: changedFields.length,
    unchangedCount: fields.length - changedFields.length,
    fields,
    actionChanges,
    detailsToCheck,
    safetyNotice:
      "CareClarity compares administrative details only. It does not decide which letter is clinically correct and does not provide medical advice.",
  };
}

export function getChangedComparisonFields(comparison: LetterComparisonResult): LetterComparisonField[] {
  return comparison.fields.filter((field) => field.changed);
}

function compareActions(previous: ActionItem[], updated: ActionItem[]): LetterComparisonActionChanges {
  const previousTasks = new Map(previous.map((item) => [normalizeComparableValue(item.task), item.task]));
  const updatedTasks = new Map(updated.map((item) => [normalizeComparableValue(item.task), item.task]));

  return {
    added: Array.from(updatedTasks.entries())
      .filter(([key]) => !previousTasks.has(key))
      .map(([, value]) => value)
      .slice(0, 6),
    removed: Array.from(previousTasks.entries())
      .filter(([key]) => !updatedTasks.has(key))
      .map(([, value]) => value)
      .slice(0, 6),
  };
}

function buildDetailsToCheck(changedFields: LetterComparisonField[], updated: AnalysisResult): string[] {
  const items: string[] = [];

  if (changedFields.some((field) => field.key === "appointmentDate" || field.key === "appointmentTime")) {
    items.push("Check the latest appointment date and time before making travel or work arrangements.");
  }

  if (changedFields.some((field) => field.key === "location")) {
    items.push("Check the latest location, department, building or clinic before attending.");
  }

  if (changedFields.some((field) => field.key === "contactInfo")) {
    items.push("Use the newest contact details when calling the service.");
  }

  if (changedFields.some((field) => field.key === "actionRequired")) {
    items.push("Read the updated action required section carefully before deciding what admin step to take.");
  }

  const missingUpdatedFields = changedFields
    .filter((field) => isMissingValue(field.after))
    .map((field) => field.key);

  if (missingUpdatedFields.length) {
    items.push("Some details are missing or unclear in the newer letter, so confirm them with the service named in the paperwork.");
  }

  return dedupe([...items, ...updated.missingOrUncertainInformation]).slice(0, 7);
}

function buildComparisonSummary(
  changedFields: LetterComparisonField[],
  actionChanges: LetterComparisonActionChanges,
): string {
  const criticalCount = changedFields.filter((field) => field.impact === "critical").length;
  const actionChangeCount = actionChanges.added.length + actionChanges.removed.length;

  if (!changedFields.length && !actionChangeCount) {
    return "No clear changes were found in the main administrative details. Still check the latest letter before acting.";
  }

  if (criticalCount) {
    return `${criticalCount} important appointment/admin detail${
      criticalCount === 1 ? " has" : "s have"
    } changed. Use the newer letter and confirm anything unclear with the service.`;
  }

  return `${changedFields.length + actionChangeCount} admin change${
    changedFields.length + actionChangeCount === 1 ? " was" : "s were"
  } found. Review the newer letter before taking the next step.`;
}

function getFieldImpact(key: LetterComparisonFieldKey): LetterComparisonImpact {
  if (CRITICAL_FIELDS.has(key)) return "critical";
  if (IMPORTANT_FIELDS.has(key)) return "important";
  return "context";
}

function normalizeComparableValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:()[\]{}]/g, "");
}

function isMissingValue(value: string): boolean {
  const normalized = value.trim();
  return !normalized || MISSING_VALUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();

  return items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
