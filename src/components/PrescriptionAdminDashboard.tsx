import { AlertTriangle, CheckCircle2, ClipboardList, Pill, ShieldCheck } from "lucide-react";
import type { AppCopy } from "../lib/i18n";
import type { PrescriptionAdminHelperResult } from "../lib/prescriptionAdmin";

type PrescriptionCopy = AppCopy["prescription"];

export function PrescriptionAdminDashboard({
  result,
  copy,
}: {
  result: PrescriptionAdminHelperResult;
  copy: PrescriptionCopy;
}) {
  return (
    <div className="prescription-dashboard">
      <article className="prescription-summary-card">
        <header>
          <span className="dashboard-card-icon prescription-icon" aria-hidden="true">
            <Pill size={20} />
          </span>
          <div>
            <h3>{copy.resultHeading}</h3>
            <p>{copy.resultReady}</p>
          </div>
        </header>
        <p>{result.summary}</p>
        <span className="confidence-pill">{copy.confidenceLabel(result.confidence)}</span>
      </article>

      <article className="dashboard-card">
        <header className="dashboard-card-header">
          <span className="dashboard-card-icon prescription-icon" aria-hidden="true">
            <ClipboardList size={20} />
          </span>
          <div>
            <h3>{copy.adminDetails}</h3>
            <p>{copy.adminDetailsPowered}</p>
          </div>
        </header>
        <dl className="prescription-detail-grid">
          {result.adminDetails.map((detail) => (
            <div
              key={`${detail.label}-${detail.value}`}
              className={detail.needsCheck ? "prescription-detail needs-check" : "prescription-detail"}
            >
              <dt>
                {detail.needsCheck ? (
                  <AlertTriangle size={16} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={16} aria-hidden="true" />
                )}
                <span>{detail.label}</span>
              </dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      </article>

      <article className="dashboard-card">
        <header className="dashboard-card-header">
          <span className="dashboard-card-icon prescription-icon" aria-hidden="true">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <h3>{copy.nextSteps}</h3>
            <p>{copy.nextStepsPowered}</p>
          </div>
        </header>
        <ul className="dashboard-list">
          {result.nextSteps.map((step) => (
            <li key={step}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </article>

      <article className="dashboard-card">
        <header className="dashboard-card-header">
          <span className="dashboard-card-icon prescription-icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h3>{copy.detailsToConfirm}</h3>
            <p>{copy.detailsToConfirmPowered}</p>
          </div>
        </header>
        <ul className="dashboard-list warning">
          {result.detailsToConfirm.map((item) => (
            <li key={item}>
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="prescription-safety">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{result.safetyNotice}</span>
        </p>
      </article>
    </div>
  );
}
