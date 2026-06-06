import { AlertTriangle, ArrowRight, CheckCircle2, GitCompareArrows, ListChecks, ShieldCheck } from "lucide-react";
import {
  getChangedComparisonFields,
  type LetterComparisonFieldKey,
  type LetterComparisonResult,
} from "../lib/letterComparison";
import type { AppCopy } from "../lib/i18n";

type ComparisonCopy = AppCopy["comparison"];
type DashboardCopy = AppCopy["dashboard"];

export function LetterComparisonDashboard({
  comparison,
  copy,
  dashboardCopy,
}: {
  comparison: LetterComparisonResult;
  copy: ComparisonCopy;
  dashboardCopy: DashboardCopy;
}) {
  const changedFields = getChangedComparisonFields(comparison);
  const hasActionChanges = comparison.actionChanges.added.length || comparison.actionChanges.removed.length;

  return (
    <div className="comparison-dashboard">
      <article className="comparison-summary-card">
        <header>
          <span className="dashboard-card-icon" aria-hidden="true">
            <GitCompareArrows size={20} />
          </span>
          <div>
            <h3>{copy.resultHeading}</h3>
            <p>{copy.resultReady}</p>
          </div>
        </header>
        <p>{comparison.summary}</p>
        <div className="comparison-counts" aria-label={copy.changedFields}>
          <strong>{comparison.changedCount}</strong>
          <span>{copy.changedFields}</span>
        </div>
      </article>

      <article className="dashboard-card comparison-card">
        <header className="dashboard-card-header">
          <span className="dashboard-card-icon" aria-hidden="true">
            <GitCompareArrows size={20} />
          </span>
          <div>
            <h3>{copy.changedFields}</h3>
            <p>{copy.oldLetter} / {copy.newLetter}</p>
          </div>
        </header>
        {changedFields.length ? (
          <div className="comparison-field-list">
            {changedFields.map((field) => (
              <section key={field.key} className={`comparison-field ${field.impact}`}>
                <h4>{getComparisonFieldLabel(dashboardCopy, field.key)}</h4>
                <div className="comparison-values">
                  <ComparisonValue label={copy.oldLetter} value={field.before} />
                  <span className="comparison-arrow" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                  <ComparisonValue label={copy.newLetter} value={field.after} />
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="muted-note">{copy.noFieldChanges}</p>
        )}
      </article>

      <article className="dashboard-card comparison-card">
        <header className="dashboard-card-header">
          <span className="dashboard-card-icon" aria-hidden="true">
            <ListChecks size={20} />
          </span>
          <div>
            <h3>{dashboardCopy.actionChecklist}</h3>
            <p>{copy.addedActions} / {copy.removedActions}</p>
          </div>
        </header>
        {hasActionChanges ? (
          <div className="comparison-action-grid">
            <ComparisonList title={copy.addedActions} items={comparison.actionChanges.added} icon="check" />
            <ComparisonList title={copy.removedActions} items={comparison.actionChanges.removed} icon="warning" />
          </div>
        ) : (
          <p className="muted-note">{copy.noActionChanges}</p>
        )}
      </article>

      <article className="dashboard-card comparison-card">
        <header className="dashboard-card-header">
          <span className="dashboard-card-icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h3>{copy.detailsToCheck}</h3>
            <p>{dashboardCopy.missingInfoPowered}</p>
          </div>
        </header>
        <ul className="dashboard-list warning">
          {comparison.detailsToCheck.map((item) => (
            <li key={item}>
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="comparison-safety">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{comparison.safetyNotice || copy.comparisonSafety}</span>
        </p>
      </article>
    </div>
  );
}

function ComparisonValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="comparison-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ComparisonList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: "check" | "warning";
}) {
  const Icon = icon === "check" ? CheckCircle2 : AlertTriangle;

  return (
    <section className="comparison-action-list">
      <h4>{title}</h4>
      {items.length ? (
        <ul className={icon === "check" ? "dashboard-list" : "dashboard-list warning"}>
          {items.map((item) => (
            <li key={item}>
              <Icon size={18} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-note">None found.</p>
      )}
    </section>
  );
}

function getComparisonFieldLabel(copy: DashboardCopy, key: LetterComparisonFieldKey): string {
  return copy.extractionRows.find(([, rowKey]) => rowKey === key)?.[0] ?? key;
}
