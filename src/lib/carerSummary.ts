import type { AnalysisResult } from "./analyzer";
import { downloadTextFile } from "./format";

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN = 48;
const PDF_BODY_FONT_SIZE = 11;
const PDF_TITLE_FONT_SIZE = 18;
const PDF_LINE_HEIGHT = 15;
const PDF_MAX_BODY_CHARS = 86;

export function formatCarerSummaryAsText(result: AnalysisResult): string {
  const info = result.structuredInformationExtraction;

  return [
    "CareClarity family or carer summary",
    `Generated: ${new Date(result.generatedAt).toLocaleString()}`,
    "",
    "Important",
    "This summary is for a trusted family member or carer helping with healthcare admin paperwork. It does not provide diagnosis, treatment advice or medication advice.",
    "",
    "Appointment or admin details",
    `- Letter type: ${info.letterType}`,
    `- Department or clinic: ${info.departmentOrClinic}`,
    `- Appointment date: ${info.appointmentDate}`,
    `- Appointment time: ${info.appointmentTime}`,
    `- Location: ${info.location}`,
    `- Contact information: ${info.contactInfo}`,
    `- Clinician or team: ${info.namedClinicianOrTeam}`,
    `- Action required: ${info.actionRequired}`,
    "",
    "Plain-English summary",
    result.patientDashboardSummary,
    result.plainEnglishTranslation,
    "",
    "Checklist",
    ...result.actionChecklist.map(
      (item) => `- [${item.timing}] ${item.task}${item.reason ? ` (${item.reason})` : ""}`,
    ),
    "",
    "Questions to ask",
    ...result.clinicianQuestions.map((question, index) => `${index + 1}. ${question}`),
    "",
    "Details to double-check",
    ...(result.missingDetailFlags?.length
      ? [
          "Flagged before acting:",
          ...result.missingDetailFlags.map((flag) => `- ${flag.label}: ${flag.detail}`),
        ]
      : []),
    ...result.missingOrUncertainInformation.map((item) => `- ${item}`),
    "",
    "Safety notice",
    result.safetyValidation.safetyNotice,
    "CareClarity explains administrative information only. It does not replace NHS teams, GP practices, pharmacists or emergency services.",
    "For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.",
  ].join("\n");
}

export function downloadCarerSummaryText(result: AnalysisResult) {
  downloadTextFile("careclarity-family-carer-summary.txt", formatCarerSummaryAsText(result));
}

export function downloadCarerSummaryPdf(result: AnalysisResult) {
  const pdf = buildCarerSummaryPdf(result);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "careclarity-family-carer-summary.pdf";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildCarerSummaryPdf(result: AnalysisResult): string {
  return buildSimplePdf("CareClarity family or carer summary", formatCarerSummaryAsText(result));
}

export function buildSimplePdf(title: string, body: string): string {
  const titleLines = wrapPdfText(title, 48);
  const bodyLines = body
    .split(/\r?\n/)
    .flatMap((line) => (line.trim() ? wrapPdfText(line, PDF_MAX_BODY_CHARS) : [""]));
  const linesPerFirstPage = Math.floor((PDF_PAGE_HEIGHT - 148) / PDF_LINE_HEIGHT);
  const linesPerPage = Math.floor((PDF_PAGE_HEIGHT - 108) / PDF_LINE_HEIGHT);
  const pages: string[][] = [];
  let remaining = bodyLines;

  pages.push(remaining.slice(0, linesPerFirstPage));
  remaining = remaining.slice(linesPerFirstPage);

  while (remaining.length) {
    pages.push(remaining.slice(0, linesPerPage));
    remaining = remaining.slice(linesPerPage);
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const fontObjectId = 3 + pages.length * 2;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(buildPdfContentStream(index === 0 ? titleLines : [], pageLines, index + 1));
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${
    pageObjectIds.length
  } >>`;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  return writePdfObjects(objects);
}

function buildPdfContentStream(titleLines: string[], bodyLines: string[], pageNumber: number): string {
  const commands = ["BT"];
  let y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  if (titleLines.length) {
    commands.push(`/F1 ${PDF_TITLE_FONT_SIZE} Tf`);
    for (const line of titleLines) {
      commands.push(`1 0 0 1 ${PDF_MARGIN} ${y} Tm (${escapePdfText(line)}) Tj`);
      y -= 22;
    }
    y -= 8;
  }

  commands.push(`/F1 ${PDF_BODY_FONT_SIZE} Tf`);
  for (const line of bodyLines) {
    commands.push(`1 0 0 1 ${PDF_MARGIN} ${y} Tm (${escapePdfText(line)}) Tj`);
    y -= PDF_LINE_HEIGHT;
  }

  commands.push(`/F1 9 Tf`);
  commands.push(`1 0 0 1 ${PDF_MARGIN} 28 Tm (${escapePdfText(`Page ${pageNumber}`)}) Tj`);
  commands.push("ET");

  const stream = commands.join("\n");
  return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
}

function writePdfObjects(objects: string[]): string {
  const offsets: number[] = [];
  let pdf = "%PDF-1.4\n";

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

function wrapPdfText(value: string, maxChars: number): string[] {
  const clean = toPdfSafeText(value).replace(/\s+/g, " ").trim();
  if (!clean) return [""];

  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}-` : word;
  }

  if (current) lines.push(current);
  return lines;
}

function toPdfSafeText(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function escapePdfText(value: string): string {
  return toPdfSafeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
