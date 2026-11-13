// Provider selection, model lists, the shared deadline and the fall-through engine.
// Credentials stay server-side; nothing here returns upstream text.
import { activeCooldowns, clearCooldowns, cooldownFor, setCooldown } from './provider-cooldown';
import { classifyUpstream, failureMessage, isTimeout, redact, type FailureKind, type LiveProvider, type QuotaScope } from './provider-errors';
export { activeCooldowns, clearCooldowns };
export type { LiveProvider } from './provider-errors';
export type Role = 'MANAGER' | 'DEVELOPER' | 'REVIEWER';
export type StudioProvider = 'gemini' | 'openrouter';

// Tried in order. The newest models are often at capacity and old names get closed to new accounts, and free-tier
// quota is per model, so a busy, retired or exhausted model falls through to the next one.
export const DEFAULT_GEMINI_MODELS = 'gemini-3.6-flash,gemini-3-flash-preview,gemini-3.1-flash-lite';
const PROVIDERS: readonly LiveProvider[] = ['gemini', 'openrouter', 'openai'];
const KEY_VARS: Record<LiveProvider, string> = { gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY', openai: 'OPENAI_API_KEY' };

/** AI_PROVIDER wins when it names a provider; otherwise OpenRouter, then Gemini, then OpenAI by which key exists. */
export function activeProvider(): LiveProvider {
  const chosen = process.env.AI_PROVIDER?.trim();
  if (chosen === 'gemini' || chosen === 'openrouter' || chosen === 'openai') return chosen;
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter';
  if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
  return 'openai';
}
export function usesOpenRouter() { return activeProvider() === 'openrouter'; }
export function providerKey(provider: LiveProvider): string | undefined { return process.env[KEY_VARS[provider]]?.trim() || undefined; }
export function serviceKey() { return providerKey(activeProvider()); }
/** Shown when no key is configured for the active provider. */
export const MISSING_KEY_HELP = 'GEMINI_API_KEY (free Google AI Studio key), OPENROUTER_API_KEY (free models) or OPENAI_API_KEY';

/** AI_FALLBACK="openrouter,openai": only listed providers that have a key, in the listed order, never the primary itself. */
export function fallbackProviders(primary: LiveProvider, allowed: readonly LiveProvider[] = PROVIDERS): LiveProvider[] {
  const listed = (process.env.AI_FALLBACK ?? '').split(',').map((name) => name.trim().toLowerCase());
  const seen = new Set<LiveProvider>([primary]);
  const out: LiveProvider[] = [];
  for (const name of listed) {
    const provider = PROVIDERS.find((p) => p === name);
    if (!provider || seen.has(provider) || !allowed.includes(provider) || !providerKey(provider)) continue;
    seen.add(provider); out.push(provider);
  }
  return out;
}
/** Planning chain: primary first, then explicitly configured fallbacks. OpenAI joins only when AI_FALLBACK lists it. */
export function providerChain(): LiveProvider[] { const primary = activeProvider(); return [primary, ...fallbackProviders(primary)]; }

// Website Studio uses chat completions on Gemini or free-only OpenRouter. OpenAI has no chat path here and is never a Studio fallback.
export function studioProvider(): StudioProvider { return activeProvider() === 'gemini' ? 'gemini' : 'openrouter'; }
export function studioKey() { return providerKey(studioProvider()); }
export const providerLabel = (provider: StudioProvider) => (provider === 'gemini' ? 'Gemini' : 'OpenRouter');
export function studioChain(): StudioProvider[] { const primary = studioProvider(); return [primary, ...(fallbackProviders(primary, ['gemini', 'openrouter']) as StudioProvider[])]; }

export class ModelPolicyError extends Error { constructor() { super('Only free OpenRouter models are allowed'); this.name = 'ModelPolicyError'; } }
export type ResolvedModels = { models: string[]; effort: string };
/** Model list and reasoning effort for one provider and role. OpenRouter is guarded to free models and throws ModelPolicyError otherwise. */
export function resolveModels(provider: LiveProvider, role: Role): ResolvedModels {
  const env = process.env;
  if (provider === 'gemini') {
    // GEMINI_MODEL (or a per-role override) may be a comma-separated list. Thinking tokens share the output budget, so default to low effort.
    const models = (env[`GEMINI_${role}_MODEL`]?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODELS).split(',').map((m) => m.trim()).filter(Boolean);
    return { models, effort: env.GEMINI_REASONING_EFFORT?.trim() || 'low' };
  }
  if (provider === 'openrouter') {
    const model = env[`OPENROUTER_${role}_MODEL`]?.trim() || env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
    if (model !== 'openrouter/free' && !model.endsWith(':free')) throw new ModelPolicyError();
    return { models: [model], effort: env.OPENROUTER_REASONING === 'off' ? 'off' : 'low' };
  }
  return { models: [env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'], effort: 'off' };
}

// ---- One deadline shared by every model and provider attempt of a request ----
export type Budget = { deadlineAt: number; now: () => number };
export function createBudget(totalMs: number, now: () => number = Date.now): Budget { return { deadlineAt: now() + totalMs, now }; }
export const remainingMs = (budget: Budget) => Math.max(0, budget.deadlineAt - budget.now());
/** Time one attempt may use: a capped slice while other candidates remain, everything left for the last one. Never more than remains. */
export function attemptMs(budget: Budget, capMs: number, isLast: boolean): number { const left = remainingMs(budget); return isLast ? left : Math.min(capMs, left); }
// maxDuration is a literal in each route file, so the matching budgets live here and tests compare the two.
// Budgets leave headroom for response parsing and platform startup.
export const ROUTE_BUDGETS = {
  manager: { maxDurationSeconds: 60, budgetMs: 52000, attemptCapMs: 30000 },
  // The browser client gives up at 260 s, so the route finishes first: two 120 s attempts fit inside 250 s.
  specialist: { maxDurationSeconds: 300, budgetMs: 250000, attemptCapMs: 120000 },
  studio: { maxDurationSeconds: 120, budgetMs: 105000, attemptCapMs: 60000 }
} as const;
/** An attempt that follows a failure only starts when at least this much of the budget is left. */
export const MIN_ATTEMPT_MS = 5000;

export type Candidate = { provider: LiveProvider; model: string; send: (signal: AbortSignal) => Promise<Response> };
export type Tried = { provider: LiveProvider; model: string; status: number; kind: FailureKind };
export type ChainOk = { ok: true; response: Response; provider: LiveProvider; model: string; tried: Tried[] };
export type ChainFail = { ok: false; kind: FailureKind; status: number; provider: LiveProvider; model: string; message: string; tried: Tried[]; cancelled?: boolean; /** Quota failures only, when known. */ scope?: 'day' | 'minute'; retryAfterSeconds?: number };
export type ChainOptions = { attemptCapMs?: number; minAttemptMs?: number; signal?: AbortSignal; /** Waits between a short minute-quota failure and its one retry; injectable for tests. */ sleep?: (ms: number) => Promise<void> };
/** A minute-scope quota failure that clears within this many seconds is waited out and retried once on the same model. */
export const MAX_QUOTA_WAIT_SECONDS = 20;
type Failure = Tried & { scope: QuotaScope; retryAfterSeconds?: number };
const toTried = (failures: Failure[]): Tried[] => failures.map(({ provider, model, status, kind }) => ({ provider, model, status, kind }));

// Fixed-text failure for the headline provider. Quota beats transient so the actionable message is shown, and among quota failures the soonest to clear wins.
function headline(failures: Failure[], primary: LiveProvider, fallbacks: LiveProvider[], stopped?: Failure): ChainFail {
  const own = failures.filter((f) => f.provider === primary);
  const soonest = own.filter((f) => f.kind === 'quota').sort((a, b) => (a.retryAfterSeconds ?? Infinity) - (b.retryAfterSeconds ?? Infinity))[0];
  const pick = stopped ?? soonest ?? own.at(-1) ?? failures[0];
  const quota = pick.kind === 'quota';
  return { ok: false, kind: pick.kind, status: pick.status, provider: pick.provider, model: pick.model, tried: toTried(failures),
    ...(quota && pick.scope !== 'unknown' ? { scope: pick.scope } : {}), ...(quota && pick.retryAfterSeconds !== undefined ? { retryAfterSeconds: pick.retryAfterSeconds } : {}),
    message: failureMessage(pick.provider, pick.kind, { scope: pick.scope, retryAfterSeconds: pick.retryAfterSeconds, fallbacks: pick.provider === primary ? fallbacks : [] }) };
}
/** Bounded text of an upstream error body, used only for classification and a redacted log line. Quota bodies list several details, so allow room. */
async function failureDetail(response: Response): Promise<string> {
  try { return (await response.text()).slice(0, 6000); } catch { return ''; }
}
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Tries candidates in order inside one shared budget. quota and transient failures (429, 5xx, 404, timeouts, network)
 * move to the next model or provider; auth and invalid failures stop the chain because another provider cannot fix them.
 * A model that hit a quota is put on cooldown and skipped without a request until it frees up. A minute-scope quota
 * that clears within 20 s is waited out once (budget permitting) rather than failed.
 */
export async function runCandidates(candidates: Candidate[], budget: Budget, options: ChainOptions = {}): Promise<ChainOk | ChainFail> {
  const capMs = options.attemptCapMs ?? 30000, minMs = options.minAttemptMs ?? MIN_ATTEMPT_MS, sleep = options.sleep ?? defaultSleep;
  const providers = [...new Set(candidates.map((c) => c.provider))];
  const primary = providers[0], fallbacks = providers.slice(1);
  const failures: Failure[] = [];
  const timedOut = (candidate: Candidate): ChainFail => ({ ok: false, kind: 'transient', status: 504, provider: candidate.provider, model: candidate.model, tried: [], message: failureMessage(candidate.provider, 'transient', { fallbacks: candidate.provider === primary ? fallbacks : [] }) });
  const skip = (candidate: Candidate): boolean => {
    const cooling = cooldownFor(candidate.provider, candidate.model, budget.now());
    if (cooling) failures.push({ provider: candidate.provider, model: candidate.model, status: 429, kind: 'quota', scope: cooling.scope, retryAfterSeconds: cooling.remainingSeconds });
    return Boolean(cooling);
  };
  const active = candidates.filter((c) => !skip(c));
  if (!active.length) return failures.length ? headline(failures, primary, fallbacks) : timedOut(candidates[0]);
  // The persistent signal covers body reads too: it is the caller's (cancel + deadline) or one that fires at the shared deadline.
  const persistent = options.signal ?? AbortSignal.timeout(Math.max(1, remainingMs(budget)));
  let attempts = 0;
  outer: for (let i = 0; i < active.length; i++) {
    const candidate = active[i];
    let waited = false;
    while (true) {
      if (persistent.aborted) break outer;
      if (skip(candidate)) break;
      const left = remainingMs(budget);
      if (left <= 0 || (attempts > 0 && left < minMs)) break outer;
      attempts++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new DOMException('Attempt timed out', 'TimeoutError')), attemptMs(budget, capMs, i === active.length - 1));
      let response: Response | undefined, error: unknown;
      try { response = await candidate.send(AbortSignal.any([persistent, controller.signal])); } catch (caught) { error = caught; } finally { clearTimeout(timer); }
      if (response?.ok) return { ok: true, response, provider: candidate.provider, model: candidate.model, tried: toTried(failures) };
      if (response) {
        const detail = await failureDetail(response);
        const upstream = classifyUpstream(response.status, detail, { provider: candidate.provider, now: budget.now(), retryAfterHeader: response.headers.get('retry-after') });
        const { kind, scope, retryAfterSeconds } = upstream;
        console.warn('Provider attempt rejected', candidate.provider, candidate.model, response.status, kind, scope === 'unknown' ? '' : scope, redact(detail));
        // A short per-minute limit is cheaper to wait out than to fail.
        if (kind === 'quota' && scope === 'minute' && !waited && retryAfterSeconds !== undefined && retryAfterSeconds <= MAX_QUOTA_WAIT_SECONDS && remainingMs(budget) > retryAfterSeconds * 1000 + minMs) {
          waited = true;
          await sleep(retryAfterSeconds * 1000);
          continue;
        }
        const entry: Failure = { provider: candidate.provider, model: candidate.model, status: response.status, kind, scope, retryAfterSeconds };
        failures.push(entry);
        // Nothing is known about an unscoped 429 without a delay, so it does not block later calls.
        if (kind === 'quota' && (scope !== 'unknown' || retryAfterSeconds !== undefined)) setCooldown(candidate.provider, candidate.model, upstream.wide, scope, retryAfterSeconds, budget.now());
        // Another provider cannot fix a rejected key or request.
        if (kind === 'auth' || kind === 'invalid') return headline(failures, primary, fallbacks, entry);
        break;
      }
      // The caller cancelled (client left or deadline hit): no further attempts.
      if (options.signal?.aborted && !(error instanceof Error && error.name === 'TimeoutError')) return { ...timedOut(candidate), kind: 'transient', status: 499, cancelled: true };
      console.warn('Provider attempt failed', candidate.provider, candidate.model, error instanceof Error ? redact(`${error.name}: ${error.message}`) : 'unknown');
      failures.push({ provider: candidate.provider, model: candidate.model, status: isTimeout(error) ? 504 : 502, kind: 'transient', scope: 'unknown' });
      break;
    }
  }
  return failures.length ? headline(failures, primary, fallbacks) : timedOut(candidates[0]);
}
