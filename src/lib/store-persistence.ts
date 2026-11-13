import { AGENTS } from "./agents";
import { EMPTY_METRICS, normalizeUsefulness } from "./metrics";
import { sanitizeEvents, sanitizeUsage } from "./session-events";
import type { WorkflowStep } from "./types";
import { validateTasks, type WorkflowState } from "./workflow";

// Browser persistence for the planning workflow. Saves are validated before use
// and older save versions are migrated rather than discarded.
export const STORAGE_KEY = "projectpilot-v2";
export const RECOVERY_KEY = "projectpilot-recovery";
export const SAVE_VERSION = 3;
export type ManagerMode = "demo" | "live";

const STEPS: WorkflowStep[] = ["idea", "questions", "requirements", "tasks", "board", "review", "feedback", "final"];
const COLLECTIONS = ["questions", "requirements", "tasks", "agents", "outputs", "reviews", "feedbackItems", "managerNotes", "staleTaskIds", "revisionTaskIds", "skippedTaskIds"] as const;

export function serializeState(state: WorkflowState, mode: ManagerMode): string {
  return JSON.stringify({ version: SAVE_VERSION, state, mode });
}

function validateShape(restored: WorkflowState): void {
  if (typeof restored.project?.id !== "string" || !STEPS.includes(restored.currentStep)) throw new Error("Invalid save");
  for (const field of COLLECTIONS) {
    if (!Array.isArray(restored[field])) throw new Error("Invalid saved collection");
  }
  if (validateTasks(restored.tasks)) throw new Error("Invalid task plan");
  const valid =
    restored.outputs.every((o) => o && typeof o.id === "string" && typeof o.summary === "string" && Array.isArray(o.assumptions) && Array.isArray(o.blockers) && Array.isArray(o.nextSteps)) &&
    restored.requirements.every((r) => r && typeof r.id === "string" && typeof r.text === "string" && (r.acceptance === undefined || (Array.isArray(r.acceptance) && r.acceptance.every((a) => typeof a === "string")))) &&
    restored.questions.every((q) => q && typeof q.prompt === "string" && typeof q.answer === "string") &&
    restored.reviews.every((r) => r && typeof r.outputId === "string" && Array.isArray(r.conflicts) && Array.isArray(r.missingItems) && Array.isArray(r.suggestions));
  if (!valid) throw new Error("Invalid saved content");
}

/** Fill in fields older saves lack. Version 2 had no start timestamp guarantee and a fabricated default rating of 7. */
function migrate(restored: WorkflowState, saved: Partial<WorkflowState>, version: number): WorkflowState {
  const createdAt = Date.parse(restored.project.createdAt);
  // Read the saved start directly: the base state carries a fresh Date.now() that must not mask a missing value.
  const startedAt = typeof saved.startedAt === "number" && Number.isFinite(saved.startedAt) && saved.startedAt > 0 ? saved.startedAt : Number.isFinite(createdAt) ? createdAt : Date.now();
  const savedScore = restored.metrics && typeof restored.metrics === "object" ? restored.metrics.usefulnessScore : null;
  const usefulnessScore = version === 2 && savedScore === 7 ? null : normalizeUsefulness(savedScore);
  const completedAt = typeof restored.completedAt === "number" && Number.isFinite(restored.completedAt) ? restored.completedAt : null;
  // Saves written before the evaluation log existed carry no events or usage: start them empty.
  return { ...restored, startedAt, completedAt, metrics: { ...EMPTY_METRICS, usefulnessScore }, events: sanitizeEvents(saved.events), usage: sanitizeUsage(saved.usage) };
}

/** Parse, validate and migrate a saved session. Throws when the save cannot be trusted. */
export function restoreSavedState(raw: string, base: WorkflowState): { state: WorkflowState; mode: ManagerMode } {
  return restoreParsed(JSON.parse(raw), base);
}

function restoreParsed(saved: { version?: number; state?: WorkflowState; mode?: string }, base: WorkflowState): { state: WorkflowState; mode: ManagerMode } {
  if (![2, SAVE_VERSION].includes(saved?.version as number) || !saved?.state || typeof saved.state !== "object") throw new Error("Invalid save");
  const merged = { ...base, ...saved.state } as WorkflowState;
  if (typeof merged.project?.id !== "string" || typeof merged.project.createdAt !== "string") throw new Error("Invalid save");
  const restored = migrate(merged, saved.state, saved.version as number);
  validateShape(restored);
  // Work interrupted mid-run cannot be trusted as complete: mark it retryable.
  restored.tasks = restored.tasks.map((t) => (t.state === "in_progress" || (restored.project.status === "revising" && restored.revisionTaskIds.includes(t.id))) ? { ...t, state: "failed" } : t);
  restored.agents = AGENTS;
  if (["agents_running", "revising"].includes(restored.project.status)) {
    restored.project = { ...restored.project, status: "review_pending" };
    restored.currentStep = "board";
    const interrupted = restored.tasks.filter((t) => t.state === "failed").length;
    restored.workflowNotice = `An interrupted run was restored. ${interrupted} task${interrupted === 1 ? " was" : "s were"} interrupted: retry ${interrupted === 1 ? "it" : "them"} on the board; completed outputs are preserved.`;
  }
  return { state: restored, mode: saved.mode === "live" ? "live" : "demo" };
}

export const EXPORT_APP = "projectpilot";
const MAX_IMPORT_BYTES = 8_000_000;

/** The envelope the plan.json export writes. */
export function serializeExport(state: WorkflowState, mode: ManagerMode): string {
  return JSON.stringify({ app: EXPORT_APP, version: SAVE_VERSION, mode, state }, null, 2);
}

/**
 * Validate a previously exported plan.json with the same checks a saved session gets.
 * Throws a user-readable Error when the file is not a ProjectPilot export, has an unknown version or fails validation.
 */
export function parseImport(json: string, base: WorkflowState): { state: WorkflowState; mode: ManagerMode | null } {
  if (typeof json !== "string" || json.length > MAX_IMPORT_BYTES) throw new Error("That file is too large to be a ProjectPilot plan.");
  let parsed: { app?: unknown; version?: unknown; state?: unknown; mode?: unknown };
  try { parsed = JSON.parse(json); } catch { throw new Error("That file is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || parsed.app !== EXPORT_APP) throw new Error("That file is not a ProjectPilot plan export.");
  if (typeof parsed.version !== "number" || ![2, SAVE_VERSION].includes(parsed.version)) throw new Error(`Unsupported export version ${String(parsed.version)}. This app reads versions 2 and ${SAVE_VERSION}.`);
  if (!parsed.state || typeof parsed.state !== "object") throw new Error("The export has no project data.");
  try {
    const restored = restoreParsed({ version: parsed.version, state: parsed.state as WorkflowState, mode: typeof parsed.mode === "string" ? parsed.mode : undefined }, base);
    return { state: restored.state, mode: parsed.mode === "live" || parsed.mode === "demo" ? restored.mode : null };
  } catch (error) {
    throw new Error(`The export failed validation: ${error instanceof Error ? error.message : "invalid data"}.`);
  }
}

/** Keep a copy of a save that failed to load, or of the current project before it is replaced, so the user can download it. */
export function keepRecoveryCopy(serialized?: string): void {
  try {
    const damaged = serialized ?? localStorage.getItem(STORAGE_KEY);
    if (damaged) localStorage.setItem(RECOVERY_KEY, damaged);
  } catch { /* Storage may be unavailable; keep the session usable. */ }
}
