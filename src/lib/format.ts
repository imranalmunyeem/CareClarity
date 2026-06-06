import type { AnalysisResult } from "./analyzer";

export function formatAnalysisAsText(result: AnalysisResult): string {
  const lines = [
    "CareClarity admin summary",
    `Generated: ${new Date(result.generatedAt).toLocaleString()}`,
    `Mode: ${result.mode === "ai" ? "AI endpoint" : "Demo fallback"}`,
    "",
    "Summary",
    ...result.summary.map((item) => `- ${item}`),
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
    "Safe questions",
    ...result.clinicianQuestions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Missing or unclear",
    ...result.missingOrUnclear.map((item) => `- ${item}`),
    "",
    "Safety",
    ...result.safetyNotes.map((item) => `- ${item}`),
  ];

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
