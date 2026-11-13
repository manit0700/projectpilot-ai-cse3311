import type { AgentOutput, ProjectContext, Task } from "./types";
import { normalizeMeta, type ModelMeta } from "./session-events";
import { normalizeReviews, normalizeSpecialist } from "./specialist-schema";

/** How a provider failure should be handled: quota and auth stop the whole run, the others affect one task. */
export type ErrorKind = "quota" | "auth" | "transient" | "invalid";
const KINDS: readonly string[] = ["quota", "auth", "transient", "invalid"];

/** Quota errors say whether the daily or the per-minute allowance ran out. */
export type QuotaScope = "day" | "minute";

export class ProviderError extends Error {
  kind?: ErrorKind;
  scope?: QuotaScope;
  retryAfterSeconds?: number;
  /** Provider id such as "gemini", when the route names it. */
  provider?: string;
  constructor(message: string, kind?: unknown, extra: { scope?: unknown; retryAfterSeconds?: unknown; provider?: unknown } = {}) {
    super(message);
    this.name = "ProviderError";
    if (typeof kind === "string" && KINDS.includes(kind)) this.kind = kind as ErrorKind;
    if (extra.scope === "day" || extra.scope === "minute") this.scope = extra.scope;
    if (typeof extra.retryAfterSeconds === "number" && Number.isFinite(extra.retryAfterSeconds) && extra.retryAfterSeconds >= 0) this.retryAfterSeconds = Math.round(extra.retryAfterSeconds);
    if (typeof extra.provider === "string" && extra.provider.trim()) this.provider = extra.provider.trim().slice(0, 40);
  }
}

/** "quota (day, retry after 43200s)" for the event log; plain kind when there is no scope. */
export function failureLabel(error: unknown): string {
  if (!(error instanceof ProviderError) || !error.kind) return "error";
  const parts = [error.scope, error.retryAfterSeconds !== undefined ? `retry after ${error.retryAfterSeconds}s` : undefined].filter(Boolean);
  return parts.length ? `${error.kind} (${parts.join(", ")})` : error.kind;
}

/** Reads `kind` from any thrown value; undefined when the route did not send one. */
export const errorKind = (error: unknown): ErrorKind | undefined => (error instanceof ProviderError ? error.kind : undefined);
/** Quota and auth failures will not fix themselves on the next task, so the run stops. */
export const haltsRun = (error: unknown): boolean => ["quota", "auth"].includes(errorKind(error) ?? "");

/** Combines a timeout with the caller's Stop signal. */
export function requestSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([external, timeout]);
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  for (const signal of [external, timeout]) { if (signal.aborted) abort(signal); else signal.addEventListener("abort", () => abort(signal), { once: true }); }
  return controller.signal;
}

/** POST JSON to a model route. Failures carry the route's `kind` when present; a reply's `meta` is returned when present. */
export async function postModel(url: string, body: unknown, timeoutMs: number, signal?: AbortSignal, fallback = "Request failed. Try again."): Promise<{ result: Record<string, unknown>; meta?: ModelMeta }> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: requestSignal(timeoutMs, signal) });
  const result = await response.json();
  if (!response.ok) throw new ProviderError(typeof result?.error === "string" && result.error ? result.error : fallback, result?.kind, { scope: result?.scope, retryAfterSeconds: result?.retryAfterSeconds, provider: result?.provider });
  return { result, meta: normalizeMeta(result?.meta) };
}

export async function runLiveSpecialist(task: Task, context: ProjectContext, feedback = "", previousOutput?: AgentOutput, signal?: AbortSignal): Promise<{ output: AgentOutput; meta?: ModelMeta }> {
  // The evaluation log and usage totals are bookkeeping for the client; models never need them.
  const { events: _events, usage: _usage, ...slim } = context as ProjectContext & { events?: unknown; usage?: unknown };
  void _events; void _usage;
  const { result, meta } = await postModel("/api/specialist", { stage: "execute", taskId: task.id, context: slim, feedback, previousOutput }, 260000, signal, "Specialist request failed.");
  const raw = result.output as { retryCount?: number } | undefined;
  return { output: normalizeSpecialist(raw, task.id, raw?.retryCount === 1 ? 1 : 0), meta };
}

export async function runLiveReview(context: ProjectContext, signal?: AbortSignal) {
  const { events: _events, usage: _usage, ...slim } = context as ProjectContext & { events?: unknown; usage?: unknown };
  void _events; void _usage;
  const { result, meta } = await postModel("/api/specialist", { stage: "review", context: slim }, 260000, signal, "Specialist request failed.");
  const reviews = normalizeReviews(result, context.outputs);
  return { reviews, conflictSummary: reviews.flatMap((r) => [...r.conflicts, ...r.missingItems]).join("; ") || null, meta };
}
