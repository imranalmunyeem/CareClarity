import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  FileCheck2,
  FileText,
  GitCompareArrows,
  Image as ImageIcon,
  Languages,
  LockKeyhole,
  Loader2,
  Pill,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRoundCheck,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { LetterComparisonDashboard } from "./components/LetterComparisonDashboard";
import { ExportButtons, PatientDashboard } from "./components/PatientDashboard";
import { PrescriptionAdminDashboard } from "./components/PrescriptionAdminDashboard";
import { ProductChatWidget } from "./components/ProductChatWidget";
import { requestAnalysis, type AnalysisResult } from "./lib/analyzer";
import type { AIAnalysisAttachment } from "./lib/analysisSchema";
import { downloadTextFile, formatAnalysisAsText } from "./lib/format";
import {
  APP_LANGUAGE_STORAGE_KEY,
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  getAppCopy,
  getAppLanguageCode,
  getAppLanguageDirection,
  getAppLanguageLabel,
  isAppLanguage,
  isTranslationAppLanguage,
  type AppCopy,
  type AppLanguage,
} from "./lib/i18n";
import { downloadCarerSummaryPdf, downloadCarerSummaryText } from "./lib/carerSummary";
import { buildLetterComparison, type LetterComparisonResult } from "./lib/letterComparison";
import { buildPrescriptionAdminHelper, type PrescriptionAdminHelperResult } from "./lib/prescriptionAdmin";
import { requestProductChatAnswer } from "./lib/productChat";
import type { ProductChatMessage } from "./lib/productChatSchema";
import { requestSentenceExplanation } from "./lib/sentenceExplainer";
import type { ExplainSentenceResponse } from "./lib/sentenceExplainerSchema";
import { requestLetterTranslation } from "./lib/translator";
import { buildTranslationInput, hasEnoughTranslationInput } from "./lib/translationSource";
import {
  SUPPORTED_TRANSLATION_LANGUAGES,
  type SupportedTranslationLanguage,
  type TranslationResponse,
} from "./lib/translationSchema";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  mimeType: string;
  dataUrl: string;
  kind: "pdf" | "image";
}

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCESSIBILITY_MODE_STORAGE_KEY = "careclarity.accessibilityMode";

function readStoredAppLanguage(): AppLanguage {
  const storedLanguage = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return isAppLanguage(storedLanguage) ? storedLanguage : DEFAULT_APP_LANGUAGE;
}

function readStoredAccessibilityMode(): boolean {
  return window.localStorage.getItem(ACCESSIBILITY_MODE_STORAGE_KEY) === "true";
}

function stopSpeechSynthesis() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function buildReadAloudText({
  copy,
  result,
  translationResult,
  comparisonResult,
  prescriptionResult,
}: {
  copy: AppCopy;
  result: AnalysisResult | null;
  translationResult: TranslationResponse | null;
  comparisonResult: LetterComparisonResult | null;
  prescriptionResult: PrescriptionAdminHelperResult | null;
}): string {
  const lines = [
    "CareClarity.",
    `${copy.safetyBanner.label} ${copy.safetyBanner.text}`,
  ];

  if (prescriptionResult) {
    lines.push(
      copy.prescription.resultHeading,
      prescriptionResult.summary,
      copy.prescription.nextSteps,
      ...prescriptionResult.nextSteps,
      copy.prescription.detailsToConfirm,
      ...prescriptionResult.detailsToConfirm,
      prescriptionResult.safetyNotice,
    );
  } else if (comparisonResult) {
    lines.push(
      copy.comparison.resultHeading,
      comparisonResult.summary,
      copy.comparison.detailsToCheck,
      ...comparisonResult.detailsToCheck,
      comparisonResult.safetyNotice,
    );
  } else if (result) {
    lines.push(
      copy.results.heading,
      result.patientDashboardSummary,
      result.plainEnglishTranslation,
      copy.dashboard.actionChecklist,
      ...result.actionChecklist.map((item) => item.task),
      copy.dashboard.thingsToVerify,
      ...result.missingOrUncertainInformation,
      result.safetyValidation.safetyNotice,
    );
  } else if (translationResult) {
    lines.push(
      copy.translation.translatedLetter,
      translationResult.translatedLetter,
      copy.translation.translationNotes,
      ...translationResult.translationNotes,
      translationResult.safetyNotice,
    );
  } else {
    lines.push(copy.uploadPanel.heading, copy.uploadPanel.intro, copy.results.readyForPaperwork);
  }

  return lines
    .filter(Boolean)
    .join(". ")
    .replace(/\s+/g, " ")
    .slice(0, 4200);
}

