// Append-only evaluation log. The store writes events, exports and the study kit read them.
// One row per human or agent decision, so accept / edit / reject behaviour and AI usage can be
// measured after a session without replaying it.

export const SESSION_LOG_VERSION = 1;

export type SessionEventType =
  | "project_started"
  | "answer_drafted"
  | "answer_edited"
  | "requirement_drafted"
  | "requirement_edited"
  | "requirement_approved"
  | "requirement_rejected"
  | "plan_approved"
  | "task_edited"
  | "output_generated"
  | "output_edited"
  | "output_approved"
  | "output_rejected"
  | "revision_requested"
  | "review_completed"
  | "feedback_submitted"
  | "run_failed"
  | "run_stopped"
  | "plan_finalized"
  | "usage_rated";

export interface SessionEvent {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Milliseconds since the project started. */
  msSinceStart: number;
  type: SessionEventType;
  /** Requirement, task, output or question id the event is about. */
  entityId?: string;
  mode: "demo" | "live";
  provider?: string;
  model?: string;
  /** Latency of the model call that produced this event, when there was one. */
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  /** Short human-readable note, for example the failure reason. */
  detail?: string;
  /** Text before and after a human edit, truncated to 2,000 characters each. */
  before?: string;
  after?: string;
}

const COLUMNS: Array<keyof SessionEvent> = [
  "at", "msSinceStart", "type", "entityId", "mode", "provider", "model", "latencyMs", "promptTokens", "completionTokens", "detail", "before", "after",
];

function cell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  // Quote when the cell holds a delimiter, quote or newline; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function sessionLogCsv(events: SessionEvent[]): string {
  return [COLUMNS.join(","), ...events.map((event) => COLUMNS.map((column) => cell(event[column])).join(","))].join("\n") + "\n";
}

export function sessionLogJson(meta: Record<string, unknown>, events: SessionEvent[]): string {
  return JSON.stringify({ version: SESSION_LOG_VERSION, exportedAt: new Date().toISOString(), ...meta, events }, null, 2);
}

/** Counts per type, for summaries such as "7 accepted, 2 edited, 1 rejected". */
export function countEvents(events: SessionEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return counts;
}
