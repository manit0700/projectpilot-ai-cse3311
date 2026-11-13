// Typed failure vocabulary shared by every JSON API route and the provider chain.
// Messages here are fixed strings: upstream error bodies and keys never reach a client.
export type LiveProvider = 'gemini' | 'openrouter' | 'openai';
/** quota: 429 / daily limit. auth: 401/403 or missing credentials. transient: 5xx, timeouts, network. invalid: bad request or unusable output. */
export type FailureKind = 'quota' | 'auth' | 'transient' | 'invalid';

export const PROVIDER_LABELS: Record<LiveProvider, string> = { gemini: 'Gemini', openrouter: 'OpenRouter', openai: 'OpenAI' };
export const providerName = (provider: LiveProvider) => PROVIDER_LABELS[provider];

export function kindForStatus(status: number): FailureKind {
  if (status === 429 || status === 402) return 'quota';
  if (status === 401 || status === 403) return 'auth';
  if (status >= 500 || status === 408 || status === 404) return 'transient';
  return 'invalid';
}
/** JSON error body: `error` is the human text, `kind` the machine-readable class. Extra fields never override either. */
export function failure(error: string, status: number, kind: FailureKind = kindForStatus(status), extra: Record<string, unknown> = {}, headers?: HeadersInit): Response {
  return Response.json({ ...extra, error, kind }, { status, headers });
}

export const redact = (message: string) => message.replace(/sk-[\w-]+|gh[oprsu]_\w+/g, '[redacted]').replace(/AIza[\w-]{20,}/g, '[redacted]').replace(/AQ\.[\w.-]{20,}/g, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 200);

export type QuotaScope = 'day' | 'minute' | 'unknown';
export type UpstreamClass = { kind: FailureKind; daily: boolean; scope: QuotaScope; retryAfterSeconds?: number; /** True when the limit covers the whole provider, not one model. */ wide: boolean };
const HOUR = 3600;
/** Seconds until the next midnight in a time zone (Gemini daily quotas reset at midnight Pacific, OpenRouter at UTC midnight). */
export function secondsToMidnight(nowMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(nowMs));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Math.max(60, 24 * HOUR - (part('hour') * HOUR + part('minute') * 60 + part('second')));
}
/**
 * Classifies a non-2xx provider reply from its status and a bounded text form of its error body. The text is only inspected, never returned.
 * For quota failures it also reads the scope (Gemini quotaId PerDay/PerMinute, OpenRouter free-models-per-day) and how long until the quota frees up.
 */
