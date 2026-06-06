import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Clipboard,
  ClipboardCheck,
  Download,
  FileSearch,
  HelpCircle,
  Languages,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AnalysisResult } from "../lib/analyzer";
import type { AppCopy } from "../lib/i18n";

type IconType = typeof FileSearch;
type DashboardCopy = AppCopy["dashboard"];
type ExportCopy = AppCopy["export"];

type ExportButtonsProps = {
  copied: boolean;
  disabled: boolean;
  copy: ExportCopy;
  onCopy: () => void;
  onDownload: () => void;
};

type DashboardCardProps = {
  title: string;
  poweredBy: string;
  icon: IconType;
  children: ReactNode;
  className?: string;
};

export function ExportButtons({ copied, disabled, copy, onCopy, onDownload }: ExportButtonsProps) {
  return (
    <div className="export-buttons" aria-label={copy.label}>
      <button
        className="icon-button"
        type="button"
        onClick={onCopy}
        disabled={disabled}
        title={copy.copyDashboard}
        aria-label={copy.copyDashboard}
      >
        {copied ? <ClipboardCheck size={18} /> : <Clipboard size={18} />}
      </button>
      <button
        className="icon-button"
        type="button"
        onClick={onDownload}
        disabled={disabled}
        title={copy.downloadDashboard}
        aria-label={copy.downloadDashboard}
      >
        <Download size={18} />
      </button>
    </div>
  );
}

export function SmartExtractionCard({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  return (
    <DashboardCard title={copy.smartExtraction} poweredBy={copy.extractionPowered} icon={FileSearch}>
      <dl className="extraction-grid">
        {copy.extractionRows.map(([label, key]) => (
          <div key={key} className="extraction-item">
            <dt>{label}</dt>
            <dd>{result.structuredInformationExtraction[key]}</dd>
          </div>
        ))}
      </dl>
    </DashboardCard>
  );
}

export function PlainEnglishCard({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  return (
    <DashboardCard title={copy.plainEnglishTranslation} poweredBy={copy.plainEnglishPowered} icon={Languages}>
      <div className="plain-card">
        <p className="dashboard-summary">{result.patientDashboardSummary}</p>
        <p>{result.plainEnglishTranslation}</p>
        <span className="confidence-pill">{copy.confidenceLabel(result.confidence)}</span>
      </div>
    </DashboardCard>
  );
}

export function ActionChecklist({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  return (
    <DashboardCard title={copy.actionChecklist} poweredBy={copy.actionChecklistPowered} icon={CheckSquare}>
      <ul className="dashboard-action-list">
        {result.actionChecklist.map((item) => (
          <li key={`${item.timing}-${item.task}`}>
            <CheckSquare size={18} aria-hidden="true" />
            <div>
              <strong>{item.task}</strong>
              {item.reason ? <span>{item.reason}</span> : null}
            </div>
            <em>{item.timing}</em>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function AppointmentPrep({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  return (
    <DashboardCard title={copy.appointmentPreparation} poweredBy={copy.appointmentPreparationPowered} icon={CalendarDays}>
      <ul className="dashboard-list">
        {result.appointmentPreparationGuidance.map((item) => (
          <li key={item}>
            <CalendarDays size={18} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function ClinicianQuestions({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  return (
    <DashboardCard title={copy.questionsToAsk} poweredBy={copy.clinicianQuestionsPowered} icon={HelpCircle}>
      <ol className="dashboard-list numbered">
        {result.clinicianQuestions.map((question) => (
          <li key={question}>
            <HelpCircle size={18} aria-hidden="true" />
            <span>{question}</span>
          </li>
        ))}
      </ol>
    </DashboardCard>
  );
}

export function ThingsToVerify({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  return (
    <DashboardCard title={copy.thingsToVerify} poweredBy={copy.missingInfoPowered} icon={AlertTriangle}>
      <div className="verify-stack">
        <section>
          <h4>{copy.missingOrUncertain}</h4>
          <ul className="dashboard-list warning">
            {result.missingOrUncertainInformation.map((item) => (
              <li key={item}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4>{copy.waitingReferralGuidance}</h4>
          <ul className="dashboard-list">
            {result.waitingOrReferralGuidance.map((item) => (
              <li key={item}>
                <Stethoscope size={18} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardCard>
  );
}

export function SafetyValidationCard({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  const isSafe = result.safetyValidation.status === "SAFE";

  return (
    <DashboardCard
      title={copy.safetyValidation}
      poweredBy={copy.safetyPowered}
      icon={ShieldCheck}
      className={isSafe ? "safety-card safe" : "safety-card unsafe"}
    >
      <div className="safety-validation">
        <span className={isSafe ? "safety-status safe" : "safety-status unsafe"}>
          {result.safetyValidation.status}
        </span>
        <p>{result.safetyValidation.safetyNotice}</p>
        {result.safetyValidation.issuesFound.length ? (
          <ul className="dashboard-list warning">
            {result.safetyValidation.issuesFound.map((issue) => (
              <li key={issue}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-note">{copy.noUnsafeDetected}</p>
        )}
      </div>
    </DashboardCard>
  );
}

export function PatientDashboard({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  return (
    <div className="patient-dashboard">
      <PlainEnglishCard result={result} copy={copy} />
      <SmartExtractionCard result={result} copy={copy} />
      <ActionChecklist result={result} copy={copy} />
      <AppointmentPrep result={result} copy={copy} />
      <ClinicianQuestions result={result} copy={copy} />
      <ThingsToVerify result={result} copy={copy} />
      <SafetyValidationCard result={result} copy={copy} />
    </div>
  );
}

function DashboardCard({ title, poweredBy, icon: Icon, children, className = "" }: DashboardCardProps) {
  return (
    <article className={`dashboard-card ${className}`.trim()}>
      <header className="dashboard-card-header">
        <span className="dashboard-card-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{poweredBy}</p>
        </div>
      </header>
      {children}
    </article>
  );
}
