import { AGENT_LABELS } from "./agents";
import { planJson } from "./export-backup";
import {
  acceptanceOf, constitutionOf, dependencyLabels, draftNote, exportDate, isComplete, isHumanEdited, modeLabel, orderedTasks, outputFor, planSlug,
  requirementRef, resolveMode, rubricOf, scrubIds, shortTitle, taskTitle, type ExportFile, type ExportOptions,
} from "./export-common";
import { provenanceLines } from "./plan-export";
import { createZip } from "./zip";
import type { AgentRole } from "./types";
import { topologicalOrder, type WorkflowState } from "./workflow";

// The spec bundle is what a student hands to their own coding agent (Claude Code, Copilot, Kiro):
// requirements, an ordered task list, design notes and an agent instruction file.

const activeRequirements = (s: WorkflowState) =>
  s.requirements.map((r, i) => ({ r, ref: requirementRef(i) })).filter(({ r }) => (isComplete(s) ? r.approvalStatus === "approved" : r.approvalStatus !== "rejected"));

export function requirementsMd(s: WorkflowState): string {
  const draft = draftNote(s);
  const clean = (v: string) => scrubIds(v, s);
  const rows = activeRequirements(s);
  return [
    `# Requirements: ${shortTitle(s.project)}${draft ? ` ${draft}` : ""}`,
    `Target users: ${s.project.targetUser || "not set"}`,
    ...(rows.length ? rows.map(({ r, ref }) => {
      const criteria = acceptanceOf(r);
      return `## ${ref} · ${clean(r.text)}\n\n- Priority: ${r.priority.toUpperCase()}\n- Status: ${r.approvalStatus}\n${criteria.length ? `- Acceptance criteria:\n${criteria.map((c) => `  - [ ] ${clean(c)}`).join("\n")}` : "- Acceptance criteria: not written yet. Derive them from the expected output of the tasks that implement this requirement."}`;
    }) : ["No requirements yet."]),
  ].join("\n\n") + "\n";
}

export function tasksMd(s: WorkflowState): string {
  const draft = draftNote(s);
  const clean = (v: string) => scrubIds(v, s);
  const ordered = topologicalOrder(s.tasks);
  return [
    `# Tasks: ${shortTitle(s.project)}${draft ? ` ${draft}` : ""}`,
    "Work through these in order. A task may start only after the tasks it depends on are done.",
    ...(ordered.length ? ordered.map((t) => `## ${taskTitle(t)}\n\n- [ ] ${clean(t.description)}\n\n- Owner role: ${AGENT_LABELS[t.ownerAgent]}\n- Depends on: ${dependencyLabels(s, t).join("; ") || "No prerequisites"}\n- Expected output: ${clean(t.expectedOutput)}\n- Constraints: ${clean(t.constraints) || "None stated"}`) : ["No tasks yet."]),
  ].join("\n\n") + "\n";
}

const DESIGN_ROLES: Array<[AgentRole, string]> = [["database", "Database design"], ["backend", "Backend design"], ["frontend", "Frontend design"], ["testing", "Testing and acceptance notes"], ["documentation", "Documentation notes"]];

export function designMd(s: WorkflowState): string {
  const draft = draftNote(s);
  const sections = [`# Design: ${shortTitle(s.project)}${draft ? ` ${draft}` : ""}`, "Design deliverables written by the specialist agents, grouped by role. Marks show which text a human edited."];
  for (const [role, heading] of DESIGN_ROLES) {
    const items = orderedTasks(s).filter((t) => t.ownerAgent === role).map((t) => ({ t, o: outputFor(s, t) })).filter((x) => x.o && x.o.approved !== "rejected");
    if (!items.length) { if (role === "database" || role === "backend" || role === "frontend") sections.push(`## ${heading}\n\nNo ${role} deliverable yet.`); continue; }
    sections.push(`## ${heading}`, ...items.map(({ t, o }) => `### ${taskTitle(t)}${isHumanEdited(s, o!) ? " [human-edited]" : ""}\n\n${scrubIds(o!.summary, s)}`));
  }
  return sections.join("\n\n") + "\n";
}

