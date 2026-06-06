import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  Languages,
  LockKeyhole,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ExportButtons, PatientDashboard } from "./components/PatientDashboard";
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
import { requestProductChatAnswer } from "./lib/productChat";
import type { ProductChatMessage } from "./lib/productChatSchema";
import { requestSentenceExplanation } from "./lib/sentenceExplainer";
import type { ExplainSentenceResponse } from "./lib/sentenceExplainerSchema";
import { requestLetterTranslation } from "./lib/translator";
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

function App() {
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => readStoredAppLanguage());
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
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ProductChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actionMessageTimerRef = useRef<number | null>(null);
  const copy = getAppCopy(appLanguage);
  const appDirection = getAppLanguageDirection(appLanguage);

  const textStats = useMemo(() => {
    const words = letterText.trim() ? letterText.trim().split(/\s+/).length : 0;
    return copy.uploadPanel.textStats(letterText.length, words);
  }, [copy, letterText]);
  const hasAnalysisInput = Boolean(letterText.trim() || attachedFiles.length);

  useEffect(() => {
    document.documentElement.lang = getAppLanguageCode(appLanguage);
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, appLanguage);
  }, [appLanguage]);

  async function handleAnalyze() {
    if (!hasAnalysisInput) {
      showActionMessage(copy.actions.pasteOrUploadBeforeAnalysis);
      return;
    }

    setIsAnalyzing(true);
    setCopied(false);
    showActionMessage(copy.actions.analyzingNotice);

    try {
      const analysis = await requestAnalysis(letterText, toAnalysisAttachments(attachedFiles));
      setResult(analysis);
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
        .map(async (file) => {
          const mimeType = getAttachmentMimeType(file);
          const dataUrl = normalizeDataUrl(await readFileAsDataUrl(file), mimeType);

          return {
            id: `${file.name}-${file.size}-${file.lastModified}`,
            name: file.name,
            size: file.size,
            type: file.type || mimeType,
            mimeType,
            dataUrl,
            kind: isPdf(file) ? ("pdf" as const) : ("image" as const),
          };
        }),
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
    const text = letterText.trim();

    if (text.length < 30) {
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
    if (!result && !translationResult) return;
    const didCopy = await copyText(formatAnalysisAsText(result, translationResult));
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
    if (!result && !translationResult) return;
    downloadTextFile("careclarity-summary.txt", formatAnalysisAsText(result, translationResult));
    showActionMessage(copy.actions.downloadStarted);
  }

  function handleAppLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLanguage = event.target.value;

    if (!isAppLanguage(nextLanguage)) return;

    const nextCopy = getAppCopy(nextLanguage);
    setAppLanguage(nextLanguage);
    setSentenceError("");
    setTranslationError("");
    setChatError("");

    if (isTranslationAppLanguage(nextLanguage)) {
      setTargetLanguage(nextLanguage);
    }

    showActionMessage(nextCopy.actions.languageChanged(getAppLanguageLabel(nextLanguage)));
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
    <div className="app-root" lang={getAppLanguageCode(appLanguage)} dir={appDirection}>
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
            onChange={(event) => setLetterText(event.target.value)}
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
                disabled={isTranslating || letterText.trim().length < 30}
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
            {translationResult ? (
              <div className="translation-result" aria-live="polite">
                <header>
                  <span>{getAppLanguageLabel(translationResult.targetLanguage)}</span>
                  <strong>{copy.translation.confidenceLabel(translationResult.confidence)}</strong>
                </header>
                <section>
                  <h4>{copy.translation.translatedLetter}</h4>
                  <p>{translationResult.translatedLetter}</p>
                </section>
                <section>
                  <h4>{copy.translation.importantTerms}</h4>
                  <ul>
                    {translationResult.importantTerms.map((term) => (
                      <li key={`${term.originalTerm}-${term.translatedOrExplainedMeaning}`}>
                        <strong>{term.originalTerm}</strong>
                        <span>{term.translatedOrExplainedMeaning}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>{copy.translation.translationNotes}</h4>
                  <ul>
                    {translationResult.translationNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </section>
                <p className="translation-safety">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>{translationResult.safetyNotice}</span>
                </p>
              </div>
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
                setChatQuestion("");
                setChatHistory([]);
                setChatError("");
                if (fileInputRef.current) fileInputRef.current.value = "";
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
          aria-busy={isAnalyzing}
        >
          <div className="results-topbar">
            <div>
              <h2 id="results-heading">{copy.results.heading}</h2>
              <p>
                {result
                  ? resultModeLabel(result, copy.results)
                  : translationResult
                    ? copy.results.translationReady(getAppLanguageLabel(translationResult.targetLanguage))
                    : copy.results.noAnalysisYet}
              </p>
            </div>
            <ExportButtons
              copied={copied}
              disabled={!result && !translationResult}
              copy={copy.export}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
          </div>

          {result ? (
            <>
              <ResultNotice result={result} copy={copy.results} />
              <PatientDashboard result={result} copy={copy.dashboard} />
            </>
          ) : isAnalyzing ? (
            <div className="empty-state loading" aria-live="polite">
              <Loader2 className="spin" size={42} />
              <span>{copy.results.analyzingSafely}</span>
            </div>
          ) : (
            <div className="empty-state" aria-live="polite">
              <FileText size={42} />
              <span>{copy.results.readyForPaperwork}</span>
            </div>
          )}
        </section>
      </main>
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

function resultModeLabel(result: AnalysisResult, copy: AppCopy["results"]): string {
  return result.mode === "ai" ? copy.aiEndpointResult : copy.fallbackResult;
}

export default App;

function readStoredAppLanguage(): AppLanguage {
  const storedLanguage = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return isAppLanguage(storedLanguage) ? storedLanguage : DEFAULT_APP_LANGUAGE;
}

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
