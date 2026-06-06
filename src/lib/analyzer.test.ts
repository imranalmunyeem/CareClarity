import { describe, expect, it } from "vitest";
import { sampleLetters } from "../data/samples";
import { analyzeLetterLocally } from "./analyzer";
import { analysisRequestSchema, analysisResponseSchema } from "./analysisSchema";

describe("CareClarity safety flow", () => {
  it("keeps prescription paperwork in an admin-only safety boundary", () => {
    const sample = sampleLetters.find((letter) => letter.id === "prescription-admin");
    expect(sample).toBeDefined();

    const result = analyzeLetterLocally(sample!.text);
    const fullText = [
      ...result.summary,
      ...result.checklist.map((item) => `${item.task} ${item.reason ?? ""}`),
      ...result.preparationNotes,
      ...result.missingOrUnclear,
      ...result.safetyNotes,
    ].join(" ");

    expect(result.details.some((detail) => detail.value === "Prescription admin paperwork")).toBe(true);
    expect(result.structuredInformationExtraction.letterType).toBe("Prescription admin paperwork");
    expect(result.safetyValidation.status).toBe("SAFE");
    expect(result.safetyValidation.issuesFound.join(" ")).toContain("Prescription");
    expect(fullText).toContain("Do not start, stop, change or ignore medicine");
    expect(fullText).toContain("cannot check medicine safety or suitability");
    expect(fullText).not.toMatch(/\byou should\s+(take|stop|start|change|increase|decrease)\b/i);
  });

  it("accepts the expected AI response shape with Zod", () => {
    const result = analyzeLetterLocally(sampleLetters[0].text);
    expect(() => analysisResponseSchema.parse(result)).not.toThrow();
  });

  it("validates request input before endpoint analysis", () => {
    expect(analysisRequestSchema.safeParse({ letterText: "  Appointment letter  " }).success).toBe(true);
    expect(
      analysisRequestSchema.safeParse({
        letterText: "",
        attachments: [
          {
            name: "letter.jpg",
            mimeType: "image/jpeg",
            dataUrl: "data:image/jpeg;base64,abcd",
            kind: "image",
          },
        ],
      }).success,
    ).toBe(true);
    expect(analysisRequestSchema.safeParse({ letterText: "" }).success).toBe(false);
    expect(analysisRequestSchema.safeParse({ letterText: "x".repeat(12001) }).success).toBe(false);
  });
});
