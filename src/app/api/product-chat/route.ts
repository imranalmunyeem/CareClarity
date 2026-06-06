import { NO_STORE_HEADERS, productChatPayload } from "../../../server/productChatCore";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const result = await productChatPayload(body);

  return Response.json(result.body, {
    status: result.status,
    headers: NO_STORE_HEADERS,
  });
}
