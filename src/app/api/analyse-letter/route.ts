import { analyzePayload, NO_STORE_HEADERS } from "../../../server/analyzeCore";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const result = await analyzePayload(body);

  return Response.json(result.body, {
    status: result.status,
    headers: NO_STORE_HEADERS,
  });
}
