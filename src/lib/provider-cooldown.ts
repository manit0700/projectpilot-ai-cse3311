// In-memory cooldowns after a quota failure, keyed by provider + model, so later calls skip an exhausted model
// instantly instead of burning a request on it. State lives in one server instance and resets on restart (LIMITATION:
// on a multi-instance host each instance learns separately, which costs at most one request per instance and model).
import type { LiveProvider, QuotaScope } from './provider-errors';

export const WHOLE_PROVIDER = '*';
const DAY_CAP_SECONDS = 24 * 3600, MINUTE_CAP_SECONDS = 90, UNKNOWN_FALLBACK_SECONDS = 60;
type Entry = { until: number; scope: QuotaScope };
const cooldowns = new Map<string, Entry>();
const keyOf = (provider: LiveProvider, model: string) => `${provider}|${model}`;

/** How long to stay away: the provider's own retry delay, capped at 24 h (day) or 90 s (minute); a short pause when it said nothing (callers skip the cooldown entirely for an unscoped 429 with no delay). */
export function cooldownSeconds(scope: QuotaScope, retryAfterSeconds?: number): number {
  if (scope === 'minute') return Math.min(retryAfterSeconds ?? UNKNOWN_FALLBACK_SECONDS, MINUTE_CAP_SECONDS);
  return Math.min(retryAfterSeconds ?? UNKNOWN_FALLBACK_SECONDS, DAY_CAP_SECONDS);
}
/** Records a quota failure. `wide` limits (whole project or account) cool every model of the provider. */
export function setCooldown(provider: LiveProvider, model: string, wide: boolean, scope: QuotaScope, retryAfterSeconds: number | undefined, now: number): number {
  const seconds = cooldownSeconds(scope, retryAfterSeconds);
  cooldowns.set(keyOf(provider, wide ? WHOLE_PROVIDER : model), { until: now + seconds * 1000, scope });
  return seconds;
}
/** The cooldown that applies to this model right now, with whole seconds left, or undefined. Expired entries are dropped. */
export function cooldownFor(provider: LiveProvider, model: string, now: number): { remainingSeconds: number; scope: QuotaScope } | undefined {
  let found: { remainingSeconds: number; scope: QuotaScope } | undefined;
  for (const key of [keyOf(provider, model), keyOf(provider, WHOLE_PROVIDER)]) {
    const entry = cooldowns.get(key);
    if (!entry) continue;
    if (entry.until <= now) { cooldowns.delete(key); continue; }
    const remainingSeconds = Math.ceil((entry.until - now) / 1000);
    if (!found || remainingSeconds > found.remainingSeconds) found = { remainingSeconds, scope: entry.scope };
  }
  return found;
}
/** Active cooldowns for the status endpoint. `model` is "*" when the whole provider is cooling. */
export function activeCooldowns(now: number = Date.now()): Array<{ provider: LiveProvider; model: string; untilSeconds: number }> {
  const out: Array<{ provider: LiveProvider; model: string; untilSeconds: number }> = [];
  for (const [key, entry] of [...cooldowns]) {
    if (entry.until <= now) { cooldowns.delete(key); continue; }
    const split = key.indexOf('|');
    out.push({ provider: key.slice(0, split) as LiveProvider, model: key.slice(split + 1), untilSeconds: Math.ceil((entry.until - now) / 1000) });
  }
  return out;
}
export function clearCooldowns() { cooldowns.clear(); }
