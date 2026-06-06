# CareClarity

CareClarity is a browser-based, mobile-friendly NHS-style admin companion. It explains healthcare appointment letters, referral messages and admin instructions in plain English without giving medical advice.

## Features

- Paste or load synthetic NHS-style letter text.
- Generate a plain-English summary, key admin details, an action checklist, preparation notes and five safe questions.
- Highlight missing or uncertain information.
- Keep an always-visible admin-only safety notice.
- Copy or download the result as `.txt`.
- Work in demo mode when the optional API endpoint is unavailable.

## Run Locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```powershell
npm run build
```

## Optional AI Endpoint

The app first tries `POST /api/analyze`. If that endpoint is not available or no API key is configured, it falls back to the browser-only demo analyzer.

For Vercel deployment, set:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

Do not paste real patient data into a public demo.
