import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { analyzePayload, NO_STORE_HEADERS, parseRequestBody } from "./src/server/analyzeCore";
import { explainSentencePayload } from "./src/server/explainSentenceCore";
import { productChatPayload } from "./src/server/productChatCore";
import { translateLetterPayload } from "./src/server/translateLetterCore";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  hydrateServerEnv(env);

  return {
    plugins: [react(), careClarityApiPlugin()],
  };
});

function careClarityApiPlugin(): Plugin {
  return {
    name: "careclarity-local-api",
    configureServer(server) {
      server.middlewares.use("/api/analyze", handleAnalyzeRequest);
      server.middlewares.use("/api/analyse-letter", (request, response) =>
        handleAnalyzeRequest(request, response, { requireLetterTextOnly: true }),
      );
      server.middlewares.use("/api/explain-sentence", handleExplainSentenceRequest);
      server.middlewares.use("/api/product-chat", handleProductChatRequest);
      server.middlewares.use("/api/translate-letter", handleTranslateLetterRequest);
    },
  };
}

async function handleAnalyzeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: { requireLetterTextOnly?: boolean } = {},
) {
  response.setHeader("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Allow", "POST");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readJsonBody(request);
    const result = await analyzePayload(body, options);
    response.statusCode = result.status;
    response.end(JSON.stringify(result.body));
  } catch {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: "Request body could not be read." }));
  }
}

async function handleExplainSentenceRequest(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Allow", "POST");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readJsonBody(request);
    const result = await explainSentencePayload(body);
    response.statusCode = result.status;
    response.end(JSON.stringify(result.body));
  } catch {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: "Request body could not be read." }));
  }
}

async function handleProductChatRequest(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Allow", "POST");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readJsonBody(request);
    const result = await productChatPayload(body);
    response.statusCode = result.status;
    response.end(JSON.stringify(result.body));
  } catch {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: "Request body could not be read." }));
  }
}

async function handleTranslateLetterRequest(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Allow", "POST");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readJsonBody(request);
    const result = await translateLetterPayload(body);
    response.statusCode = result.status;
    response.end(JSON.stringify(result.body));
  } catch {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: "Request body could not be read." }));
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = "";

  for await (const chunk of request) {
    body += chunk;

    if (body.length > 8_500_000) {
      throw new Error("Request body too large");
    }
  }

  return parseRequestBody(body);
}

function hydrateServerEnv(env: Record<string, string>) {
  for (const key of ["ZAI_API_KEY", "ZAI_BASE_URL", "ZAI_MODEL"]) {
    process.env[key] ||= env[key];
  }
}
