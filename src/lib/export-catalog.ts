import { extractCodeFiles, codeFilesZip } from "./export-code";
import { aiDisclosureMarkdown, disclosureFilename } from "./export-disclosure";
import { sessionLogCsvFile, sessionLogJsonFile, planJson } from "./export-backup";
import { hasProject, planSlug, type ExportOptions } from "./export-common";
import { shareableHtml, shareFilename } from "./export-html";
import { createIssuesScript, issuesCsv, issuesCsvFilename, issuesScriptFilename } from "./export-issues";
import { specBundleZip, specZipFilename } from "./export-spec";
import { planFilename, planMarkdown } from "./plan-export";
import type { WorkflowState } from "./workflow";

// The list of downloads the ExportPanel shows. Pure data plus pure builders, so each entry is testable.

export type ExportGroup = "handoff" | "evidence" | "github" | "backup" | "share";
export interface ExportItem {
  id: string;
  group: ExportGroup;
  label: string;
  description: string;
  filename: (s: WorkflowState) => string;
  mime: string;
  /** Reason the download cannot be made right now, or null when it is available. */
  unavailable: (s: WorkflowState) => string | null;
  build: (s: WorkflowState, opts?: ExportOptions) => string | Uint8Array;
}

const needProject = (s: WorkflowState) => (hasProject(s) ? null : "Start a project first.");
const needTasks = (s: WorkflowState) => needProject(s) ?? (s.tasks.length ? null : "Available once tasks are drafted.");

export const EXPORT_GROUPS: Record<ExportGroup, string> = {
  handoff: "Hand it to your coding agent",
  evidence: "Proof of how AI was used",
  github: "GitHub",
  backup: "Backup and logs",
  share: "Share",
};

export const EXPORT_ITEMS: ExportItem[] = [
  { id: "markdown", group: "handoff", label: "Plan (Markdown)", description: "Readable plan with requirements, tasks, outputs and provenance. Works at any step; unfinished plans are marked as drafts.", filename: planFilename, mime: "text/markdown;charset=utf-8", unavailable: needProject, build: planMarkdown },
  { id: "spec", group: "handoff", label: "Spec bundle (.zip)", description: "requirements.md, tasks.md, design.md and AGENTS.md / CLAUDE.md for Claude Code, Copilot or Kiro.", filename: specZipFilename, mime: "application/zip", unavailable: needTasks, build: specBundleZip },
  { id: "code", group: "handoff", label: "Code files (.zip)", description: "Fenced code blocks that name a file become real files in their folders.", filename: (s) => `${planSlug(s)}-code.zip`, mime: "application/zip", unavailable: (s) => needProject(s) ?? (extractCodeFiles(s).length ? null : "No agent output names a code file yet."), build: (s, o) => codeFilesZip(s, o?.now) },
  { id: "disclosure", group: "evidence", label: "AI-use disclosure (.md)", description: "Who did what and when, accepted vs edited vs rejected AI drafts, models and tokens, and a statement for your class policy.", filename: disclosureFilename, mime: "text/markdown;charset=utf-8", unavailable: needProject, build: aiDisclosureMarkdown },
  { id: "issues-csv", group: "github", label: "GitHub issues (.csv)", description: "One row per task with body, labels by role and milestone, for spreadsheets and issue importers.", filename: issuesCsvFilename, mime: "text/csv;charset=utf-8", unavailable: needTasks, build: (s) => issuesCsv(s) },
  { id: "issues-sh", group: "github", label: "Create issues script (.sh)", description: "Runs gh issue create for every task. Needs the GitHub CLI; read it before you run it.", filename: issuesScriptFilename, mime: "text/x-shellscript;charset=utf-8", unavailable: needTasks, build: (s) => createIssuesScript(s) },
  { id: "plan-json", group: "backup", label: "Backup (plan.json)", description: "Everything in this session. Import it later to continue on any browser.", filename: (s) => `${planSlug(s)}-plan.json`, mime: "application/json;charset=utf-8", unavailable: needProject, build: planJson },
  { id: "log-csv", group: "backup", label: "Session log (.csv)", description: "Every decision with a timestamp, for open in a spreadsheet.", filename: (s) => `${planSlug(s)}-session-log.csv`, mime: "text/csv;charset=utf-8", unavailable: needProject, build: (s) => sessionLogCsvFile(s) },
  { id: "log-json", group: "backup", label: "Session log (.json)", description: "The same log with usage totals, for analysis.", filename: (s) => `${planSlug(s)}-session-log.json`, mime: "application/json;charset=utf-8", unavailable: needProject, build: sessionLogJsonFile },
  { id: "share", group: "share", label: "Shareable page (.html)", description: "One read-only file with no scripts or links; open it in any browser or print it to PDF.", filename: shareFilename, mime: "text/html;charset=utf-8", unavailable: needProject, build: shareableHtml },
];
