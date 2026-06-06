import {
  productChatResponseSchema,
  type ProductChatMessage,
  type ProductChatResponse,
} from "./productChatSchema";

export async function requestProductChatAnswer(
  question: string,
  history: ProductChatMessage[],
): Promise<ProductChatResponse> {
  const response = await fetch("/api/product-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "CareClarity support chat is unavailable right now.";
    throw new Error(message);
  }

  const payload = await response.json();
  return productChatResponseSchema.parse(payload);
}
