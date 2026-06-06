import {
  NO_STORE_HEADERS,
  parseRequestBody,
  translateLetterPayload,
} from "../src/server/translateLetterCore";

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const result = await translateLetterPayload(parseRequestBody(request.body));
  return response.status(result.status).json(result.body);
}
