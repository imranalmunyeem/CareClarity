import {
  productChatResponseSchema,
  type ProductChatMessage,
  type ProductChatResponse,
} from "./productChatSchema";
import { buildMockProductChatResponse, buildProductChatRefusal } from "./mockProductChatResponse";
import { getUnsafeProductChatReason } from "./productChatSafety";

export async function requestProductChatAnswer(
  question: string,
  history: ProductChatMessage[],
): Promise<ProductChatResponse> {
  const refusalReason = getUnsafeProductChatReason(question);

  if (refusalReason) {
    return buildProductChatRefusal(refusalReason, question);
  }

  try {
    const response = await fetch("/api/product-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
    });

    if (!response.ok) {
      return buildMockProductChatResponse(question);
    }

    const payload = await response.json();
    return productChatResponseSchema.parse(payload);
  } catch {
    return buildMockProductChatResponse(question);
  }
}
