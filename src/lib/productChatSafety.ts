export function getUnsafeProductChatReason(question: string): string | null {
  const text = question.toLowerCase();

  if (/\b(?:ignore|bypass|jailbreak|override|disable)\b.*\b(?:rule|safety|policy|guardrail|instruction)\b/i.test(text)) {
    return "Requests to bypass CareClarity safety rules are not allowed.";
  }

  if (/\b(?:for\s+(?:a\s+)?(?:friend|relative|test|sample|roleplay|fiction)|hypothetical|just\s+testing)\b/i.test(text)) {
    if (containsMedicalAdviceRequest(text) || containsIllegalRequest(text)) {
      return "CareClarity cannot help with unsafe requests even when framed as a test, roleplay, or for someone else.";
    }
  }

  if (containsIllegalRequest(text)) {
    return "CareClarity cannot help with illegal, harmful, fraudulent, abusive, or privacy-invasive requests.";
  }

  if (containsMedicalAdviceRequest(text)) {
    return "CareClarity cannot provide diagnosis, treatment advice, medication advice, or clinical reassurance.";
  }

  return null;
}

function containsMedicalAdviceRequest(text: string): boolean {
  return [
    /\bdiagnos(?:e|is|ing)\b/i,
    /\bsymptom(?:s)?\b/i,
    /\b(?:treat|treatment|therapy|cure)\b/i,
    /\b(?:medicine|medication|dose|dosage|tablet|pill|prescription|side effect|interaction)\b/i,
    /\b(?:should|can|may)\s+i\s+(?:take|stop|start|change|increase|decrease|avoid)\b/i,
    /\b(?:am|is|are)\s+i\s+(?:safe|okay|fine)\b/i,
    /\b(?:what\s+do\s+i\s+have|do\s+i\s+need\s+to\s+see\s+a\s+doctor)\b/i,
  ].some((pattern) => pattern.test(text));
}

function containsIllegalRequest(text: string): boolean {
  return [
    /\b(?:hack|phish|malware|ransomware|steal|scam|fraud|forge|fake\s+(?:a\s+)?(?:id|document|prescription))\b/i,
    /\b(?:weapon|bomb|poison|illegal\s+drug|controlled\s+substance)\b/i,
    /\b(?:evade|bypass)\s+(?:law|security|identity|verification)\b/i,
    /\b(?:dox|doxx|private\s+information|password|api\s+key|secret)\b/i,
  ].some((pattern) => pattern.test(text));
}
