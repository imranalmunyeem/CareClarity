import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Clipboard,
  ClipboardCheck,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { sampleLetters } from "./data/samples";
import { requestAnalysis, type AnalysisResult } from "./lib/analyzer";
import { downloadTextFile, formatAnalysisAsText } from "./lib/format";

type ResultTab = "summary" | "actions" | "prep" | "safety";

const tabs: Array<{ id: ResultTab; label: string; icon: typeof FileText }> = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "actions", label: "Actions", icon: CheckSquare },
  { id: "prep", label: "Prep", icon: CalendarDays },
  { id: "safety", label: "Safety", icon: ShieldCheck },
];

function App() {
  const [letterText, setLetterText] = useState(sampleLetters[0].text);
  const [sampleId, setSampleId] = useState(sampleLetters[0].id);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [forceDemoMode, setForceDemoMode] = useState(false);
  const [copied, setCopied] = useState(false);

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
          <span className="status-pill">Admin support only</span>
        </header>

        <div className="safety-banner" role="note">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            <strong>Safety notice:</strong> This tool explains admin information only. Confirm details with
            your NHS team. For urgent medical help in the UK, use NHS 111. For life-threatening emergencies,
            call 999.
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
              alt="Synthetic appointment letter preview"
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
            Letter text
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
              <span>Ready for a letter</span>
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
