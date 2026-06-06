# CareClarity

CareClarity is a browser-based, mobile-friendly NHS-style admin companion. It explains healthcare appointment letters, referral messages, prescription paperwork and admin instructions in plain English without giving medical advice. AI analysis is configured to use Z.AI from a server-side API route only.

## Features

- Paste or load synthetic NHS-style letter text.
- Generate a plain-English summary, key details, an action checklist, preparation notes and five safe questions.
- Highlight missing or uncertain information.
- Keep an always-visible admin-only safety notice.
- Attach prescription or letter files in PDF/image format for local reference.
- Copy or download the result as `.txt`.
- Work in demo mode when Z.AI is unavailable.
- Use the prototype without login, registration or stored patient records.

## Privacy And Safety

CareClarity is designed as an admin-support prototype, not a medical chatbot. It does not diagnose conditions, recommend medicines, change treatment plans or replace NHS clinicians, GP practices or pharmacists.

Patients do not need to create an account. Uploaded PDFs/images stay in the browser session for local reference and are not saved to a backend database. The file picker does not upload file contents. If AI mode is enabled, only the text in the text box is sent to the configured Z.AI analysis endpoint; use demo mode for browser-only analysis.

The `ZAI_API_KEY` must stay server-side and must never be exposed as a public frontend variable.

For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.

## Run Locally

```powershell
Copy-Item .env.example .env.local
# Add your ZAI_API_KEY in .env.local
npm install
npm run dev
```

Open the local URL printed by Vite.

## Test

```powershell
npm run test
```

## Build

```powershell
npm run build
```

## Z.AI Endpoint

The app calls server-side endpoints for AI analysis and falls back to the mock/demo analyzer if Z.AI is unavailable or not configured.

Use these environment variables:

```text
AI_PROVIDER=zai
ZAI_API_KEY=replace_with_your_zai_key
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
ZAI_MODEL=glm-5.1
NEXT_PUBLIC_APP_NAME=CareClarity
```

The project uses a server-side Z.AI REST client for analysis and does not require any non-Z.AI API credentials.

Do not paste real patient data into a public demo.
