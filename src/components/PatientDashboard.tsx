import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckSquare,
  Clipboard,
  ClipboardCheck,
  Clock3,
  Download,
  FileSearch,
  FileText,
  HelpCircle,
  Languages,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AnalysisResult, MissingDetailFlag } from "../lib/analyzer";
import {
  buildAppointmentReadinessPack,
  type AppointmentReadinessEssentialKey,
} from "../lib/appointmentReadiness";
import type { AppCopy } from "../lib/i18n";

type IconType = typeof FileSearch;
type DashboardCopy = AppCopy["dashboard"];
type ExportCopy = AppCopy["export"];
type CarerSummaryCopy = AppCopy["carerSummary"];

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

type CarerSummaryCardProps = {
  result: AnalysisResult;
  copy: CarerSummaryCopy;
  onDownloadTxt: () => void;
  onDownloadPdf: () => void;
};

const readinessIcons: Record<AppointmentReadinessEssentialKey, IconType> = {
  departmentOrClinic: Building2,
  appointmentDate: CalendarDays,
  appointmentTime: Clock3,
  location: MapPin,
  contactInfo: Phone,
  actionRequired: CheckSquare,
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

export function CarerSummaryCard({
  result,
  copy,
  onDownloadTxt,
  onDownloadPdf,
}: CarerSummaryCardProps) {
  const info = result.structuredInformationExtraction;

  return (
    <DashboardCard title={copy.heading} poweredBy={copy.poweredBy} icon={UsersRound} className="carer-summary-card">
      <div className="carer-summary">
        <p>{copy.intro}</p>
        <dl className="carer-summary-details">
          <div>
            <dt>Appointment date</dt>
            <dd>{info.appointmentDate}</dd>
          </div>
          <div>
            <dt>Appointment time</dt>
            <dd>{info.appointmentTime}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{info.location}</dd>
          </div>
          <div>
            <dt>Contact info</dt>
            <dd>{info.contactInfo}</dd>
          </div>
        </dl>
        <p className="muted-note">{copy.detailsPreview}</p>
        <div className="carer-summary-actions">
          <button className="secondary-button" type="button" onClick={onDownloadTxt}>
            <FileText size={18} aria-hidden="true" />
            <span>{copy.downloadTxt}</span>
          </button>
          <button className="secondary-button" type="button" onClick={onDownloadPdf}>
            <Download size={18} aria-hidden="true" />
            <span>{copy.downloadPdf}</span>
          </button>
        </div>
        <p className="carer-summary-safety">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{copy.safety}</span>
        </p>
      </div>
    </DashboardCard>
  );
}

export function AppointmentReadinessPackCard({ result, copy }: { result: AnalysisResult; copy: DashboardCopy }) {
  const pack = buildAppointmentReadinessPack(result);

  return (
    <DashboardCard
      title={copy.appointmentReadinessPack}
      poweredBy={copy.appointmentReadinessPowered}
      icon={CalendarDays}
      className={`readiness-card ${pack.status}`}
    >
      <div className="readiness-pack">
        <p className="readiness-summary">{pack.summary}</p>

        <section className="readiness-section" aria-labelledby="readiness-details-heading">
          <h4 id="readiness-details-heading">{copy.readinessEssentials}</h4>
          <dl className="readiness-essentials">
            {pack.essentials.map((item) => {
              const Icon = readinessIcons[item.key];

              return (
                <div
                  key={item.key}
                  className={item.needsCheck ? "readiness-essential needs-check" : "readiness-essential"}
                >
                  <dt>
                    <Icon size={16} aria-hidden="true" />
                    <span>{getExtractionLabel(copy, item.key)}</span>
                  </dt>
                  <dd>{item.value}</dd>
                </div>
              );
            })}
          </dl>
        </section>

        <div className="readiness-columns">
          <ReadinessList title={copy.readinessBeforeYouGo} items={pack.beforeYouGo} icon={CheckSquare} />
          <ReadinessList title={copy.readinessPrepare} items={pack.bringOrPrepare} icon={Clipboard} />
          <ReadinessList title={copy.readinessConfirm} items={pack.confirmFirst} icon={AlertTriangle} warning />
        </div>
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
  const missingDetailFlags = result.missingDetailFlags ?? [];

  return (
    <DashboardCard title={copy.thingsToVerify} poweredBy={copy.missingInfoPowered} icon={AlertTriangle}>
      <div className="verify-stack">
        {missingDetailFlags.length ? (
          <section>
            <h4>{copy.flaggedBeforeActing}</h4>
            <MissingDetailFlagList flags={missingDetailFlags} />
          </section>
        ) : null}
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

function MissingDetailFlagList({ flags }: { flags: MissingDetailFlag[] }) {
  return (
    <ul className="missing-flag-list">
      {flags.map((flag) => (
        <li key={flag.key} className={`missing-flag ${flag.severity}`}>
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{flag.label}</strong>
            <span>{flag.detail}</span>
          </div>
        </li>
      ))}
    </ul>
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

export function PatientDashboard({
  result,
  copy,
  carerCopy,
  onDownloadCarerTxt,
  onDownloadCarerPdf,
}: {
  result: AnalysisResult;
  copy: DashboardCopy;
  carerCopy: CarerSummaryCopy;
  onDownloadCarerTxt: () => void;
  onDownloadCarerPdf: () => void;
}) {
  return (
    <div className="patient-dashboard">
      <AppointmentReadinessPackCard result={result} copy={copy} />
      <CarerSummaryCard
        result={result}
        copy={carerCopy}
        onDownloadTxt={onDownloadCarerTxt}
        onDownloadPdf={onDownloadCarerPdf}
      />
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

function ReadinessList({
  title,
  items,
  icon: Icon,
  warning = false,
}: {
  title: string;
  items: string[];
  icon: IconType;
  warning?: boolean;
}) {
  return (
    <section className="readiness-section">
      <h4>{title}</h4>
      <ul className={warning ? "readiness-list warning" : "readiness-list"}>
        {items.map((item) => (
          <li key={item}>
            <Icon size={16} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
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

function getExtractionLabel(copy: DashboardCopy, key: AppointmentReadinessEssentialKey): string {
  return copy.extractionRows.find(([, rowKey]) => rowKey === key)?.[0] ?? key;
}