function ComparisonUploadControl({
  id,
  label,
  files,
  inputRef,
  copy,
  onChange,
  onRemove,
}: {
  id: string;
  label: string;
  files: AttachedFile[];
  inputRef: { current: HTMLInputElement | null };
  copy: AppCopy;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="comparison-upload-control">
      <input
        ref={inputRef}
        className="file-input"
        id={id}
        type="file"
        accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.heic"
        onChange={onChange}
      />
      <button className="secondary-button comparison-upload-button" type="button" onClick={() => inputRef.current?.click()}>
        <UploadCloud size={18} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {files.length ? (
        <ul className="attachment-list comparison-attachment-list" aria-label={label}>
          {files.map((file) => (
            <li key={file.id}>
              {file.kind === "pdf" ? <FileCheck2 size={18} aria-hidden="true" /> : <ImageIcon size={18} aria-hidden="true" />}
              <div>
                <strong>{file.name}</strong>
                <span>
                  {file.kind === "pdf" ? copy.upload.pdf : copy.upload.image} - {formatBytes(file.size)}
                </span>
              </div>
              <button
                className="attachment-remove"
                type="button"
                onClick={onRemove}
                title={copy.comparison.removeUploadedLetter}
                aria-label={copy.comparison.removeUploadedLetter}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="input-helper">{copy.comparison.uploadHelper}</p>
      )}
    </div>
  );
}

function App() {
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => readStoredAppLanguage());
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(() => readStoredAccessibilityMode());
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [letterText, setLetterText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sentenceText, setSentenceText] = useState("");
  const [sentenceResult, setSentenceResult] = useState<ExplainSentenceResponse | null>(null);
  const [sentenceError, setSentenceError] = useState("");
  const [isExplainingSentence, setIsExplainingSentence] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<SupportedTranslationLanguage>("Bengali");
  const [translationResult, setTranslationResult] = useState<TranslationResponse | null>(null);
  const [translationError, setTranslationError] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [comparisonPreviousText, setComparisonPreviousText] = useState("");
  const [comparisonUpdatedText, setComparisonUpdatedText] = useState("");
  const [comparisonPreviousFiles, setComparisonPreviousFiles] = useState<AttachedFile[]>([]);
  const [comparisonUpdatedFiles, setComparisonUpdatedFiles] = useState<AttachedFile[]>([]);
  const [comparisonResult, setComparisonResult] = useState<LetterComparisonResult | null>(null);
  const [comparisonError, setComparisonError] = useState("");
  const [isComparingLetters, setIsComparingLetters] = useState(false);
  const [prescriptionText, setPrescriptionText] = useState("");
  const [prescriptionResult, setPrescriptionResult] = useState<PrescriptionAdminHelperResult | null>(null);
  const [prescriptionError, setPrescriptionError] = useState("");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ProductChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const comparisonPreviousFileInputRef = useRef<HTMLInputElement | null>(null);
  const comparisonUpdatedFileInputRef = useRef<HTMLInputElement | null>(null);
  const actionMessageTimerRef = useRef<number | null>(null);
  const copy = getAppCopy(appLanguage);
  const appDirection = getAppLanguageDirection(appLanguage);

  const textStats = useMemo(() => {
    const words = letterText.trim() ? letterText.trim().split(/\s+/).length : 0;
    return copy.uploadPanel.textStats(letterText.length, words);
  }, [copy, letterText]);
  const hasAnalysisInput = Boolean(letterText.trim() || attachedFiles.length);
  const hasPreviousComparisonInput = Boolean(comparisonPreviousText.trim().length >= 30 || comparisonPreviousFiles.length);
  const hasUpdatedComparisonInput = Boolean(comparisonUpdatedText.trim().length >= 30 || comparisonUpdatedFiles.length);
  const hasPrescriptionInput = Boolean(prescriptionText.trim() || letterText.trim());
  const hasExportableResult = Boolean(result || translationResult || comparisonResult || prescriptionResult);
  const translationInput = useMemo(
    () =>
      buildTranslationInput({
        letterText,
        result,
        comparisonResult,
        prescriptionResult,
      }),
    [letterText, result, comparisonResult, prescriptionResult],
  );
  const hasTranslationInput = hasEnoughTranslationInput(translationInput);

  useEffect(() => {
    document.documentElement.lang = getAppLanguageCode(appLanguage);
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, appLanguage);
  }, [appLanguage]);

  useEffect(() => {
    window.localStorage.setItem(ACCESSIBILITY_MODE_STORAGE_KEY, isAccessibilityMode ? "true" : "false");

    if (!isAccessibilityMode) {
      stopSpeechSynthesis();
      setIsReadingAloud(false);
    }
  }, [isAccessibilityMode]);

  useEffect(() => {
    return () => {
      if (actionMessageTimerRef.current) {
        window.clearTimeout(actionMessageTimerRef.current);
      }
      stopSpeechSynthesis();
    };
  }, []);

  async function handleAnalyze() {
    if (!hasAnalysisInput) {
      showActionMessage(copy.actions.pasteOrUploadBeforeAnalysis);
      return;
    }

    setIsAnalyzing(true);
    setCopied(false);
    setTranslationResult(null);
    setTranslationError("");
    showActionMessage(copy.actions.analyzingNotice);

    try {
      const analysis = await requestAnalysis(letterText, toAnalysisAttachments(attachedFiles));
      setResult(analysis);
      setComparisonResult(null);
      setPrescriptionResult(null);
      showActionMessage(analysis.mode === "ai" ? copy.actions.aiCompleted : copy.actions.fallbackReady);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const oversizedCount = files.filter(
      (file) => isSupportedAttachment(file) && file.size > MAX_ATTACHMENT_BYTES,
    ).length;

    const acceptedFiles = await Promise.all(
      files
        .filter((file) => isSupportedAttachment(file) && file.size <= MAX_ATTACHMENT_BYTES)
        .map(fileToAttachedFile),
    );

    if (!acceptedFiles.length) {
      showActionMessage(
        oversizedCount
          ? copy.actions.chooseSmallFile
          : copy.actions.choosePdfOrImage,
      );
      event.target.value = "";
      return;
    }

    setAttachedFiles((current) => {
      const seen = new Set(current.map((file) => file.id));
      const next = [...current];
      let addedCount = 0;

      for (const file of acceptedFiles) {
        if (seen.has(file.id) || next.length >= MAX_ATTACHMENTS) continue;
        next.push(file);
        seen.add(file.id);
        addedCount += 1;
      }

      showActionMessage(addedCount ? copy.actions.filesReady : copy.actions.noNewFiles);

      return next;
    });

    event.target.value = "";
  }

  function removeAttachment(fileId: string) {
    setAttachedFiles((current) => current.filter((file) => file.id !== fileId));
    showActionMessage(copy.actions.attachmentRemoved);
  }

  async function handleComparisonFileChange(
    side: "previous" | "updated",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!isSupportedAttachment(file)) {
      showActionMessage(copy.actions.choosePdfOrImage);
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      showActionMessage(copy.actions.chooseSmallFile);
      return;
    }

    const attachedFile = await fileToAttachedFile(file);

    if (side === "previous") {
      setComparisonPreviousFiles([attachedFile]);
    } else {
      setComparisonUpdatedFiles([attachedFile]);
    }

    setComparisonError("");
    showActionMessage(side === "previous" ? copy.comparison.previousFileReady : copy.comparison.updatedFileReady);
  }

  function removeComparisonFile(side: "previous" | "updated") {
    if (side === "previous") {
      setComparisonPreviousFiles([]);
      if (comparisonPreviousFileInputRef.current) comparisonPreviousFileInputRef.current.value = "";
    } else {
      setComparisonUpdatedFiles([]);
      if (comparisonUpdatedFileInputRef.current) comparisonUpdatedFileInputRef.current.value = "";
    }

    showActionMessage(copy.comparison.removeUploadedLetter);
  }

  async function handleExplainSentence() {
    const sentence = sentenceText.trim();

    if (sentence.length < 8) {
      setSentenceError(copy.actions.sentenceNeedFull);
      setSentenceResult(null);
      return;
    }

    setIsExplainingSentence(true);
    setSentenceError("");
    setSentenceResult(null);
    showActionMessage(copy.actions.sentenceExplaining);

    try {
      const explanation = await requestSentenceExplanation(sentence);
      setSentenceResult(explanation);
      showActionMessage(copy.actions.sentenceReady);
    } catch {
      setSentenceError(copy.actions.sentenceUnavailable);
    } finally {
      setIsExplainingSentence(false);
    }
  }

  async function handleTranslateLetter() {
    const text = translationInput.trim();

    if (!hasEnoughTranslationInput(text)) {
      setTranslationError(copy.actions.translationNeedText);
      setTranslationResult(null);
      return;
    }

    setIsTranslating(true);
    setTranslationError("");
    setTranslationResult(null);
    showActionMessage(copy.actions.translationStarted(getAppLanguageLabel(targetLanguage)));

    try {
      const translation = await requestLetterTranslation(text, targetLanguage);
      setTranslationResult(translation);
      showActionMessage(copy.actions.translationReady(getAppLanguageLabel(translation.targetLanguage)));
    } catch {
      setTranslationError(copy.actions.translationUnavailable);
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleCompareLetters() {
    const previousText = comparisonPreviousText.trim();
    const updatedText = comparisonUpdatedText.trim();

    if (!hasPreviousComparisonInput || !hasUpdatedComparisonInput) {
      setComparisonError(copy.comparison.needBothLetters);
      setComparisonResult(null);
      return;
    }

    setIsComparingLetters(true);
    setComparisonError("");
    setComparisonResult(null);
    setTranslationResult(null);
    setTranslationError("");
    setCopied(false);
    showActionMessage(copy.comparison.started);

    try {
      const [previousAnalysis, updatedAnalysis] = await Promise.all([
        requestAnalysis(previousText, toAnalysisAttachments(comparisonPreviousFiles)),
        requestAnalysis(updatedText, toAnalysisAttachments(comparisonUpdatedFiles)),
      ]);
      const comparison = buildLetterComparison(previousAnalysis, updatedAnalysis);

      setResult(null);
      setPrescriptionResult(null);
      setComparisonResult(comparison);
      showActionMessage(copy.comparison.ready);
    } catch {
      setComparisonError(copy.comparison.unavailable);
    } finally {
      setIsComparingLetters(false);
    }
  }

  function handlePrescriptionAdmin() {
    const text = (prescriptionText.trim() || letterText.trim()).trim();

    if (text.length < 20) {
      setPrescriptionError(copy.prescription.needText);
      setPrescriptionResult(null);
      return;
    }

    const helperResult = buildPrescriptionAdminHelper(text);
    setPrescriptionError("");
    setComparisonResult(null);
    setResult(null);
    setTranslationResult(null);
    setTranslationError("");
    setPrescriptionResult(helperResult);
    setCopied(false);
    showActionMessage(copy.prescription.ready);
  }

  async function handleProductChat() {
    const question = chatQuestion.trim();

    if (question.length < 3) {
      setChatError(copy.actions.chatNeedQuestion);
      return;
    }

    const recentHistory = chatHistory.slice(-8);
    setIsChatOpen(true);
    setIsChatting(true);
    setChatError("");
    setChatQuestion("");
    setChatHistory((current) => [...current, { role: "user", content: question }]);

    try {
      const response = await requestProductChatAnswer(question, recentHistory);
      const assistantContent = [
        response.answer,
        response.suggestedNextStep,
        response.safetyNotice,
      ]
        .filter(Boolean)
        .join("\n\n");

      setChatHistory((current) => [...current, { role: "assistant", content: assistantContent }]);
    } catch {
      setChatError(copy.actions.chatUnavailable);
    } finally {
      setIsChatting(false);
    }
  }

  async function handleCopy() {
    if (!hasExportableResult) return;
    const didCopy = await copyText(formatAnalysisAsText(result, translationResult, comparisonResult, prescriptionResult));
    if (didCopy) {
      setCopied(true);
      showActionMessage(copy.actions.copied);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      setCopied(false);
      showActionMessage(copy.actions.copyBlocked);
    }
  }

  function handleDownload() {
    if (!hasExportableResult) return;
    downloadTextFile(
      "careclarity-summary.txt",
      formatAnalysisAsText(result, translationResult, comparisonResult, prescriptionResult),
    );
    showActionMessage(copy.actions.downloadStarted);
  }

  function handleDownloadCarerTxt() {
    if (!result) return;
    downloadCarerSummaryText(result);
    showActionMessage(copy.carerSummary.txtStarted);
  }

  function handleDownloadCarerPdf() {
    if (!result) return;
    downloadCarerSummaryPdf(result);
    showActionMessage(copy.carerSummary.pdfStarted);
  }

  function handleAppLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLanguage = event.target.value;

    if (!isAppLanguage(nextLanguage)) return;

    const nextCopy = getAppCopy(nextLanguage);
    setAppLanguage(nextLanguage);
    setSentenceError("");
    setTranslationError("");
    setChatError("");
    setComparisonError("");
    setPrescriptionError("");

    if (isTranslationAppLanguage(nextLanguage)) {
      setTargetLanguage(nextLanguage);
    }

    showActionMessage(nextCopy.actions.languageChanged(getAppLanguageLabel(nextLanguage)));
  }

  function handleToggleAccessibilityMode() {
    const nextMode = !isAccessibilityMode;
    setIsAccessibilityMode(nextMode);

    if (!nextMode) {
      stopSpeechSynthesis();
      setIsReadingAloud(false);
    }

    showActionMessage(nextMode ? copy.accessibility.enabled : copy.accessibility.disabled);
  }

  function handleReadAloud() {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      showActionMessage(copy.accessibility.readUnavailable);
      return;
    }

    stopSpeechSynthesis();

    const utterance = new SpeechSynthesisUtterance(
      buildReadAloudText({
        copy,
        result,
        translationResult,
        comparisonResult,
        prescriptionResult,
      }),
    );
    utterance.lang = getAppLanguageCode(appLanguage);
    utterance.rate = 0.88;
    utterance.onend = () => setIsReadingAloud(false);
    utterance.onerror = () => setIsReadingAloud(false);

    setIsReadingAloud(true);
    window.speechSynthesis.speak(utterance);
    showActionMessage(copy.accessibility.readStarted);
  }

  function handleStopReadAloud() {
    stopSpeechSynthesis();
    setIsReadingAloud(false);
    showActionMessage(copy.accessibility.readStopped);
  }

  function handleUploadKeyDown(event: KeyboardEvent<HTMLLabelElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    fileInputRef.current?.click();
  }

  function showActionMessage(message: string) {
    setActionMessage(message);

    if (actionMessageTimerRef.current) {
      window.clearTimeout(actionMessageTimerRef.current);
    }

    actionMessageTimerRef.current = window.setTimeout(() => {
      setActionMessage("");
      actionMessageTimerRef.current = null;
    }, 3200);
  }

  return (
    <div
      className={isAccessibilityMode ? "app-root accessibility-mode" : "app-root"}
      lang={getAppLanguageCode(appLanguage)}
      dir={appDirection}
    >
      <div className="sticky-frame">
        <header className="app-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h1>CareClarity</h1>
              <p>{copy.header.subtitle}</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className={isAccessibilityMode ? "accessibility-toggle active" : "accessibility-toggle"}
              type="button"
              onClick={handleToggleAccessibilityMode}
              aria-pressed={isAccessibilityMode}
              title={isAccessibilityMode ? copy.accessibility.toggleOff : copy.accessibility.toggleOn}
            >
              <Eye size={17} aria-hidden="true" />
              <span>{isAccessibilityMode ? copy.accessibility.toggleOff : copy.accessibility.toggleOn}</span>
            </button>
            <div className="language-control">
              <label htmlFor="app-language">
                <Languages size={15} aria-hidden="true" />
                <span>{copy.header.languageLabel}</span>
              </label>
              <select id="app-language" value={appLanguage} onChange={handleAppLanguageChange}>
                {APP_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {getAppLanguageLabel(language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="status-group" aria-label={copy.header.safeguardsLabel}>
              <span className="status-pill">{copy.header.adminSupportOnly}</span>
              <span className="status-pill privacy">{copy.header.noLoginRequired}</span>
            </div>
          </div>
        </header>

        <div className="safety-banner" role="note">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            <strong>{copy.safetyBanner.label}</strong> {copy.safetyBanner.text}
          </p>
        </div>
        {isAccessibilityMode ? (
          <div className="accessibility-toolbar" role="region" aria-label={copy.accessibility.modeOn}>
            <div>
              <strong>{copy.accessibility.modeOn}</strong>
              <span>{copy.accessibility.description}</span>
            </div>
            <div className="accessibility-toolbar-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={isReadingAloud ? handleStopReadAloud : handleReadAloud}
              >
                {isReadingAloud ? <VolumeX size={18} /> : <Volume2 size={18} />}
                <span>{isReadingAloud ? copy.accessibility.stopReading : copy.accessibility.readPage}</span>
              </button>
              <button className="secondary-button subtle-button" type="button" onClick={handleToggleAccessibilityMode}>
                <span>{copy.accessibility.turnOff}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <main className="workspace-shell">
        <section className="tool-panel input-panel" aria-labelledby="letter-heading">
          <div className="panel-heading">
            <div>
              <h2 id="letter-heading">{copy.uploadPanel.heading}</h2>
              <p>{copy.uploadPanel.intro}</p>
            </div>
          </div>

          <label className="field-label" htmlFor="letter-text">
            {copy.uploadPanel.optionalLetterLabel}
          </label>
          <textarea
            id="letter-text"
            placeholder={copy.uploadPanel.letterPlaceholder}
              value={letterText}
              onChange={(event) => {
                setLetterText(event.target.value);
                setTranslationResult(null);
                setTranslationError("");
              }}
              aria-describedby="letter-helper"
              spellCheck="true"
            />
          <p id="letter-helper" className="input-helper">{copy.uploadPanel.letterHelper}</p>

          <div className="input-footer">
            <span className="text-stat">{textStats}</span>
          </div>

          <section className="trust-block" aria-labelledby="trust-heading">
            <div className="trust-heading">
              <LockKeyhole size={18} aria-hidden="true" />
              <div>
                <h3 id="trust-heading">{copy.trust.heading}</h3>
                <p>{copy.trust.text}</p>
              </div>
            </div>
            <ul className="trust-list">
              <li>
                <UserRoundCheck size={17} aria-hidden="true" />
                <span>{copy.trust.noAccount}</span>
              </li>
              <li>
                <Database size={17} aria-hidden="true" />
                <span>{copy.trust.noStorage}</span>
              </li>
              <li>
                <ShieldCheck size={17} aria-hidden="true" />
                <span>{copy.trust.filesRequestOnly}</span>
              </li>
            </ul>
          </section>

          <details className="compare-card nhs-app-card">
            <summary>
              <span className="sentence-icon nhs-app-icon" aria-hidden="true">
                <Smartphone size={18} />
              </span>
              <span>
                <strong>{copy.nhsApp.heading}</strong>
                <small>{copy.nhsApp.intro}</small>
              </span>
            </summary>
            <div className="nhs-app-guide">
              <section>
                <h4>{copy.nhsApp.beforeYouStart}</h4>
                <ul className="dashboard-list">
                  {copy.nhsApp.steps.slice(0, 1).map((step) => (
                    <li key={step}>
                      <CheckCircle2 size={18} aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>{copy.nhsApp.findingAppointments}</h4>
                <ul className="dashboard-list">
                  {copy.nhsApp.steps.slice(1, 3).map((step) => (
                    <li key={step}>
                      <FileText size={18} aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>{copy.nhsApp.findingPrescriptions}</h4>
                <ul className="dashboard-list">
                  {copy.nhsApp.steps.slice(3, 4).map((step) => (
                    <li key={step}>
                      <Pill size={18} aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>{copy.nhsApp.ifDetailsDoNotMatch}</h4>
                <ul className="dashboard-list warning">
                  {copy.nhsApp.steps.slice(4).map((step) => (
                    <li key={step}>
                      <AlertTriangle size={18} aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <p className="comparison-safety">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>{copy.nhsApp.safety}</span>
              </p>
            </div>
          </details>

          <details
            className="compare-card"
            open={Boolean(comparisonPreviousText || comparisonUpdatedText || comparisonResult || comparisonError)}
          >
            <summary>
              <span className="sentence-icon compare-icon" aria-hidden="true">
                <GitCompareArrows size={18} />
              </span>
              <span>
                <strong>{copy.comparison.heading}</strong>
                <small>{copy.comparison.intro}</small>
              </span>
            </summary>
            <div className="compare-body">
              <div className="compare-grid">
                <div>
                  <label className="field-label" htmlFor="comparison-previous-letter">
                    {copy.comparison.previousLabel}
                  </label>
                  <textarea
                    id="comparison-previous-letter"
                    className="comparison-input"
                    placeholder={copy.comparison.previousPlaceholder}
                    value={comparisonPreviousText}
                    onChange={(event) => {
                      setComparisonPreviousText(event.target.value);
                      setComparisonError("");
                    }}
                  />
                  <ComparisonUploadControl
                    id="comparison-previous-upload"
                    label={copy.comparison.previousUploadLabel}
                    files={comparisonPreviousFiles}
                    inputRef={comparisonPreviousFileInputRef}
                    copy={copy}
                    onChange={(event) => handleComparisonFileChange("previous", event)}
                    onRemove={() => removeComparisonFile("previous")}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="comparison-updated-letter">
                    {copy.comparison.updatedLabel}
                  </label>
                  <textarea
                    id="comparison-updated-letter"
                    className="comparison-input"
                    placeholder={copy.comparison.updatedPlaceholder}
                    value={comparisonUpdatedText}
                    onChange={(event) => {
                      setComparisonUpdatedText(event.target.value);
                      setComparisonError("");
                    }}
                  />
                  <ComparisonUploadControl
                    id="comparison-updated-upload"
                    label={copy.comparison.updatedUploadLabel}
                    files={comparisonUpdatedFiles}
                    inputRef={comparisonUpdatedFileInputRef}
                    copy={copy}
                    onChange={(event) => handleComparisonFileChange("updated", event)}
                    onRemove={() => removeComparisonFile("updated")}
                  />
                </div>
              </div>
              <div className="compare-actions">
                <button
                  className="secondary-button compare-button"
                  type="button"
                  onClick={handleCompareLetters}
                  disabled={isComparingLetters || !hasPreviousComparisonInput || !hasUpdatedComparisonInput}
                >
                  {isComparingLetters ? <Loader2 className="spin" size={18} /> : <GitCompareArrows size={18} />}
                  <span>{isComparingLetters ? copy.comparison.comparing : copy.comparison.compareButton}</span>
                </button>
                <button
                  className="secondary-button subtle-button"
                  type="button"
                  onClick={() => {
                    setComparisonPreviousText("");
                    setComparisonUpdatedText("");
                    setComparisonPreviousFiles([]);
                    setComparisonUpdatedFiles([]);
                    setComparisonResult(null);
                    setComparisonError("");
                    if (comparisonPreviousFileInputRef.current) comparisonPreviousFileInputRef.current.value = "";
                    if (comparisonUpdatedFileInputRef.current) comparisonUpdatedFileInputRef.current.value = "";
                    showActionMessage(copy.comparison.clearButton);
                  }}
                  disabled={
                    isComparingLetters ||
                    (!comparisonPreviousText &&
                      !comparisonUpdatedText &&
                      !comparisonPreviousFiles.length &&
                      !comparisonUpdatedFiles.length &&
                      !comparisonResult)
                  }
                >
                  <span>{copy.comparison.clearButton}</span>
                </button>
              </div>
              {comparisonError ? (
                <p className="sentence-error" role="alert">
                  {comparisonError}
                </p>
              ) : null}
            </div>
          </details>

          <details
            className="compare-card prescription-card"
            open={Boolean(prescriptionText || prescriptionResult || prescriptionError)}
          >
            <summary>
              <span className="sentence-icon prescription-icon" aria-hidden="true">
                <Pill size={18} />
              </span>
              <span>
                <strong>{copy.prescription.heading}</strong>
                <small>{copy.prescription.intro}</small>
              </span>
            </summary>
            <div className="compare-body">
              <label className="field-label" htmlFor="prescription-admin-text">
                {copy.prescription.label}
              </label>
              <textarea
                id="prescription-admin-text"
                className="sentence-input"
                placeholder={copy.prescription.placeholder}
                value={prescriptionText}
                onChange={(event) => {
                  setPrescriptionText(event.target.value);
                  setPrescriptionError("");
                }}
                aria-describedby="prescription-admin-helper"
              />
              <p id="prescription-admin-helper" className="input-helper">
                {copy.prescription.helper}
              </p>
              <div className="compare-actions">
                <button
                  className="secondary-button compare-button"
                  type="button"
                  onClick={handlePrescriptionAdmin}
                  disabled={!hasPrescriptionInput}
                >
                  <Pill size={18} aria-hidden="true" />
                  <span>{copy.prescription.checkButton}</span>
                </button>
                <button
                  className="secondary-button subtle-button"
                  type="button"
                  onClick={() => {
                    setPrescriptionText("");
                    setPrescriptionResult(null);
                    setPrescriptionError("");
                    showActionMessage(copy.prescription.clearButton);
                  }}
                  disabled={!prescriptionText && !prescriptionResult && !prescriptionError}
                >
                  <span>{copy.prescription.clearButton}</span>
                </button>
              </div>
              {prescriptionError ? (
                <p className="sentence-error" role="alert">
                  {prescriptionError}
                </p>
              ) : null}
            </div>
          </details>

          <section className="sentence-card" aria-labelledby="sentence-heading">
            <div className="sentence-heading">
              <span className="sentence-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <div>
                <h3 id="sentence-heading">{copy.sentence.heading}</h3>
                <p>{copy.sentence.intro}</p>
              </div>
            </div>
            <label className="field-label" htmlFor="sentence-text">
              {copy.sentence.label}
            </label>
            <textarea
              id="sentence-text"
              className="sentence-input"
              placeholder={copy.sentence.placeholder}
              value={sentenceText}
              onChange={(event) => {
                setSentenceText(event.target.value);
                setSentenceError("");
              }}
              aria-describedby="sentence-helper"
            />
            <p id="sentence-helper" className="input-helper">{copy.sentence.helper}</p>
            <button
              className="secondary-button sentence-button"
              type="button"
              onClick={handleExplainSentence}
              disabled={isExplainingSentence || sentenceText.trim().length < 8}
            >
              {isExplainingSentence ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              <span>{isExplainingSentence ? copy.sentence.explaining : copy.sentence.explain}</span>
            </button>
            {sentenceError ? (
              <p className="sentence-error" role="alert">
                {sentenceError}
              </p>
            ) : null}
            {sentenceResult ? (
              <div className="sentence-result" aria-live="polite">
                <dl>
                  <div>
                    <dt>{copy.sentence.plainMeaning}</dt>
                    <dd>{sentenceResult.plainEnglishMeaning}</dd>
                  </div>
                  <div>
                    <dt>{copy.sentence.whyItMatters}</dt>
                    <dd>{sentenceResult.whyItMatters}</dd>
                  </div>
                  <div>
                    <dt>{copy.sentence.actionIfAny}</dt>
                    <dd>{sentenceResult.actionIfAny}</dd>
                  </div>
                </dl>
                <p>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>{sentenceResult.safetyNotice}</span>
                </p>
              </div>
            ) : null}
          </section>

          <section className="translation-card" aria-labelledby="translation-heading">
            <div className="sentence-heading">
              <span className="sentence-icon translation-icon" aria-hidden="true">
                <Languages size={18} />
              </span>
              <div>
                <h3 id="translation-heading">{copy.translation.heading}</h3>
                <p>{copy.translation.intro}</p>
              </div>
            </div>
            <div className="translation-controls">
              <div>
                <label className="field-label" htmlFor="translation-language">
                  {copy.translation.preferredLanguage}
                </label>
                <select
                  id="translation-language"
                  value={targetLanguage}
                  onChange={(event) => {
                    setTargetLanguage(event.target.value as SupportedTranslationLanguage);
                    setTranslationError("");
                  }}
                >
                  {SUPPORTED_TRANSLATION_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {getAppLanguageLabel(language)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="secondary-button translate-button"
                type="button"
                onClick={handleTranslateLetter}
                disabled={isTranslating || !hasTranslationInput}
            >
              {isTranslating ? <Loader2 className="spin" size={18} /> : <Languages size={18} />}
                <span>{isTranslating ? copy.translation.translating : copy.translation.translateLetter}</span>
              </button>
            </div>
            {translationError ? (
              <p className="sentence-error" role="alert">
                {translationError}
              </p>
            ) : null}
          </section>

          <section className="upload-block" aria-labelledby="upload-heading">
            <div className="upload-copy">
              <h3 id="upload-heading">{copy.upload.heading}</h3>
              <p>{copy.upload.intro}</p>
            </div>
            <label
              className="upload-control"
              htmlFor="document-upload"
              role="button"
              tabIndex={0}
              aria-controls="document-upload"
              aria-describedby="upload-note"
              onKeyDown={handleUploadKeyDown}
            >
              <UploadCloud size={22} aria-hidden="true" />
              <span>{copy.upload.choosePdfImage}</span>
              <small>{copy.upload.fileTypes}</small>
            </label>
            <input
              ref={fileInputRef}
              className="file-input"
              id="document-upload"
              type="file"
              accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.heic"
              multiple
              aria-describedby="upload-note"
              onChange={handleFileChange}
            />
            {attachedFiles.length ? (
              <ul className="attachment-list" aria-label={copy.upload.filesReadyAria}>
                {attachedFiles.map((file) => (
                  <li key={file.id}>
                    {file.kind === "pdf" ? (
                      <FileCheck2 size={18} aria-hidden="true" />
                    ) : (
                      <ImageIcon size={18} aria-hidden="true" />
                    )}
                    <div>
                      <strong>{file.name}</strong>
                      <span>
                        {file.kind === "pdf" ? copy.upload.pdf : copy.upload.image} - {formatBytes(file.size)}
                      </span>
                    </div>
                    <button
                      className="attachment-remove"
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      title={copy.upload.removeFile(file.name)}
                      aria-label={copy.upload.removeFile(file.name)}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p id="upload-note" className="upload-note">{copy.upload.note}</p>
          </section>

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !hasAnalysisInput}
              title={copy.buttons.analyzePaperwork}
            >
              {isAnalyzing ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              <span>{isAnalyzing ? copy.buttons.analyzing : copy.buttons.analyze}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setLetterText("");
                setAttachedFiles([]);
                setSentenceText("");
                setSentenceResult(null);
                setSentenceError("");
                setTranslationResult(null);
                setTranslationError("");
                setComparisonPreviousText("");
                setComparisonUpdatedText("");
                setComparisonPreviousFiles([]);
                setComparisonUpdatedFiles([]);
                setComparisonResult(null);
                setComparisonError("");
                setPrescriptionText("");
                setPrescriptionResult(null);
                setPrescriptionError("");
                setChatQuestion("");
                setChatHistory([]);
                setChatError("");
                if (fileInputRef.current) fileInputRef.current.value = "";
                if (comparisonPreviousFileInputRef.current) comparisonPreviousFileInputRef.current.value = "";
                if (comparisonUpdatedFileInputRef.current) comparisonUpdatedFileInputRef.current.value = "";
                setResult(null);
                setCopied(false);
                showActionMessage(copy.actions.cleared);
              }}
              title={copy.buttons.clearPaperwork}
              aria-label={copy.buttons.clearPaperwork}
            >
              <Trash2 size={18} />
            </button>
          </div>
          <ActionStatus message={actionMessage} />
        </section>

        <section
          className="results-panel dashboard-shell"
          aria-labelledby="results-heading"
          aria-busy={isAnalyzing || isComparingLetters}
        >
          <div className="results-topbar">
            <div>
              <h2 id="results-heading">
                {prescriptionResult
                  ? copy.prescription.resultHeading
                  : comparisonResult
                    ? copy.comparison.resultHeading
                    : translationResult && !result
                      ? copy.translation.heading
                    : copy.results.heading}
              </h2>
              <p>
                {prescriptionResult
                  ? copy.prescription.resultReady
                  : comparisonResult
                  ? copy.comparison.resultReady
                  : result
                  ? resultModeLabel(result, copy.results)
                  : translationResult
                    ? copy.results.translationReady(getAppLanguageLabel(translationResult.targetLanguage))
                    : copy.results.noAnalysisYet}
              </p>
            </div>
            <ExportButtons
              copied={copied}
              disabled={!hasExportableResult}
              copy={copy.export}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          </div>

          {prescriptionResult ? (
            <>
              <PrescriptionAdminDashboard result={prescriptionResult} copy={copy.prescription} />
              {translationResult ? <TranslationResultPanel result={translationResult} copy={copy.translation} /> : null}
            </>
          ) : comparisonResult ? (
            <>
              <LetterComparisonDashboard
                comparison={comparisonResult}
                copy={copy.comparison}
                dashboardCopy={copy.dashboard}
              />
              {translationResult ? <TranslationResultPanel result={translationResult} copy={copy.translation} /> : null}
            </>
          ) : result ? (
            <>
              <ResultNotice result={result} copy={copy.results} />
              <PatientDashboard
                result={result}
                copy={copy.dashboard}
                carerCopy={copy.carerSummary}
                onDownloadCarerTxt={handleDownloadCarerTxt}
                onDownloadCarerPdf={handleDownloadCarerPdf}
              />
              {translationResult ? <TranslationResultPanel result={translationResult} copy={copy.translation} /> : null}
            </>
          ) : translationResult ? (
            <TranslationResultPanel result={translationResult} copy={copy.translation} />
          ) : isAnalyzing || isComparingLetters ? (
            <div className="empty-state loading" aria-live="polite">
              <Loader2 className="spin" size={42} />
              <span>{isComparingLetters ? copy.comparison.comparing : copy.results.analyzingSafely}</span>
            </div>
          ) : (
            <div className="empty-state" aria-live="polite">
              <FileText size={42} />
              <span>{copy.results.readyForPaperwork}</span>
            </div>
          )}
        </section>
      </main>
      <footer className="app-footer" aria-label="CareClarity copyright">
        <p>Copyright © 2026 Imran Al Munyeem. All rights reserved.</p>
      </footer>
      <ProductChatWidget
        isOpen={isChatOpen}
        question={chatQuestion}
        history={chatHistory}
        error={chatError}
        isLoading={isChatting}
        copy={copy.chat}
        onClose={() => setIsChatOpen(false)}
        onToggle={() => setIsChatOpen((open) => !open)}
        onQuestionChange={(value) => {
          setChatQuestion(value);
          setChatError("");
        }}
        onSubmit={handleProductChat}
      />
    </div>
  );
}

function ActionStatus({ message }: { message: string }) {
  return (
    <div className={message ? "action-status visible" : "action-status"} role="status" aria-live="polite">
      {message ? (
        <>
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{message}</span>
        </>
      ) : null}
    </div>
  );
}

function ResultNotice({ result, copy }: { result: AnalysisResult; copy: AppCopy["results"] }) {
  if (result.mode === "ai") {
    return (
      <div className="result-notice success" role="status">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>{copy.aiNotice}</span>
      </div>
    );
  }

  return (
    <div className="result-notice" role="status">
      <AlertTriangle size={17} aria-hidden="true" />
      <span>
        {copy.fallbackNotice} {copy.fallbackTail}
      </span>
    </div>
  );
}

function TranslationResultPanel({
  result,
  copy,
}: {
  result: TranslationResponse;
  copy: AppCopy["translation"];
}) {
  return (
    <section className="translation-result output-translation-card" aria-live="polite">
      <header>
        <span>{getAppLanguageLabel(result.targetLanguage)}</span>
        <strong>{copy.confidenceLabel(result.confidence)}</strong>
      </header>
      <section>
        <h4>{copy.translatedLetter}</h4>
        <p>{result.translatedLetter}</p>
      </section>
      <section>
        <h4>{copy.importantTerms}</h4>
        <ul>
          {result.importantTerms.map((term) => (
            <li key={`${term.originalTerm}-${term.translatedOrExplainedMeaning}`}>
              <strong>{term.originalTerm}</strong>
              <span>{term.translatedOrExplainedMeaning}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4>{copy.translationNotes}</h4>
        <ul>
          {result.translationNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
      <p className="translation-safety">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{result.safetyNotice}</span>
      </p>
    </section>
  );
}

function resultModeLabel(result: AnalysisResult, copy: AppCopy["results"]): string {
  return result.mode === "ai" ? copy.aiEndpointResult : copy.fallbackResult;
}

export default App;

function toAnalysisAttachments(files: AttachedFile[]): AIAnalysisAttachment[] {
  return files.map((file) => ({
    name: file.name,
    mimeType: file.mimeType,
    dataUrl: file.dataUrl,
    kind: file.kind,
  }));
}

function isSupportedAttachment(file: File): boolean {
  return isPdf(file) || isImage(file);
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(file.name);
}

function getAttachmentMimeType(file: File): string {
  if (isPdf(file)) return "application/pdf";
  if (file.type.startsWith("image/")) return file.type;
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  if (/\.gif$/i.test(file.name)) return "image/gif";
  if (/\.heic$/i.test(file.name)) return "image/heic";
  return "image/jpeg";
}

async function fileToAttachedFile(file: File): Promise<AttachedFile> {
  const mimeType = getAttachmentMimeType(file);
  const dataUrl = normalizeDataUrl(await readFileAsDataUrl(file), mimeType);

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    type: file.type || mimeType,
    mimeType,
    dataUrl,
    kind: isPdf(file) ? "pdf" : "image",
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

function normalizeDataUrl(dataUrl: string, mimeType: string): string {
  return dataUrl.replace(/^data:[^;]*;base64,/i, `data:${mimeType};base64,`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Some browsers deny clipboard writes even on localhost.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.width = "1px";
  textArea.style.height = "1px";
  textArea.style.opacity = "0";

  document.body.append(textArea);
  textArea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textArea.remove();
  }
}
