import { AGENTS, WORKFLOW_STEPS } from "./agents";
import { elapsedMinutes } from "./metrics";
import type { SessionEvent } from "./session-log";
import type { AgentOutput, Requirement, Task } from "./types";
import { frontier, outputsReady, taskCode, type WorkflowState } from "./workflow";

// Shared helpers for every exporter. Fields owned by the CORE stream (events, usage, rubric,
// constitution, acceptance, humanEdited, output meta) are read through loose accessors so the
// exporters work whether or not the store already writes them.

export type ExportMode = "demo" | "live";
export interface ExportOptions {
  /** Manager mode of the session; inferred from the event log when omitted. */
  mode?: ExportMode;
  /** Export time. Injectable so tests are deterministic. */
  now?: Date;
  /** Pre-serialised backup (for example from the store's exportState); used instead of rebuilding plan.json. */
  planJsonText?: string;
}
export interface ExportFile { name: string; content: string | Uint8Array }

type Loose = Record<string, unknown>;
const loose = (value: unknown): Loose => (value && typeof value === "object" ? (value as Loose) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const NOT_RECORDED = "not recorded";

export function eventsOf(s: object): SessionEvent[] {
  const events = loose(s).events;
  return Array.isArray(events) ? (events as SessionEvent[]).filter((e) => e && typeof e === "object" && typeof e.type === "string") : [];
}

export interface ExportUsage { requests: number | null; promptTokens: number | null; completionTokens: number | null; models: string[]; totalLatencyMs: number | null }
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

export function usageOf(s: object): ExportUsage | null {
  const usage = loose(s).usage;
  if (!usage || typeof usage !== "object") return null;
  const u = loose(usage);
  const rawModels = u.models;
  const models = Array.isArray(rawModels) ? rawModels.filter((m): m is string => typeof m === "string") : rawModels && typeof rawModels === "object" ? Object.keys(rawModels) : [];
  return { requests: num(u.requests), promptTokens: num(u.promptTokens), completionTokens: num(u.completionTokens), models, totalLatencyMs: num(u.totalLatencyMs) };
}

/** Extra fields on a project, requirement or output that may not exist in older saves. */
export function asLines(value: unknown): string[] {
  if (typeof value === "string") return value.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap((item) => {
    if (typeof item === "string") return asLines(item);
    const o = loose(item);
    const label = text(o.criterion) || text(o.name) || text(o.title) || text(o.text);
    const detail = text(o.description) || text(o.detail);
    return label ? [detail && detail !== label ? `${label}: ${detail}` : label] : [];
  });
  return [];
}
export const acceptanceOf = (r: Requirement): string[] => asLines(loose(r).acceptance);
export const rubricOf = (s: WorkflowState): string[] => asLines(loose(s.project).rubric);
export const constitutionOf = (s: WorkflowState): string[] => asLines(loose(s.project).constitution);
export const isHumanEdited = (s: WorkflowState, o: AgentOutput): boolean =>
  loose(o).humanEdited === true || eventsOf(s).some((e) => e.type === "output_edited" && (e.entityId === o.id || e.entityId === o.taskId));
export const hasHumanEditedField = (s: WorkflowState): boolean => s.outputs.some((o) => typeof loose(o).humanEdited === "boolean");

export function isComplete(s: WorkflowState): boolean {
  return s.project.status === "complete" && outputsReady(s);
}
/** 1-based step the session has reached; the export is a draft until this is 8. */
export function stepNumber(s: WorkflowState): number {
  const step = s.project.id ? frontier(s) + 1 : 1;
  return Math.min(step, WORKFLOW_STEPS.length);
}
export const draftNote = (s: WorkflowState): string => (isComplete(s) ? "" : `(draft: step ${stepNumber(s)} of ${WORKFLOW_STEPS.length})`);
export const hasProject = (s: WorkflowState): boolean => Boolean(s.project?.id);

/** First clause of the idea, at most 60 characters: a title instead of a truncated sentence. */
export function shortTitle(project: { title?: string; description?: string }): string {
  const source = (project.description || project.title || "").trim().replace(/\s+/g, " ");
  if (!source) return "Untitled project";
  const clause = source.split(/[.;:!?]|,\s|\s[—–]\s|\s(?:where|that|which|so that|for)\s/i)[0].trim() || source;
  const fitted = clause.length <= 60 ? clause : (() => { const cut = clause.slice(0, 60); return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trim()}…`; })();
  return fitted.charAt(0).toUpperCase() + fitted.slice(1);
}

/** Lowercase, hyphenated, no leading article, at most `max` characters on a word boundary. */
export function slugify(input: string, max = 48): string {
  const words = input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  while (words.length > 1 && ["a", "an", "the"].includes(words[0])) words.shift();
  let slug = "";
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > max) { if (!slug) slug = word.slice(0, max); break; }
    slug = next;
  }
  return slug || "projectpilot";
}
export const planSlug = (s: WorkflowState): string => slugify(shortTitle(s.project).replace(/…$/, ""));

export const exportDate = (opts?: ExportOptions): string => (opts?.now ?? new Date()).toISOString().slice(0, 10);

export function resolveMode(s: WorkflowState, opts?: ExportOptions): ExportMode {
  if (opts?.mode) return opts.mode;
  if (eventsOf(s).some((e) => e.mode === "live")) return "live";
  const usage = usageOf(s);
  return usage && (usage.requests ?? 0) > 0 ? "live" : "demo";
}
export const modeLabel = (mode: ExportMode): string => (mode === "live" ? "Live" : "Demo prepared responses");

export interface ModelRef { provider?: string; model?: string }
export const modelLabel = (ref: ModelRef | null | undefined): string => {
  const parts = [ref?.provider, ref?.model].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join("/") : NOT_RECORDED;
};
const PRODUCING = new Set(["output_generated", "answer_drafted", "requirement_drafted", "review_completed"]);

/** Provider/model recorded for one output: its event first, then any `meta` stored on the output. */
export function outputModel(s: WorkflowState, o: AgentOutput): ModelRef | null {
  const generated = eventsOf(s).filter((e) => e.type === "output_generated" && (e.entityId === o.id || e.entityId === o.taskId) && (e.provider || e.model));
  const last = generated[generated.length - 1];
  if (last) return { provider: last.provider, model: last.model };
  const meta = loose(loose(o).meta);
  const provider = text(meta.provider) || undefined, model = text(meta.model) || undefined;
  return provider || model ? { provider, model } : null;
}

/** Every distinct provider/model that produced content in this session. */
export function modelsUsed(s: WorkflowState): string[] {
  const seen = new Set<string>();
  for (const e of eventsOf(s)) if (PRODUCING.has(e.type) && (e.provider || e.model)) seen.add(modelLabel(e));
  for (const o of s.outputs) { const ref = outputModel(s, o); if (ref) seen.add(modelLabel(ref)); }
  for (const m of usageOf(s)?.models ?? []) seen.add(m);
  return [...seen];
}

export function planningMinutes(s: WorkflowState, opts?: ExportOptions): number {
  const stored = s.metrics?.planningElapsedMinutes;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) return stored;
  return elapsedMinutes(s.startedAt, s.completedAt ?? null, (opts?.now ?? new Date()).getTime());
}

// ---- readable references instead of internal ids ---------------------------------------------

export const taskRef = (task: Task): string => taskCode(task);
export const taskTitle = (task: Task): string => `${taskCode(task)} · ${task.title}`;
export const requirementRef = (index: number): string => `REQ-${String(index + 1).padStart(2, "0")}`;

export function taskRefMap(s: WorkflowState): Map<string, string> {
  return new Map(s.tasks.map((t) => [t.id, taskCode(t)]));
}
/** Dependencies as 'TASK-01 · Title' labels; ids that no longer exist are dropped, never printed. */
export function dependencyLabels(s: WorkflowState, task: Task): string[] {
  return task.dependencies.map((id) => s.tasks.find((t) => t.id === id)).filter((t): t is Task => Boolean(t)).map(taskTitle);
}
/** Replace internal task, requirement and output ids inside free text with TASK-NN / REQ-NN. */
export function scrubIds(value: string, s: WorkflowState): string {
  const replacements = new Map<string, string>();
  for (const t of s.tasks) replacements.set(t.id, taskCode(t));
  s.requirements.forEach((r, i) => replacements.set(r.id, requirementRef(i)));
  for (const o of s.outputs) { const t = s.tasks.find((x) => x.id === o.taskId); if (t) replacements.set(o.id, `output of ${taskCode(t)}`); }
  const ids = [...replacements.keys()].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!ids.length) return value;
  const pattern = new RegExp(`(?<![A-Za-z0-9_-])(?:${ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z0-9_-])`, "g");
  return value.replace(pattern, (id) => replacements.get(id) ?? id);
}

/** Output assumptions without the agent role description the demo agents used to list as an assumption. */
const ROLE_DESCRIPTIONS = new Set(AGENTS.map((a) => a.capability.trim().toLowerCase()).concat("specialist capability"));
export const usefulAssumptions = (o: AgentOutput): string[] => o.assumptions.filter((a) => !ROLE_DESCRIPTIONS.has(a.trim().toLowerCase()));

export function orderedTasks(s: WorkflowState): Task[] {
  return [...s.tasks].sort((a, b) => a.order - b.order);
}
export function outputFor(s: WorkflowState, task: Task): AgentOutput | undefined {
  const matches = s.outputs.filter((o) => o.taskId === task.id);
  return matches.find((o) => o.approved === "approved") ?? matches[matches.length - 1];
}

export function reviewFindings(s: WorkflowState, o: AgentOutput): string[] | null {
  const review = s.reviews.find((r) => r.outputId === o.id);
  return review ? [...review.missingItems, ...review.conflicts, ...review.suggestions] : null;
}

// ---- safe text for CSV and shell -------------------------------------------------------------

/** CSV cell: quote delimiters, quotes and newlines; neutralise spreadsheet formulas with a leading apostrophe. */
export function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const raw = String(value);
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
export const csvRow = (cells: unknown[]): string => cells.map(csvCell).join(",");

/** Single-quote a string for POSIX shells: nothing inside is ever interpreted. */
export function shellQuote(value: string): string {
  const clean = value.replace(/\0/g, "").replace(/[\u0001-\u0008\u000b-\u001f\u007f]/g, "");
  return `'${clean.replace(/'/g, `'\\''`)}'`;
}

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const bullets = (items: string[], empty = "None"): string => (items.length ? items.map((i) => `- ${i}`).join("\n") : empty);
