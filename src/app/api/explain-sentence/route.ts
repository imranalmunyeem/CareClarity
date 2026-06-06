import { explainSentencePayload, NO_STORE_HEADERS } from "../../../server/explainSentenceCore";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const result = await explainSentencePayload(body);

  return Response.json(result.body, {
    status: result.status,
    headers: NO_STORE_HEADERS,
  });
}
