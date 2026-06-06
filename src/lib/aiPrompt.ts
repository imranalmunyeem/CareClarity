export function buildCareClarityPrompt(letterText: string): string {
  return `Analyze this user-provided NHS-style healthcare administration letter or prescription paperwork.

Return JSON with exactly these top-level keys:
- summary: array of 2 to 5 plain-English admin summary strings.
- details: array of objects with label, value, evidence and confidence. Confidence must be high, medium or low.
- checklist: array of objects with task, reason and timing. Timing must be one of: Before appointment, On the day, If needed, As soon as possible.
- preparationNotes: array of practical appointment/admin preparation strings.
- clinicianQuestions: exactly five safe admin-focused questions the patient can ask.
- missingOrUnclear: array of missing, uncertain or ambiguous admin details.
- safetyNotes: array of safety strings.

Rules:
- Focus on appointments, referrals, waiting-list admin, contact details, forms, prescription admin, preparation and travel/admin next steps.
- Prescription content is allowed only as paperwork/admin explanation. Never advise whether a medicine is right, safe, effective or suitable for the patient.
- Never tell the user to start, stop, change, increase, decrease, avoid or ignore medicine.
- Never give diagnosis, treatment advice, medication advice, interaction advice, dose advice or reassurance about symptoms.
- If medicine, dose, side-effect, interaction or treatment questions appear, say they should confirm with a pharmacist, GP practice, NHS team or 111/999 as appropriate.
- If information is missing, say it was not found. Do not invent dates, times, locations, names or phone numbers.
- Use this urgent-care distinction exactly if needed: For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.
- Do not ask the user to create an account or imply CareClarity stores data in a database.

Letter:
"""${letterText}"""`;
}

export const CARECLARITY_SYSTEM_PROMPT =
  "You are CareClarity, a safe healthcare administration assistant for NHS-style letters and prescription paperwork. Explain admin content only. Do not diagnose, recommend medication, interpret medication suitability, tell users to ignore clinicians, or make clinical safety decisions. Return compact JSON only.";
