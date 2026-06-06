import type { AnalysisResult } from "./analyzer";
import { buildAppointmentReadinessPack } from "./appointmentReadiness";
import type { LetterComparisonResult } from "./letterComparison";
import type { PrescriptionAdminHelperResult } from "./prescriptionAdmin";
import type { TranslationResponse } from "./translationSchema";

export function formatAnalysisAsText(
  result: AnalysisResult | null,
  translation?: TranslationResponse | null,
  comparison?: LetterComparisonResult | null,
  prescription?: PrescriptionAdminHelperResult | null,
): string {
  const readinessPack = result ? buildAppointmentReadinessPack(result) : null;
  const lines = result
    ? [
    "CareClarity admin summary",
    `Generated: ${new Date(result.generatedAt).toLocaleString()}`,
    `Mode: ${result.mode === "ai" ? "Z.AI endpoint" : "Safe fallback"}`,
    result.fallbackReason ? `Fallback note: ${result.fallbackReason}` : "",
    "",
    "Summary",
    ...result.summary.map((item) => `- ${item}`),
    "",
    "Patient dashboard summary",
    result.patientDashboardSummary,
    "",
    "Structured information extraction",
    `- Letter type: ${result.structuredInformationExtraction.letterType}`,
    `- Department or clinic: ${result.structuredInformationExtraction.departmentOrClinic}`,
    `- Appointment date: ${result.structuredInformationExtraction.appointmentDate}`,
    `- Appointment time: ${result.structuredInformationExtraction.appointmentTime}`,
    `- Location: ${result.structuredInformationExtraction.location}`,
    `- Contact info: ${result.structuredInformationExtraction.contactInfo}`,
    `- Named clinician or team: ${result.structuredInformationExtraction.namedClinicianOrTeam}`,
    `- Action required: ${result.structuredInformationExtraction.actionRequired}`,
    "",
    "Appointment readiness pack",
    `Status: ${readinessPack!.status}`,
    readinessPack!.summary,
    "",
    "Key appointment details",
    ...readinessPack!.essentials.map((item) => `- ${item.key}: ${item.value}${item.needsCheck ? " (check)" : ""}`),
    "",
    "Before you go",
    ...readinessPack!.beforeYouGo.map((item) => `- ${item}`),
    "",
    "Bring or prepare",
    ...readinessPack!.bringOrPrepare.map((item) => `- ${item}`),
    "",
    "Confirm first",
    ...readinessPack!.confirmFirst.map((item) => `- ${item}`),
    "",
    "Plain-English translation",
    result.plainEnglishTranslation,
    "",
    "Key details",
    ...result.details.map((detail) => `- ${detail.label}: ${detail.value}`),
    "",
    "Action checklist",
    ...result.checklist.map((item) => `- [${item.timing}] ${item.task}${item.reason ? ` (${item.reason})` : ""}`),
    "",
    "Appointment preparation",
    ...result.preparationNotes.map((item) => `- ${item}`),
    "",
    "Waiting or referral guidance",
    ...result.waitingOrReferralGuidance.map((item) => `- ${item}`),
    "",
    "Safe questions",
    ...result.clinicianQuestions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Missing or unclear",
    ...result.missingOrUnclear.map((item) => `- ${item}`),
    "",
    "Safety",
    `Status: ${result.safetyValidation.status}`,
    ...result.safetyValidation.issuesFound.map((item) => `- Issue: ${item}`),
    `Notice: ${result.safetyValidation.safetyNotice}`,
    ...result.safetyNotes.map((item) => `- ${item}`),
    "",
    `Confidence: ${result.confidence}`,
      ]
    : ["CareClarity admin summary", `Generated: ${new Date().toLocaleString()}`];

  if (translation) {
    lines.push(
      "",
      "Translated letter",
      `Language: ${translation.targetLanguage}`,
      "",
      translation.translatedLetter,
      "",
      "Important admin terms",
      ...translation.importantTerms.map(
        (term) => `- ${term.originalTerm}: ${term.translatedOrExplainedMeaning}`,
      ),
      "",
      "Translation notes",
      ...translation.translationNotes.map((note) => `- ${note}`),
      "",
      "Translation safety",
      translation.safetyNotice,
      `Translation confidence: ${translation.confidence}`,
    );
  }

  if (comparison) {
    lines.push(
      "",
      "What changed letter comparison",
      `Compared: ${new Date(comparison.comparedAt).toLocaleString()}`,
      comparison.summary,
      "",
      "Changed admin details",
      ...comparison.fields
        .filter((field) => field.changed)
        .map((field) => `- ${field.key}: ${field.before} -> ${field.after}`),
      "",
      "New actions in newer letter",
      ...(comparison.actionChanges.added.length
        ? comparison.actionChanges.added.map((item) => `- ${item}`)
        : ["- None found"]),
      "",
      "Actions no longer found",
      ...(comparison.actionChanges.removed.length
        ? comparison.actionChanges.removed.map((item) => `- ${item}`)
        : ["- None found"]),
      "",
      "Details to check before acting",
      ...comparison.detailsToCheck.map((item) => `- ${item}`),
      "",
      "Comparison safety",
      comparison.safetyNotice,
    );
  }

  if (prescription) {
    lines.push(
      "",
      "Prescription admin helper",
      `Generated: ${new Date(prescription.generatedAt).toLocaleString()}`,
      `Confidence: ${prescription.confidence}`,
      "",
      "Summary",
      prescription.summary,
      "",
      "Prescription admin details",
      ...prescription.adminDetails.map(
        (detail) => `- ${detail.label}: ${detail.value}${detail.needsCheck ? " (check)" : ""}`,
      ),
      "",
      "Admin next steps",
      ...prescription.nextSteps.map((step) => `- ${step}`),
      "",
      "Details to confirm",
      ...prescription.detailsToConfirm.map((item) => `- ${item}`),
      "",
      "Prescription admin safety",
      prescription.safetyNotice,
    );
  }

  return lines.join("\n");
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