export function classifyUpstream(status: number, detail: string, options: { provider?: LiveProvider; now?: number; retryAfterHeader?: string | null } = {}): UpstreamClass {
  const none = { daily: false, scope: 'unknown' as QuotaScope, wide: false };
  if (status === 400 && /API key (not valid|expired|invalid)|API_KEY_INVALID/i.test(detail)) return { kind: 'auth', ...none };
  if (!(status === 429 || status === 402 || /RESOURCE_EXHAUSTED/.test(detail))) return { kind: kindForStatus(status), ...none };
  const now = options.now ?? Date.now();
  const ids = [...detail.matchAll(/quotaId\\?"?\s*[:=]\s*\\?"([^"\\]+)/g)].map((m) => m[1]);
  const idText = ids.join(' ');
  let scope: QuotaScope = /PerDay/i.test(idText) ? 'day' : /PerMinute/i.test(idText) ? 'minute' : 'unknown';
  if (scope === 'unknown') scope = /per ?day|daily|free-models-per-day/i.test(detail) ? 'day' : /per ?min|free-models-per-min/i.test(detail) ? 'minute' : 'unknown';
  let retryAfterSeconds: number | undefined;
  const delay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(detail) ?? /retry in (\d+(?:\.\d+)?)s/i.exec(detail);
  if (delay) retryAfterSeconds = Math.ceil(Number(delay[1]));
  const reset = /X-RateLimit-Reset"?\s*:\s*"?(\d{10,13})/i.exec(detail);
  if (retryAfterSeconds === undefined && reset) { const at = Number(reset[1]) * (reset[1].length <= 10 ? 1000 : 1); if (at > now) retryAfterSeconds = Math.ceil((at - now) / 1000); }
  const header = Number(options.retryAfterHeader);
  if (retryAfterSeconds === undefined && Number.isFinite(header) && header > 0) retryAfterSeconds = Math.ceil(header);
  if (retryAfterSeconds === undefined && scope === 'day' && options.provider) retryAfterSeconds = secondsToMidnight(now, options.provider === 'gemini' ? 'America/Los_Angeles' : 'UTC');
  const wide = options.provider === 'openrouter' || (scope === 'day' && ids.length > 0 && !/PerModel/i.test(idText));
  return { kind: 'quota', daily: scope === 'day', scope, retryAfterSeconds, wide };
}
/** "about 12 hours", "about 45 seconds": a rounded, human-readable wait. */
export function humanDuration(seconds: number): string {
  if (seconds < 90) return `about ${Math.max(1, Math.round(seconds))} second${Math.round(seconds) === 1 ? '' : 's'}`;
  if (seconds < 3570) return `about ${Math.round(seconds / 60)} minutes`;
  if (seconds < 36 * HOUR) return `about ${Math.round(seconds / HOUR)} hour${Math.round(seconds / HOUR) === 1 ? '' : 's'}`;
  return `about ${Math.round(seconds / (24 * HOUR))} days`;
}
/** Extra JSON fields for a quota failure: `scope` ('day' | 'minute') and `retryAfterSeconds`, each present only when known. */
export function quotaExtras(fail: { kind: FailureKind; scope?: 'day' | 'minute'; retryAfterSeconds?: number }): Record<string, unknown> {
  if (fail.kind !== 'quota') return {};
  return { ...(fail.scope ? { scope: fail.scope } : {}), ...(fail.retryAfterSeconds !== undefined ? { retryAfterSeconds: fail.retryAfterSeconds } : {}) };
}
/** Timeouts and network errors are transient; everything else thrown by fetch is too. */
export function isTimeout(error: unknown): boolean { return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'); }

/** Names the fallback situation for quota/transient messages. `fallbacks` are the configured providers after the primary. */
export function fallbackNote(fallbacks: LiveProvider[]): string {
  return fallbacks.length ? ` Fallback ${fallbacks.map(providerName).join(', ')} was also unavailable.` : ' Fallback provider not configured.';
}
export type MessageOptions = { daily?: boolean; scope?: QuotaScope; retryAfterSeconds?: number; fallbacks?: LiveProvider[] };
export function failureMessage(provider: LiveProvider, kind: FailureKind, options: MessageOptions = {}): string {
  const label = providerName(provider);
  const note = fallbackNote(options.fallbacks ?? []);
  const scope = options.scope ?? (options.daily ? 'day' : 'unknown');
  const wait = options.retryAfterSeconds !== undefined ? humanDuration(options.retryAfterSeconds) : undefined;
  if (kind === 'quota') {
    if (provider === 'gemini') {
      if (scope === 'day') return `Gemini free-tier daily quota is used up; it resets ${wait ? `in ${wait}` : 'daily'}.` + note;
      if (scope === 'minute') return `Gemini free-tier rate limit reached; retry in ${wait ?? 'a minute'}.` + note;
      return (wait ? `Gemini free-tier quota reached; retry in ${wait}.` : 'Gemini free-tier quota or rate limit reached; wait a minute and retry.') + note;
    }
    if (provider === 'openrouter') {
      if (scope === 'day') return `OpenRouter free-model daily limit reached; it resets ${wait ? `in ${wait}` : 'daily'}.` + note;
      if (scope === 'minute') return `OpenRouter free-model rate limit reached; retry in ${wait ?? 'a minute'}.` + note;
      return 'OpenRouter free-model limit reached (free models are rate limited and capped per day); retry later.' + note;
    }
    return 'OpenAI rate or billing limit reached. Check your OpenAI account and retry.' + note;
  }
  if (kind === 'auth') return `${label} rejected the server API key. Check the server configuration.`;
  if (kind === 'transient') return `${label} is unavailable or timed out. Your input is kept; retry.` + note;
  return `${label} rejected the request. Check the model setting and retry.`;
}
