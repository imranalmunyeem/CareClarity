import { describe, expect, it } from "vitest";
import { sampleLetters } from "../data/samples";
import { analyzeLetterLocally } from "./analyzer";
import { analysisRequestSchema, analysisResponseSchema } from "./analysisSchema";
import { buildMockSentenceExplanation } from "../server/explainSentenceCore";
import { translateLetterPayload } from "../server/translateLetterCore";
import { buildMockTranslationResponse } from "./mockTranslationResponse";
import { explainSentenceRequestSchema, explainSentenceResponseSchema } from "./sentenceExplainerSchema";
import {
  translationRequestSchema,
  translationSchema,
  type TranslationResponse,
} from "./translationSchema";

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

  it("validates sentence explanation input and fallback response", () => {
    const sentence = "Please report to reception before your clinic appointment.";
    const result = buildMockSentenceExplanation(sentence);

    expect(explainSentenceRequestSchema.safeParse({ sentence }).success).toBe(true);
    expect(explainSentenceRequestSchema.safeParse({ sentence: "short" }).success).toBe(false);
    expect(() => explainSentenceResponseSchema.parse(result)).not.toThrow();
    expect(result.originalSentence).toBe(sentence);
    expect(result.safetyNotice).toContain("does not provide diagnosis");
  });

  it("validates translation schema responses", () => {
    const validResponse: TranslationResponse = {
      targetLanguage: "Bengali",
      translatedLetter: "Translated administrative letter text.",
      importantTerms: [
        {
          originalTerm: "appointment",
          translatedOrExplainedMeaning: "Booked time to attend or contact a service.",
        },
      ],
      translationNotes: ["Dates and phone numbers are preserved."],
      safetyNotice:
        "This tool translates and explains administrative information only and does not provide medical advice.",
      confidence: "high",
    };

    expect(translationSchema.safeParse(validResponse).success).toBe(true);
    expect(translationSchema.safeParse({ ...validResponse, confidence: "certain" }).success).toBe(false);
  });

  it("validates mock translation response and safety notice", () => {
    const response = buildMockTranslationResponse(sampleLetters[0].text, "Urdu");

    expect(() => translationSchema.parse(response)).not.toThrow();
    expect(response.targetLanguage).toBe("Urdu");
    expect(response.safetyNotice).toContain("does not provide medical advice");
  });

  it("rejects unsupported translation languages", () => {
    expect(
      translationRequestSchema.safeParse({
        letterText: sampleLetters[0].text,
        targetLanguage: "Klingon",
      }).success,
    ).toBe(false);
  });

  it("returns API fallback translation when Z.AI is unavailable", async () => {
    const previousKey = process.env.ZAI_API_KEY;
    delete process.env.ZAI_API_KEY;

    try {
      const response = await translateLetterPayload({
        letterText: sampleLetters[0].text,
        targetLanguage: "Spanish",
      });

      expect(response.status).toBe(200);
      expect("translatedLetter" in response.body).toBe(true);
      expect(response.body).toMatchObject({
        targetLanguage: "Spanish",
        confidence: "low",
      });
    } finally {
      if (previousKey) {
        process.env.ZAI_API_KEY = previousKey;
      }
    }
  });
});
