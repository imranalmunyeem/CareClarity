import type { ActionItem, AnalysisResult } from "./analyzer";

export type AppointmentReadinessStatus = "ready" | "check-details" | "missing-details";

export type AppointmentReadinessEssentialKey =
  | "departmentOrClinic"
  | "appointmentDate"
  | "appointmentTime"
  | "location"
  | "contactInfo"
  | "actionRequired";

export interface AppointmentReadinessEssential {
  key: AppointmentReadinessEssentialKey;
  value: string;
  needsCheck: boolean;
}

export interface AppointmentReadinessPack {
  status: AppointmentReadinessStatus;
  summary: string;
  essentials: AppointmentReadinessEssential[];
  beforeYouGo: string[];
  bringOrPrepare: string[];
  confirmFirst: string[];
}

const ESSENTIAL_KEYS: AppointmentReadinessEssentialKey[] = [
  "departmentOrClinic",
  "appointmentDate",
  "appointmentTime",
  "location",
  "contactInfo",
  "actionRequired",
];

const MISSING_VALUE_PATTERNS = [
  /^not found/i,
  /^not provided/i,
  /^not specified/i,
  /^unclear/i,
  /^unknown/i,
  /^n\/a$/i,
  /^none found/i,
];

export function buildAppointmentReadinessPack(result: AnalysisResult): AppointmentReadinessPack {
  const essentials = ESSENTIAL_KEYS.map((key) => {
    const value = result.structuredInformationExtraction[key];

    return {
      key,
      value,
      needsCheck: isMissingValue(value),
    };
  });
  const missingEssentials = essentials.filter((item) => item.needsCheck);
  const beforeYouGo = buildBeforeYouGo(result.actionChecklist);
  const bringOrPrepare = buildBringOrPrepare(result);
  const confirmFirst = buildConfirmFirst(result, missingEssentials.length > 0);
  const status = getReadinessStatus(missingEssentials.length, confirmFirst.length);

  return {
    status,
    summary: buildReadinessSummary(status, missingEssentials.length),
    essentials,
    beforeYouGo,
    bringOrPrepare,
    confirmFirst,
  };
}

export function isMissingValue(value: string): boolean {
  const normalized = value.trim();
  return !normalized || MISSING_VALUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildBeforeYouGo(checklist: ActionItem[]): string[] {
  const priorityOrder: ActionItem["timing"][] = [
    "As soon as possible",
    "Before appointment",
    "On the day",
    "If needed",
  ];
  const sorted = [...checklist].sort(
    (first, second) => priorityOrder.indexOf(first.timing) - priorityOrder.indexOf(second.timing),
  );

  return dedupe([
    ...sorted.map((item) => item.task),
    "Keep the original letter available on your phone or printed copy.",
  ]).slice(0, 6);
}

function buildBringOrPrepare(result: AnalysisResult): string[] {
  const prepFromActions = result.actionChecklist
    .filter((item) => /\b(bring|take|complete|form|photo id|letter|reference)\b/i.test(item.task))
    .map((item) => item.task);

  return dedupe([
    ...result.appointmentPreparationGuidance,
    ...prepFromActions,
    "Write down any admin questions before contacting the service.",
  ]).slice(0, 6);
}

function buildConfirmFirst(result: AnalysisResult, hasMissingEssentials: boolean): string[] {
  const missingMessage = hasMissingEssentials
    ? ["Confirm any missing date, time, location or contact details with the service before making travel plans."]
    : [];

  return dedupe([
    ...missingMessage,
    ...result.missingOrUncertainInformation,
    ...result.waitingOrReferralGuidance.filter((item) => /unclear|confirm|contact|query/i.test(item)),
  ]).slice(0, 6);
}

function getReadinessStatus(missingEssentialCount: number, confirmCount: number): AppointmentReadinessStatus {
  if (missingEssentialCount >= 3) return "missing-details";
  if (missingEssentialCount > 0 || confirmCount > 1) return "check-details";
  return "ready";
}

function buildReadinessSummary(status: AppointmentReadinessStatus, missingEssentialCount: number): string {
  if (status === "ready") {
    return "The main appointment details were found. Review the checklist and keep the original letter handy.";
  }

  if (status === "check-details") {
    return `${missingEssentialCount || "Some"} appointment detail${
      missingEssentialCount === 1 ? "" : "s"
    } should be checked before you rely on the paperwork.`;
  }

  return "Several key appointment details were not clear. Confirm them with the service before making travel plans.";
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
