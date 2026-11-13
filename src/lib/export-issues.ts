import { AGENT_LABELS } from "./agents";
import { acceptanceOf, csvRow, dependencyLabels, planSlug, scrubIds, shellQuote, shortTitle, taskTitle, requirementRef } from "./export-common";
import { topologicalOrder, type WorkflowState } from "./workflow";

// GitHub Issues from tasks: a CSV for spreadsheets and importers, and a script for the `gh` CLI.

export interface IssueDraft { title: string; body: string; labels: string[]; milestone: string }

export const roleLabel = (role: string): string => `role:${role}`;

/** Project-level acceptance criteria that apply to every task (must-have requirements only, at most 8). */
function projectCriteria(s: WorkflowState): string[] {
  return s.requirements.flatMap((r, i) => (r.approvalStatus === "rejected" || r.priority !== "must" ? [] : acceptanceOf(r).map((c) => `${requirementRef(i)}: ${scrubIds(c, s)}`))).slice(0, 8);
}

export function issueDrafts(s: WorkflowState): IssueDraft[] {
  const milestone = shortTitle(s.project);
  const criteria = projectCriteria(s);
  const clean = (v: string) => scrubIds(v, s);
  return topologicalOrder(s.tasks).map((t) => {
    const deps = dependencyLabels(s, t);
    const body = [
      clean(t.description), "",
      `**Expected output:** ${clean(t.expectedOutput)}`,
      `**Constraints:** ${clean(t.constraints) || "None stated"}`,
      `**Owner role:** ${AGENT_LABELS[t.ownerAgent]}`,
      `**Depends on:** ${deps.join("; ") || "No prerequisites"}`, "",
      "**Acceptance criteria**",
      `- [ ] Expected output delivered: ${clean(t.expectedOutput)}`,
      ...criteria.map((c) => `- [ ] ${c}`), "",
      "_Created from a ProjectPilot AI plan._",
    ].join("\n");
    return { title: taskTitle(t), body, labels: [roleLabel(t.ownerAgent), "projectpilot"], milestone };
  });
}

export const ISSUES_COLUMNS = ["title", "body", "labels", "milestone"] as const;

export function issuesCsv(s: WorkflowState): string {
  return [csvRow([...ISSUES_COLUMNS]), ...issueDrafts(s).map((d) => csvRow([d.title, d.body, d.labels.join(","), d.milestone]))].join("\n") + "\n";
}

/** A bash script that creates one issue per task. Every value is single-quoted; nothing is evaluated. */
export function createIssuesScript(s: WorkflowState): string {
  const drafts = issueDrafts(s);
  const labels = [...new Set(drafts.flatMap((d) => d.labels))];
  const milestone = drafts[0]?.milestone ?? shortTitle(s.project);
  return [
    "#!/usr/bin/env bash",
    `# Creates ${drafts.length} GitHub issues from the ProjectPilot AI plan "${shortTitle(s.project).replace(/[^\x20-\x7e]/g, "")}".`,
    "# Requires the GitHub CLI (https://cli.github.com) signed in with: gh auth login",
    "# Usage:  bash create-issues.sh owner/repo        (run inside the repo folder to omit owner/repo)",
    "#         USE_MILESTONE=1 bash create-issues.sh   (the milestone must already exist in the repo)",
    "set -euo pipefail",
    "",
    'repo_args=()',
    'if [ "${1:-}" != "" ]; then repo_args=(--repo "$1"); fi',
    'milestone_args=()',
    `if [ "\${USE_MILESTONE:-0}" = "1" ]; then milestone_args=(--milestone ${shellQuote(milestone)}); fi`,
    "",
    "# Labels first, so issue creation does not fail on a missing label.",
    ...labels.map((l) => `gh label create ${shellQuote(l)} --force \${repo_args[@]+"\${repo_args[@]}"}`),
    "",
    ...drafts.map((d) => `gh issue create \${repo_args[@]+"\${repo_args[@]}"} \${milestone_args[@]+"\${milestone_args[@]}"} --title ${shellQuote(d.title)} --label ${shellQuote(d.labels.join(","))} --body ${shellQuote(d.body)}`),
    "",
    'echo "Done."',
  ].join("\n") + "\n";
}

export const issuesCsvFilename = (s: WorkflowState): string => `${planSlug(s)}-issues.csv`;
export const issuesScriptFilename = (): string => "create-issues.sh";
