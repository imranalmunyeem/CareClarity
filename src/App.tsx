import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  LockKeyhole,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ExportButtons, PatientDashboard } from "./components/PatientDashboard";
import { requestAnalysis, type AnalysisResult } from "./lib/analyzer";
import type { AIAnalysisAttachment } from "./lib/analysisSchema";
import { downloadTextFile, formatAnalysisAsText } from "./lib/format";

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
  const [letterText, setLetterText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actionMessageTimerRef = useRef<number | null>(null);

  const textStats = useMemo(() => {
    const words = letterText.trim() ? letterText.trim().split(/\s+/).length : 0;
    return `${letterText.length.toLocaleString()} characters / ${words.toLocaleString()} words`;
  }, [letterText]);
  const hasAnalysisInput = Boolean(letterText.trim() || attachedFiles.length);

  async function handleAnalyze() {
    if (!hasAnalysisInput) {
      showActionMessage("Paste text or upload a PDF/image before analysis.");
      return;
    }

    setIsAnalyzing(true);
    setCopied(false);
    showActionMessage("Analyzing with admin-only safety checks.");

    try {
      const analysis = await requestAnalysis(letterText, toAnalysisAttachments(attachedFiles));
      setResult(analysis);
      showActionMessage(
        analysis.mode === "ai" ? "Z.AI analysis completed server-side." : "Safe fallback result is ready.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const unsupportedCount = files.filter((file) => !isSupportedAttachment(file)).length;
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
          ? "Choose a PDF or image under 5 MB."
          : "Choose a PDF or image file. Other file types are ignored.",
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

      const skippedCount = acceptedFiles.length - addedCount;
      const parts: string[] = [];
      if (addedCount) parts.push(`${addedCount} file${addedCount === 1 ? "" : "s"} ready for analysis`);
      if (unsupportedCount) parts.push(`${unsupportedCount} unsupported file${unsupportedCount === 1 ? "" : "s"} ignored`);
      if (oversizedCount) parts.push(`${oversizedCount} oversized file${oversizedCount === 1 ? "" : "s"} ignored`);
      if (skippedCount) parts.push(`${skippedCount} duplicate or extra file${skippedCount === 1 ? "" : "s"} skipped`);
      showActionMessage(parts.length ? `${parts.join("; ")}.` : "No new files were attached.");

      return next;
    });

    event.target.value = "";
  }

  function removeAttachment(fileId: string) {
    setAttachedFiles((current) => current.filter((file) => file.id !== fileId));
    showActionMessage("Attachment removed.");
  }

  async function handleCopy() {
    if (!result) return;
    const didCopy = await copyText(formatAnalysisAsText(result));
    if (didCopy) {
      setCopied(true);
      showActionMessage("Result copied to clipboard.");
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      setCopied(false);
      showActionMessage("Copy was blocked by the browser. Download is still available.");
    }
  }

  function handleDownload() {
    if (!result) return;
    downloadTextFile("careclarity-summary.txt", formatAnalysisAsText(result));
    showActionMessage("Text download started.");
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
    <>
      <div className="sticky-frame">
        <header className="app-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h1>CareClarity</h1>
              <p>NHS-style admin companion</p>
            </div>
          </div>
          <div className="status-group" aria-label="CareClarity safeguards">
            <span className="status-pill">Admin support only</span>
            <span className="status-pill privacy">No login required</span>
          </div>
        </header>

        <div className="safety-banner" role="note">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            <strong>Safety notice:</strong> CareClarity explains healthcare admin, appointment details and
            prescription paperwork only. It does not diagnose, recommend medicines or replace your NHS team.
            For urgent medical help in the UK, use NHS 111. For life-threatening emergencies, call 999.
          </p>
        </div>
      </div>

      <main className="workspace-shell">
        <section className="tool-panel input-panel" aria-labelledby="letter-heading">
          <div className="panel-heading">
            <div>
              <h2 id="letter-heading">Upload Paperwork</h2>
              <p>Use a PDF, image or pasted text. No account is needed.</p>
            </div>
          </div>

          <label className="field-label" htmlFor="letter-text">
            Optional letter or prescription text
          </label>
          <textarea
            id="letter-text"
            placeholder="Paste text here if you have it. You can also upload a PDF or image below."
            value={letterText}
            onChange={(event) => setLetterText(event.target.value)}
            aria-describedby="letter-helper"
            spellCheck="true"
          />
          <p id="letter-helper" className="input-helper">
            Paste text when available, or upload a PDF/image and let CareClarity read the paperwork for admin details.
          </p>

          <div className="input-footer">
            <span className="text-stat">{textStats}</span>
          </div>

          <section className="trust-block" aria-labelledby="trust-heading">
            <div className="trust-heading">
              <LockKeyhole size={18} aria-hidden="true" />
              <div>
                <h3 id="trust-heading">Private by design</h3>
                <p>No registration, no patient account and no database storage in this prototype.</p>
              </div>
            </div>
            <ul className="trust-list">
              <li>
                <UserRoundCheck size={17} aria-hidden="true" />
                <span>Patients can use CareClarity without creating an account.</span>
              </li>
              <li>
                <Database size={17} aria-hidden="true" />
                <span>We do not save letters, prescriptions or uploaded files to a backend database.</span>
              </li>
              <li>
                <ShieldCheck size={17} aria-hidden="true" />
                <span>Files are used for the analysis request only; CareClarity does not keep a database copy.</span>
              </li>
            </ul>
          </section>

          <section className="upload-block" aria-labelledby="upload-heading">
            <div className="upload-copy">
              <h3 id="upload-heading">Upload a prescription or letter</h3>
              <p>PDF and image files can be analyzed for admin details and removed at any time.</p>
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
              <span>Choose PDF or image</span>
              <small>PDF, PNG, JPG, WebP or HEIC where supported</small>
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
              <ul className="attachment-list" aria-label="Files ready for analysis">
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
                        {file.kind === "pdf" ? "PDF" : "Image"} - {formatBytes(file.size)}
                      </span>
                    </div>
                    <button
                      className="attachment-remove"
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      title={`Remove ${file.name}`}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p id="upload-note" className="upload-note">
              Your upload is used for this analysis request only. It is not saved to a CareClarity database.
            </p>
          </section>

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !hasAnalysisInput}
              title="Analyze paperwork"
            >
              {isAnalyzing ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              <span>{isAnalyzing ? "Analyzing" : "Analyze"}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setLetterText("");
                setAttachedFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
                setResult(null);
                setCopied(false);
                showActionMessage("Paperwork, result and attachments cleared.");
              }}
              title="Clear paperwork"
              aria-label="Clear paperwork"
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
              <h2 id="results-heading">Patient Dashboard</h2>
              <p>{result ? resultModeLabel(result) : "No analysis yet"}</p>
            </div>
            <ExportButtons copied={copied} disabled={!result} onCopy={handleCopy} onDownload={handleDownload} />
          </div>

          {result ? (
            <>
              <ResultNotice result={result} />
              <PatientDashboard result={result} />
            </>
          ) : isAnalyzing ? (
            <div className="empty-state loading" aria-live="polite">
              <Loader2 className="spin" size={42} />
              <span>Analyzing safely</span>
            </div>
          ) : (
            <div className="empty-state" aria-live="polite">
              <FileText size={42} />
              <span>Ready for paperwork</span>
            </div>
          )}
        </section>
      </main>
    </>
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

function ResultNotice({ result }: { result: AnalysisResult }) {
  if (result.mode === "ai") {
    return (
      <div className="result-notice success" role="status">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>Z.AI analysis completed server-side. Your text and uploaded files are not saved by CareClarity.</span>
      </div>
    );
  }

  return (
    <div className="result-notice" role="status">
      <AlertTriangle size={17} aria-hidden="true" />
      <span>
        {result.fallbackReason ?? "A safe fallback result is being used."} The app still applies the same admin-only safety
        rules.
      </span>
    </div>
  );
}

function resultModeLabel(result: AnalysisResult): string {
  return result.mode === "ai" ? "Z.AI endpoint result" : "Safe fallback result";
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
