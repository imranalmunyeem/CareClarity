import type { AnalysisResult } from "./analyzer";
import { formatAnalysisAsText } from "./format";
import type { LetterComparisonResult } from "./letterComparison";
import type { PrescriptionAdminHelperResult } from "./prescriptionAdmin";

const MAX_TRANSLATION_INPUT_LENGTH = 12000;

export function buildTranslationInput({
  letterText,
  result,
  comparisonResult,
  prescriptionResult,
}: {
  letterText: string;
  result: AnalysisResult | null;
  comparisonResult: LetterComparisonResult | null;
  prescriptionResult: PrescriptionAdminHelperResult | null;
}): string {
  const outputText = result
    ? formatAnalysisAsText(result)
    : comparisonResult
      ? formatAnalysisAsText(null, null, comparisonResult)
      : prescriptionResult
        ? formatAnalysisAsText(null, null, null, prescriptionResult)
        : "";
  const source = outputText.trim() || letterText.trim();

  return source.slice(0, MAX_TRANSLATION_INPUT_LENGTH);
}

export function hasEnoughTranslationInput(source: string): boolean {
  return source.trim().length >= 30;
}
