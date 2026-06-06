export function buildCareClarityPrompt(letterText: string): string {
  return `Analyze this user-provided NHS-style healthcare administration letter or prescription paperwork.

Return JSON with exactly these top-level keys:
- structuredInformationExtraction: object with letterType, departmentOrClinic, appointmentDate, appointmentTime, location, contactInfo, namedClinicianOrTeam and actionRequired. Use "Not found in document" for missing values.
- plainEnglishTranslation: one plain-English paragraph explaining the admin meaning of the paperwork.
- actionChecklist: array of objects with task, reason and timing. Timing must be one of: Before appointment, On the day, If needed, As soon as possible.
- appointmentPreparationGuidance: array of practical appointment/admin preparation strings.
- clinicianQuestions: exactly five safe admin-focused questions the patient can ask.
- waitingOrReferralGuidance: array of waiting-list or referral admin guidance strings. If none is present, say no specific waiting-list or referral instruction was clearly found.
- missingOrUncertainInformation: array of missing, uncertain or ambiguous admin details. Explicitly flag if any of these apply: no date, no time, no location, unclear contact number, conflicting instructions, or action required but no deadline.
- missingDetailFlags: array of objects with key, label, detail and severity. Only use these keys when applicable: no-date, no-time, no-location, unclear-contact-number, conflicting-instructions, action-required-no-deadline. Severity must be check or warning.
- safetyValidation: object with status, issuesFound and safetyNotice. Status must be SAFE or UNSAFE.
- patientDashboardSummary: one compact dashboard summary string.
- confidence: high, medium or low.

Rules:
- Focus on appointments, referrals, waiting-list admin, contact details, forms, prescription admin, preparation and travel/admin next steps.
- Prescription content is allowed only as paperwork/admin explanation. Never advise whether a medicine is right, safe, effective or suitable for the patient.
- Never tell the user to start, stop, change, increase, decrease, avoid or ignore medicine.
- Never give diagnosis, treatment advice, medication advice, interaction advice, dose advice or reassurance about symptoms.
- If medicine, dose, side-effect, interaction or treatment questions appear, say they should confirm with a pharmacist, GP practice, NHS team or 111/999 as appropriate.
- If information is missing, say it was not found. Do not invent dates, times, locations, names or phone numbers.
- Before the patient acts, flag incomplete or unclear admin details such as missing date/time/location, unclear contact number, conflicting instructions, or action required without a clear deadline.
- Use this urgent-care distinction exactly if needed: For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.
- Do not ask the user to create an account or imply CareClarity stores data in a database.
- Do not claim CareClarity is official NHS, NHS-endorsed, NHS-approved or a replacement for NHS advice.
- Set safetyValidation.status to UNSAFE only if the generated response would otherwise contain medical advice, diagnosis, treatment advice, medication advice or instructions to ignore clinicians. Otherwise set it to SAFE.
- Put any unsafe or borderline output risks in safetyValidation.issuesFound and keep the rest of the response admin-only.

Letter:
"""${letterText}"""`;
}

export const CARECLARITY_SYSTEM_PROMPT =
  "You are CareClarity, a safe healthcare administration assistant for NHS-style letters and prescription paperwork. Explain admin content only. Do not diagnose, recommend medication, interpret medication suitability, tell users to ignore clinicians, make clinical safety decisions, or claim official NHS endorsement. Return compact JSON only.";
