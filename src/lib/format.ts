import type { AnalysisResult } from "./analyzer";
import type { TranslationResponse } from "./translationSchema";

export function formatAnalysisAsText(
  result: AnalysisResult | null,
  translation?: TranslationResponse | null,
): string {
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
