import { uid } from "./agents";
import type { SessionEvent, SessionEventType } from "./session-log";
import type { UsageSummary } from "./types";
import { EMPTY_USAGE, type WorkflowState } from "./workflow";

// Writer side of the append-only session log (the contract lives in session-log.ts).
// Every helper is pure: it returns a new state and never mutates the old one.

export const MAX_EVENTS = 2000;
export const MAX_EVENT_TEXT = 2000;

/** What a model route reports next to a successful reply. Every field may be absent. */
export interface ModelMeta {
  provider?: string;
  model?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export type EventInput = {
  type: SessionEventType;
  entityId?: string;
  detail?: string;
  before?: string;
  after?: string;
  meta?: ModelMeta;
};

export const clip = (text: string | undefined, max = MAX_EVENT_TEXT): string | undefined =>
  text === undefined ? undefined : text.length > max ? text.slice(0, max) : text;

const count = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined);
const label = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined);

/** Accept route metadata only when it is well formed; anything else is treated as absent. Never invents numbers. */
export function normalizeMeta(value: unknown): ModelMeta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const meta: ModelMeta = { provider: label(raw.provider), model: label(raw.model), latencyMs: count(raw.latencyMs), promptTokens: count(raw.promptTokens), completionTokens: count(raw.completionTokens) };
  return Object.values(meta).some((v) => v !== undefined) ? meta : undefined;
}

function toEvent(s: WorkflowState, live: boolean, input: EventInput, now: number): SessionEvent {
  const meta = normalizeMeta(input.meta);
  const event: SessionEvent = {
    id: uid("evt"), at: new Date(now).toISOString(), msSinceStart: Math.max(0, now - s.startedAt), type: input.type, mode: live ? "live" : "demo",
  };
  if (input.entityId) event.entityId = input.entityId;
  if (meta?.provider) event.provider = meta.provider;
  if (meta?.model) event.model = meta.model;
  if (meta?.latencyMs !== undefined) event.latencyMs = meta.latencyMs;
  if (meta?.promptTokens !== undefined) event.promptTokens = meta.promptTokens;
  if (meta?.completionTokens !== undefined) event.completionTokens = meta.completionTokens;
  if (input.detail !== undefined) event.detail = clip(input.detail, 500);
  if (input.before !== undefined) event.before = clip(input.before);
  if (input.after !== undefined) event.after = clip(input.after);
  return event;
}

/** Append events, keeping the newest MAX_EVENTS. */
export function logEvents(s: WorkflowState, live: boolean, inputs: EventInput | EventInput[], now = Date.now()): WorkflowState {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  if (!list.length) return s;
  const events = [...s.events, ...list.map((input) => toEvent(s, live, input, now))];
  return { ...s, events: events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events };
}

/**
 * The text a person first saw from the AI for this entity, so edits never lose the original.
 * Falls back to `current` when the log has nothing for it.
 */
export function originalText(events: SessionEvent[], entityId: string, current: string): string {
  for (const event of events) {
    if (event.entityId !== entityId) continue;
    if (["requirement_drafted", "answer_drafted", "output_generated"].includes(event.type) && event.after !== undefined) return event.after;
    if (["requirement_edited", "answer_edited", "output_edited"].includes(event.type) && event.before !== undefined) return event.before;
  }
  return current;
}

/**
 * Log a typing edit of a clarifying answer. Consecutive edits of the same answer collapse into one row
 * (before stays the first text, after follows the latest) so keystrokes do not flood the log.
 */
export function logAnswerEdit(s: WorkflowState, live: boolean, entityId: string, before: string, after: string): WorkflowState {
  if (before === after) return s;
  const last = s.events[s.events.length - 1];
  if (last?.type === "answer_edited" && last.entityId === entityId) {
    const merged: SessionEvent = { ...last, after: clip(after) };
    return { ...s, events: [...s.events.slice(0, -1), merged] };
  }
  return logEvents(s, live, { type: "answer_edited", entityId, before, after });
}

/** Add one model call's metadata to the usage summary. No meta means no change. */
export function addUsage(usage: UsageSummary, meta: ModelMeta | undefined): UsageSummary {
  const clean = normalizeMeta(meta);
  if (!clean) return usage;
  const name = clean.model ? (clean.provider ? `${clean.provider}/${clean.model}` : clean.model) : clean.provider;
  return {
    requests: usage.requests + 1,
    promptTokens: usage.promptTokens + (clean.promptTokens ?? 0),
    completionTokens: usage.completionTokens + (clean.completionTokens ?? 0),
    totalLatencyMs: usage.totalLatencyMs + (clean.latencyMs ?? 0),
    models: name && !usage.models.includes(name) ? [...usage.models, name] : usage.models,
  };
}

/** Log one event and fold its model metadata into usage, for steps that came from a model call. */
export function logModelEvents(s: WorkflowState, live: boolean, inputs: EventInput[], meta: ModelMeta | undefined): WorkflowState {
  // The model call is one request: its tokens ride on the first event only, so summing events never double counts.
  return { ...logEvents(s, live, inputs.map((i, n) => (n === 0 ? { meta, ...i } : i))), usage: addUsage(s.usage, meta) };
}

/** Coerce a restored value into a valid, capped event list. */
export function sanitizeEvents(value: unknown): SessionEvent[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((e): e is SessionEvent => !!e && typeof e === "object" && typeof (e as SessionEvent).id === "string" && typeof (e as SessionEvent).type === "string" && typeof (e as SessionEvent).at === "string" && typeof (e as SessionEvent).msSinceStart === "number" && ["demo", "live"].includes((e as SessionEvent).mode));
  return valid.slice(-MAX_EVENTS);
}

export function sanitizeUsage(value: unknown): UsageSummary {
  if (!value || typeof value !== "object") return EMPTY_USAGE;
  const raw = value as Record<string, unknown>;
  return {
    requests: count(raw.requests) ?? 0, promptTokens: count(raw.promptTokens) ?? 0, completionTokens: count(raw.completionTokens) ?? 0,
    totalLatencyMs: count(raw.totalLatencyMs) ?? 0,
    models: Array.isArray(raw.models) ? raw.models.filter((m): m is string => typeof m === "string").slice(0, 20) : [],
  };
}
