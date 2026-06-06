import { NO_STORE_HEADERS, translateLetterPayload } from "../../../server/translateLetterCore";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const result = await translateLetterPayload(body);

  return Response.json(result.body, {
    status: result.status,
    headers: NO_STORE_HEADERS,
  });
}
