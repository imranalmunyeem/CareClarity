import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Clipboard,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LockKeyhole,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { sampleLetters } from "./data/samples";
import { requestAnalysis, type AnalysisResult } from "./lib/analyzer";
import { downloadTextFile, formatAnalysisAsText } from "./lib/format";

type ResultTab = "summary" | "actions" | "prep" | "safety";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: "pdf" | "image";
}

const tabs: Array<{ id: ResultTab; label: string; icon: typeof FileText }> = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "actions", label: "Actions", icon: CheckSquare },
  { id: "prep", label: "Prep", icon: CalendarDays },
  { id: "safety", label: "Safety", icon: ShieldCheck },
];

function App() {
  const [letterText, setLetterText] = useState(sampleLetters[0].text);
  const [sampleId, setSampleId] = useState(sampleLetters[0].id);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [forceDemoMode, setForceDemoMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSample = sampleLetters.find((sample) => sample.id === sampleId) ?? sampleLetters[0];
  const textStats = useMemo(() => {
    const words = letterText.trim() ? letterText.trim().split(/\s+/).length : 0;
    return `${letterText.length.toLocaleString()} characters / ${words.toLocaleString()} words`;
  }, [letterText]);

  async function handleAnalyze() {
    if (!letterText.trim()) return;
    setIsAnalyzing(true);
    setCopied(false);

    try {
      const analysis = await requestAnalysis(letterText, forceDemoMode);
      setResult(analysis);
      setActiveTab("summary");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleSampleChange(nextId: string) {
    const nextSample = sampleLetters.find((sample) => sample.id === nextId);
    if (!nextSample) return;
    setSampleId(nextId);
    setLetterText(nextSample.text);
    setResult(null);
    setCopied(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const acceptedFiles = files
      .filter(isSupportedAttachment)
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        type: file.type || "Unknown file type",
        kind: isPdf(file) ? ("pdf" as const) : ("image" as const),
      }));

    setAttachedFiles((current) => {
      const seen = new Set(current.map((file) => file.id));
      const next = [...current];

      for (const file of acceptedFiles) {
        if (seen.has(file.id) || next.length >= 6) continue;
        next.push(file);
        seen.add(file.id);
      }

      return next;
    });

    event.target.value = "";
  }

  function removeAttachment(fileId: string) {
    setAttachedFiles((current) => current.filter((file) => file.id !== fileId));
  }

  async function handleCopy() {
    if (!result) return;
    const didCopy = await copyText(formatAnalysisAsText(result));
    if (didCopy) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  function handleDownload() {
    if (!result) return;
    downloadTextFile("careclarity-summary.txt", formatAnalysisAsText(result));
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
              <h2 id="letter-heading">Letter</h2>
              <p>{selectedSample.label}</p>
            </div>
            <img
              src="/sample-letter-preview.svg"
              alt="Synthetic healthcare paperwork preview"
              className="letter-preview"
            />
          </div>

          <div className="field-row">
            <label className="field-label" htmlFor="sample-letter">
              Sample
            </label>
            <select
              id="sample-letter"
              value={sampleId}
              onChange={(event) => handleSampleChange(event.target.value)}
            >
              {sampleLetters.map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.name}
                </option>
              ))}
            </select>
          </div>

          <label className="field-label" htmlFor="letter-text">
            Letter or prescription text
          </label>
          <textarea
            id="letter-text"
            value={letterText}
            onChange={(event) => setLetterText(event.target.value)}
            spellCheck="true"
          />

          <div className="input-footer">
            <span className="text-stat">{textStats}</span>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={forceDemoMode}
                onChange={(event) => setForceDemoMode(event.target.checked)}
              />
              <span>Demo mode</span>
            </label>
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
                <span>Demo mode keeps analysis in the browser; AI mode sends only the text box content for analysis.</span>
              </li>
            </ul>
          </section>

          <section className="upload-block" aria-labelledby="upload-heading">
            <div className="upload-copy">
              <h3 id="upload-heading">Attach a prescription or letter</h3>
              <p>PDF and image files stay in this browser session and can be removed at any time.</p>
            </div>
            <label className="upload-control" htmlFor="document-upload">
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
              onChange={handleFileChange}
            />
            {attachedFiles.length ? (
              <ul className="attachment-list" aria-label="Attached local files">
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
                        {file.kind === "pdf" ? "PDF" : "Image"} · {formatBytes(file.size)}
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
            <p className="upload-note">
              Attached files are not uploaded by this picker. Paste any wording you want explained into the
              text box above.
            </p>
          </section>

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !letterText.trim()}
              title="Analyze letter"
            >
              {isAnalyzing ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              <span>{isAnalyzing ? "Analyzing" : "Analyze"}</span>
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => handleSampleChange(selectedSample.id)}
              title="Reload selected sample"
            >
              <RefreshCw size={18} />
              <span>Reload</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setLetterText("");
                setAttachedFiles([]);
                fileInputRef.current?.form?.reset();
                setResult(null);
              }}
              title="Clear letter"
              aria-label="Clear letter"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </section>

        <section className="tool-panel results-panel" aria-labelledby="results-heading">
          <div className="results-topbar">
            <div>
              <h2 id="results-heading">Result</h2>
              <p>{result ? resultModeLabel(result) : "No analysis yet"}</p>
            </div>
            <div className="result-actions">
              <button
                className="icon-button"
                type="button"
                onClick={handleCopy}
                disabled={!result}
                title="Copy result"
                aria-label="Copy result"
              >
                {copied ? <ClipboardCheck size={18} /> : <Clipboard size={18} />}
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={handleDownload}
                disabled={!result}
                title="Download result"
                aria-label="Download result"
              >
                <Download size={18} />
              </button>
            </div>
          </div>

          {result ? (
            <>
              <div className="tab-list" role="tablist" aria-label="Analysis result sections">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      className={isActive ? "tab-button active" : "tab-button"}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="tab-panel" role="tabpanel">
                {activeTab === "summary" && <SummaryView result={result} />}
                {activeTab === "actions" && <ActionsView result={result} />}
                {activeTab === "prep" && <PrepView result={result} />}
                {activeTab === "safety" && <SafetyView result={result} />}
              </div>
            </>
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

function SummaryView({ result }: { result: AnalysisResult }) {
  return (
    <div className="result-stack">
      <section className="result-section">
        <h3>Plain-English Summary</h3>
        <ul className="clean-list">
          {result.summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="result-section">
        <h3>Key Admin Details</h3>
        <div className="detail-grid">
          {result.details.map((detail) => (
            <article key={`${detail.label}-${detail.value}`} className="detail-item">
              <div>
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
              <small>{detail.confidence} confidence</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActionsView({ result }: { result: AnalysisResult }) {
  return (
    <div className="result-stack">
      <section className="result-section">
        <h3>Action Checklist</h3>
        <ul className="action-list">
          {result.checklist.map((item) => (
            <li key={item.task}>
              <CheckSquare size={18} />
              <div>
                <strong>{item.task}</strong>
                {item.reason ? <span>{item.reason}</span> : null}
              </div>
              <em>{item.timing}</em>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PrepView({ result }: { result: AnalysisResult }) {
  return (
    <div className="result-stack">
      <section className="result-section">
        <h3>Appointment Preparation</h3>
        <ul className="prep-list">
          {result.preparationNotes.map((item) => (
            <li key={item}>
              <CalendarDays size={18} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="result-section">
        <h3>Five Safe Questions</h3>
        <ol className="question-list">
          {result.clinicianQuestions.map((question) => (
            <li key={question}>
              <HelpCircle size={18} />
              <span>{question}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function SafetyView({ result }: { result: AnalysisResult }) {
  return (
    <div className="result-stack">
      <section className="result-section">
        <h3>Missing Or Unclear</h3>
        <ul className="warning-list">
          {result.missingOrUnclear.map((item) => (
            <li key={item}>
              <AlertTriangle size={18} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="result-section">
        <h3>Safety Boundary</h3>
        <ul className="safety-list">
          {result.safetyNotes.map((item) => (
            <li key={item}>
              <ShieldCheck size={18} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function resultModeLabel(result: AnalysisResult): string {
  return result.mode === "ai" ? "AI endpoint result" : "Demo fallback result";
}

export default App;

function isSupportedAttachment(file: File): boolean {
  return isPdf(file) || file.type.startsWith("image/");
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
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
