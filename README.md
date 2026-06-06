# CareClarity

CareClarity is a browser-based, mobile-friendly NHS-style admin companion. It explains healthcare appointment letters, referral messages, prescription paperwork and admin instructions in plain English without giving medical advice. AI analysis is configured to use Z.AI from a server-side API route only.

## Features

- Upload a PDF/image or paste NHS-style letter and prescription text.
- Generate a plain-English summary, key details, an action checklist, preparation notes and five safe questions.
- Highlight missing or uncertain information.
- Keep an always-visible admin-only safety notice.
- Analyze prescription or letter files in PDF/image format.
- Translate pasted healthcare admin letters into supported languages with Z.AI-powered translation.
- Copy or download the result as `.txt`.
- Show a safe fallback result if Z.AI is unavailable.
- Use the prototype without login, registration or stored patient records.

## Privacy And Safety

CareClarity is designed as an admin-support prototype, not a medical chatbot. It does not diagnose conditions, recommend medicines, change treatment plans or replace NHS clinicians, GP practices or pharmacists.

Patients do not need to create an account. Uploaded PDFs/images and pasted text are used for the analysis request only and are not saved to a backend database by CareClarity.

The multilingual translation feature is for admin understanding only. It preserves dates, times, locations, phone numbers, clinic names and appointment instructions as closely as possible, but it is not medical advice and should not be used to make diagnosis, treatment or medication decisions.

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

The app calls server-side endpoints for AI analysis and falls back to the safe local analyzer if Z.AI is unavailable, not configured, times out or returns an invalid response. Fallback responses include a short reason for the UI, but the endpoint does not log pasted letter, prescription text or uploaded files.

Endpoint hardening:

- `POST /api/analyze` validates input before calling Z.AI.
- `POST /api/translate-letter` validates pasted letter text and target language before calling Z.AI.
- Responses use `Cache-Control: no-store`.
- `ZAI_BASE_URL` must resolve to `https://api.z.ai/`.
- Z.AI responses are validated with Zod before being returned to the app.
- Invalid or empty Z.AI responses safely fall back to local admin-only analysis.

Translation supports Bengali, Urdu, Arabic, Polish, Romanian, Punjabi, Hindi, Gujarati, Somali, Spanish, French, Chinese and Ukrainian. If Z.AI is unavailable, CareClarity returns a safe fallback instead of guessing a translation.

Use these environment variables:

```text
ZAI_API_KEY=replace_with_your_zai_key
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/
ZAI_MODEL=glm-5.1
```

The project uses a server-side Z.AI REST client for analysis and does not require any non-Z.AI API credentials.

Do not paste or upload real patient data into a public deployment unless you have the right governance, consent and hosting controls in place.
