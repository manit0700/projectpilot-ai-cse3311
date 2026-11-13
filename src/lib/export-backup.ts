import { eventsOf, exportDate, resolveMode, shortTitle, usageOf, type ExportOptions } from "./export-common";
import { sessionLogCsv, sessionLogJson, SESSION_LOG_VERSION } from "./session-log";
import { EXPORT_APP, SAVE_VERSION } from "./store-persistence";
import type { WorkflowState } from "./workflow";

// The envelope matches what the store's importProject accepts (store-persistence.parseImport):
// { app, version, mode, state }, plus exportedAt for humans.
export const PLAN_APP = EXPORT_APP;
export const PLAN_VERSION = SAVE_VERSION;

// Store values carry actions and UI flags next to the data; a backup keeps only the data.
const UI_ONLY = new Set(["managerMode", "savedStatus", "hydrated", "busy", "busyLabel"]);

export function backupState(s: WorkflowState): Record<string, unknown> {
  return Object.fromEntries(Object.entries(s).filter(([key, value]) => typeof value !== "function" && !UI_ONLY.has(key)));
}

/** plan.json: a complete, importable backup of the session. */
export function planJson(s: WorkflowState, opts?: ExportOptions): string {
  if (opts?.planJsonText) return opts.planJsonText;
  return JSON.stringify({ app: PLAN_APP, version: PLAN_VERSION, exportedAt: (opts?.now ?? new Date()).toISOString(), mode: resolveMode(s, opts), state: backupState(s) }, null, 2) + "\n";
}

export type ParsedPlan = { ok: true; state: Record<string, unknown>; exportedAt: string | null } | { ok: false; error: string };

/** Check a plan.json file before it is handed to the store. */
export function parsePlanJson(source: string): ParsedPlan {
  let data: unknown;
  try { data = JSON.parse(source); } catch { return { ok: false, error: "This file is not valid JSON." }; }
  const root = data as { app?: unknown; version?: unknown; exportedAt?: unknown; state?: Record<string, unknown> } | null;
  if (!root || typeof root !== "object" || root.app !== PLAN_APP) return { ok: false, error: "This is not a ProjectPilot plan.json file." };
  const version = root.version;
  if (typeof version !== "number" || ![2, PLAN_VERSION].includes(version)) return { ok: false, error: typeof version === "number" && version > PLAN_VERSION ? "This plan.json was made by a newer version of ProjectPilot." : "This plan.json version is not supported." };
  const state = root.state;
  if (!state || typeof state !== "object") return { ok: false, error: "plan.json has no saved project." };
  const project = state.project as { id?: unknown } | undefined;
  if (!project || typeof project.id !== "string") return { ok: false, error: "plan.json has no saved project." };
  for (const key of ["questions", "requirements", "tasks", "outputs", "reviews"]) {
    if (!Array.isArray(state[key])) return { ok: false, error: `plan.json is missing the ${key} list.` };
  }
  return { ok: true, state, exportedAt: typeof root.exportedAt === "string" ? root.exportedAt : null };
}

/** Session log downloads: available at any step, header-only when nothing is recorded yet. */
export function sessionLogCsvFile(s: WorkflowState): string {
  return sessionLogCsv(eventsOf(s));
}
export function sessionLogJsonFile(s: WorkflowState, opts?: ExportOptions): string {
  return sessionLogJson({ app: PLAN_APP, logVersion: SESSION_LOG_VERSION, project: shortTitle(s.project), plannedOn: exportDate(opts), usage: usageOf(s) }, eventsOf(s));
}
