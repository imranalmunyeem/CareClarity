import type { ProductChatResponse } from "./productChatSchema";

const PRODUCT_SUPPORT_NOTICE =
  "CareClarity supports healthcare administration only and does not provide medical advice, diagnosis, treatment advice, medication advice, or medication-change instructions.";

export function buildMockProductChatResponse(question: string): ProductChatResponse {
  return {
    answer:
      "CareClarity can help you paste or upload healthcare admin paperwork, explain confusing sentences, translate pasted letter text, and create a patient dashboard with key admin details. It does not store letters in a database and does not require a patient account.",
    language: inferBasicLanguage(question),
    refused: false,
    suggestedNextStep:
      "Paste letter text into the main box, choose the feature you need, and confirm important details with the service named in the letter.",
    safetyNotice: PRODUCT_SUPPORT_NOTICE,
  };
}

export function buildProductChatRefusal(reason: string, question = ""): ProductChatResponse {
  return {
    answer:
      "I can help with CareClarity product questions, but I cannot help with that request. CareClarity is for understanding healthcare admin paperwork, not for medical advice, illegal activity, or bypassing safety rules.",
    language: inferBasicLanguage(question),
    refused: true,
    reason,
    suggestedNextStep:
      "Ask how to upload a letter, translate pasted text, explain one sentence, use the patient dashboard, or export the result.",
    safetyNotice: PRODUCT_SUPPORT_NOTICE,
  };
}

function inferBasicLanguage(text: string): string {
  if (/[\u0600-\u06ff]/.test(text)) return "Arabic or Urdu";
  if (/[\u0900-\u097f]/.test(text)) return "Hindi, Punjabi, Gujarati, or related script";
  if (/[\u0980-\u09ff]/.test(text)) return "Bengali";
  if (/[\u0400-\u04ff]/.test(text)) return "Ukrainian or Cyrillic";
  if (/[¿¡]|\b(?:cómo|puedo|ayuda|traducir)\b/i.test(text)) return "Spanish";
  if (/\b(?:bonjour|comment|aide|traduire)\b/i.test(text)) return "French";
  if (/[\u4e00-\u9fff]/.test(text)) return "Chinese";
  return "English";
}
