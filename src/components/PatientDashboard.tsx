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

type IconType = typeof FileSearch;

type ExportButtonsProps = {
  copied: boolean;
  disabled: boolean;
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

const extractionRows = [
  ["Letter type", "letterType"],
  ["Department or clinic", "departmentOrClinic"],
  ["Appointment date", "appointmentDate"],
  ["Appointment time", "appointmentTime"],
  ["Location", "location"],
  ["Contact information", "contactInfo"],
  ["Clinician or team", "namedClinicianOrTeam"],
  ["Action required", "actionRequired"],
] as const;

export function ExportButtons({ copied, disabled, onCopy, onDownload }: ExportButtonsProps) {
  return (
    <div className="export-buttons" aria-label="Export patient dashboard">
      <button
        className="icon-button"
        type="button"
        onClick={onCopy}
        disabled={disabled}
        title="Copy dashboard"
        aria-label="Copy dashboard"
      >
        {copied ? <ClipboardCheck size={18} /> : <Clipboard size={18} />}
      </button>
      <button
        className="icon-button"
        type="button"
        onClick={onDownload}
        disabled={disabled}
        title="Download dashboard"
        aria-label="Download dashboard"
      >
        <Download size={18} />
      </button>
    </div>
  );
}

export function SmartExtractionCard({ result }: { result: AnalysisResult }) {
  return (
    <DashboardCard title="Smart Extraction" poweredBy="Z.AI information extraction" icon={FileSearch}>
      <dl className="extraction-grid">
        {extractionRows.map(([label, key]) => (
          <div key={key} className="extraction-item">
            <dt>{label}</dt>
            <dd>{result.structuredInformationExtraction[key]}</dd>
          </div>
        ))}
      </dl>
    </DashboardCard>
  );
}

export function PlainEnglishCard({ result }: { result: AnalysisResult }) {
  return (
    <DashboardCard title="Plain-English Translation" poweredBy="Z.AI plain-English translation" icon={Languages}>
      <div className="plain-card">
        <p className="dashboard-summary">{result.patientDashboardSummary}</p>
        <p>{result.plainEnglishTranslation}</p>
        <span className="confidence-pill">{result.confidence} confidence</span>
      </div>
    </DashboardCard>
  );
}

export function ActionChecklist({ result }: { result: AnalysisResult }) {
  return (
    <DashboardCard title="Action Checklist" poweredBy="Z.AI action checklist" icon={CheckSquare}>
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

export function AppointmentPrep({ result }: { result: AnalysisResult }) {
  return (
    <DashboardCard title="Appointment Preparation" poweredBy="Z.AI appointment preparation" icon={CalendarDays}>
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

export function ClinicianQuestions({ result }: { result: AnalysisResult }) {
  return (
    <DashboardCard title="Questions To Ask" poweredBy="Z.AI clinician questions" icon={HelpCircle}>
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

export function ThingsToVerify({ result }: { result: AnalysisResult }) {
  return (
    <DashboardCard title="Things To Verify" poweredBy="Z.AI missing-info review" icon={AlertTriangle}>
      <div className="verify-stack">
        <section>
          <h4>Missing or uncertain</h4>
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
          <h4>Waiting or referral guidance</h4>
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

export function SafetyValidationCard({ result }: { result: AnalysisResult }) {
  const isSafe = result.safetyValidation.status === "SAFE";

  return (
    <DashboardCard
      title="Safety Validation"
      poweredBy="Z.AI safety validation"
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
          <p className="muted-note">No unsafe diagnosis, prescribing, treatment or endorsement claim was detected.</p>
        )}
      </div>
    </DashboardCard>
  );
}

export function PatientDashboard({ result }: { result: AnalysisResult }) {
  return (
    <div className="patient-dashboard">
      <PlainEnglishCard result={result} />
      <SmartExtractionCard result={result} />
      <ActionChecklist result={result} />
      <AppointmentPrep result={result} />
      <ClinicianQuestions result={result} />
      <ThingsToVerify result={result} />
      <SafetyValidationCard result={result} />
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