/** AGENTS.md and CLAUDE.md share one body; both file names are written so any agent finds its own. */
export function agentInstructionsMd(s: WorkflowState): string {
  const clean = (v: string) => scrubIds(v, s);
  const constitution = constitutionOf(s);
  const rubric = rubricOf(s);
  const stackAnswers = s.questions.filter((q) => /tech|stack|language|host|database|login|auth|constraint|framework/i.test(q.prompt) && q.answer.trim());
  const taskConstraints = [...new Set(s.tasks.map((t) => t.constraints.trim()).filter(Boolean))];
  const criteria = activeRequirements(s).flatMap(({ r, ref }) => acceptanceOf(r).map((c) => `${ref}: ${clean(c)}`));
  const musts = activeRequirements(s).filter(({ r }) => r.priority === "must");
  return [
    `# ${shortTitle(s.project)}`,
    "## Project brief", clean(s.project.description) || "No idea entered yet.", `Target users: ${s.project.targetUser || "not set"}`,
    ...(musts.length ? ["Must-have requirements:", musts.map(({ r, ref }) => `- ${ref} ${clean(r.text)}`).join("\n")] : []),
    ...(constitution.length ? ["## Project rules (constitution)", constitution.map((c) => `- ${clean(c)}`).join("\n")] : []),
    "## Stack and constraints",
    [...stackAnswers.map((q) => `- ${q.prompt} ${clean(q.answer.trim())}`), ...taskConstraints.map((c) => `- ${clean(c)}`)].join("\n") || "- No stack constraints were recorded. Ask the author before choosing a framework or a database.",
    "## Conventions",
    ["- Follow the existing code style and folder layout; add new files only when a task needs them.", "- Keep changes small: one task per commit, with a message that names the task (for example `TASK-03: add session form`).", "- Never commit secrets, API keys or `.env` files.", "- Validate input at the boundaries (forms and API routes) and handle empty and error states.", "- Do not add features, dependencies or services that no requirement asks for."].join("\n"),
    "## How to work",
    ["1. Read `requirements.md`, `tasks.md` and `design.md` before writing code.", "2. Work through `tasks.md` strictly in order; finish and verify a task before starting the next.", "3. For each task, produce its expected output and respect its constraints.", "4. After each task, run the project's tests and linter, then tick the task off.", "5. If a task contradicts a requirement or is unclear, stop and ask the author instead of guessing."].join("\n"),
    "## Definition of done",
    [criteria.length ? criteria.map((c) => `- [ ] ${c}`).join("\n") : "- [ ] Every must-have requirement works end to end and was checked by hand.", ...(rubric.length ? ["", "Grading rubric:", ...rubric.map((r) => `- ${clean(r)}`)] : []), "", "- [ ] Every task in `tasks.md` is complete and its expected output exists.", "- [ ] Tests pass and the app builds without errors or warnings."].join("\n"),
  ].join("\n\n") + "\n";
}

export function specReadmeMd(s: WorkflowState, opts?: ExportOptions): string {
  const draft = draftNote(s);
  return [
    `# Spec bundle: ${shortTitle(s.project)}${draft ? ` ${draft}` : ""}`,
    `Made with ProjectPilot AI on ${exportDate(opts)} (${modeLabel(resolveMode(s, opts))}). A plan for a coding agent to follow; no application code is included.`,
    "## Files",
    ["- `requirements.md`: requirements with priority and acceptance criteria", "- `tasks.md`: ordered tasks with dependencies, expected output and constraints", "- `design.md`: database, backend and frontend design by role", "- `AGENTS.md` and `CLAUDE.md`: the same instructions for your coding agent", "- `plan.json`: a backup you can import back into ProjectPilot"].join("\n"),
    "## Use it",
    ["1. Unzip into the root of your project repository.", "2. Open the repository in your coding agent. Claude Code reads `CLAUDE.md`; GitHub Copilot and other agents read `AGENTS.md`; if your tool uses another instruction file (for example Kiro steering files), copy the text of `AGENTS.md` there.", "3. Ask it to \"work through tasks.md in order, one task at a time\" and review each result yourself."].join("\n"),
    "## Provenance", provenanceLines(s, opts).map((l) => `- ${l}`).join("\n"),
  ].join("\n\n") + "\n";
}

export function specBundleFiles(s: WorkflowState, opts?: ExportOptions): ExportFile[] {
  const agents = agentInstructionsMd(s);
  return [
    { name: "README.md", content: specReadmeMd(s, opts) },
    { name: "requirements.md", content: requirementsMd(s) },
    { name: "tasks.md", content: tasksMd(s) },
    { name: "design.md", content: designMd(s) },
    { name: "AGENTS.md", content: agents },
    { name: "CLAUDE.md", content: agents },
    { name: "plan.json", content: planJson(s, opts) },
  ];
}

export const specZipFilename = (s: WorkflowState): string => `${planSlug(s)}-spec.zip`;

export function specBundleZip(s: WorkflowState, opts?: ExportOptions): Uint8Array {
  const now = opts?.now ?? new Date();
  return createZip(specBundleFiles(s, opts).map((f) => ({ name: f.name, data: f.content, modified: now })));
}
