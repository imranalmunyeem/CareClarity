# CareClarity

CareClarity is a browser-based, mobile-friendly NHS-style admin companion. It explains healthcare appointment letters, referral messages, prescription paperwork and admin instructions in plain English without giving medical advice. AI analysis is configured to use Z.AI from a server-side API route only.

## Features

- Upload a PDF/image or paste NHS-style letter and prescription text.
- Generate a plain-English summary, key details, an action checklist, preparation notes and five safe questions.
- Create an Appointment Readiness Pack with key appointment details, before-you-go steps and details to confirm.
- Download a clean family/carer summary as TXT or PDF with appointment details, checklist, contact info, questions and safety notice.
- Compare an older and newer letter to show changed appointment/admin details.
- Upload one older letter and one newer letter when comparing paperwork, or paste both texts.
- Use a Prescription Admin Helper to identify collection details, references, contact numbers and admin steps without giving medicine advice.
- Use an NHS App Navigation Helper for admin-only guidance on where to look for appointments, messages, referrals or prescriptions.
- Turn on Accessibility Mode for larger text, high contrast, easy-read spacing, dyslexia-friendly layout support and browser read-aloud.
- Flag missing or unclear details before the patient acts, including missing date, time, location, unclear contact number, conflicting instructions or an action with no deadline.
- Keep an always-visible admin-only safety notice.
- Analyze prescription or letter files in PDF/image format.
- Translate pasted healthcare admin letters into supported languages with Z.AI-powered translation.
- Switch the product interface language from the top-right language selector, with English as the default.
- Ask CareClarity product-support questions in a multilingual chatbox.
- Copy or download the result as `.txt`.
- Show a safe fallback result if Z.AI is unavailable.
- Use the prototype without login, registration or stored patient records.

## Privacy And Safety

CareClarity is designed as an admin-support prototype, not a medical chatbot. It does not diagnose conditions, recommend medicines, change treatment plans or replace NHS clinicians, GP practices or pharmacists.

Patients do not need to create an account. Uploaded PDFs/images and pasted text are used for the analysis request only and are not saved to a backend database by CareClarity.

The multilingual translation feature is for admin understanding only. It preserves dates, times, locations, phone numbers, clinic names and appointment instructions as closely as possible, but it is not medical advice and should not be used to make diagnosis, treatment or medication decisions.

The product language selector changes the CareClarity interface text only. It does not alter the original uploaded paperwork or add medical meaning.

The product-support chatbox answers questions about how to use CareClarity only. It refuses medical advice, diagnosis, treatment, medication, illegal, harmful or safety-bypass requests, even when framed as a test or for someone else.

The family/carer summary should only be shared with someone the patient trusts. It is designed to support admin help and does not add medical advice.

The NHS App Navigation Helper is a navigation guide only. CareClarity is separate from NHS services and does not access a user's NHS App account.

The Prescription Admin Helper explains collection/admin wording only. It does not check medicine safety, recommend doses, suggest treatment or tell anyone to start, stop or change medication.

Accessibility Mode is opt-in from the top-right control. It changes the browser interface presentation only and does not store patient letters or uploaded files.

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
