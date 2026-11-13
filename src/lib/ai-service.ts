// Provider transport shared by the planning workflow (manager, answers, specialists, review) and Website Studio.
// Credentials stay server-side. Three providers are supported:
//   gemini     Google Gemini API free tier, through Google's chat-completions compatible endpoint
//   openrouter free-only OpenRouter models (price capped at zero)
//   openai     OpenAI Responses API (paid, owner pays; used only when it is the primary or listed in AI_FALLBACK)
// Order, deadlines and fall-through rules live in provider-chain.ts; typed failures in provider-errors.ts.
import { activeCooldowns, activeProvider, createBudget, MISSING_KEY_HELP, ModelPolicyError, providerChain, providerLabel, serviceKey, studioKey, studioProvider, usesOpenRouter, providerKey, resolveModels, ROUTE_BUDGETS, runCandidates, studioChain, type Budget, type Candidate, type ChainFail, type ChainOptions, type Role, type StudioProvider, type Tried } from './provider-chain';
import { buildMeta, isRecord, type ProviderMeta } from './provider-output';
import { failureMessage, type LiveProvider } from './provider-errors';
// One import (not `export ... from`) so every re-export shares the module instance that holds the cooldown state.
export { activeCooldowns, activeProvider, createBudget, MISSING_KEY_HELP, ModelPolicyError, providerChain, providerLabel, serviceKey, studioChain, studioKey, studioProvider, usesOpenRouter };
export type { LiveProvider, StudioProvider } from './provider-chain';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/responses';

type StructuredBody = { instructions: string; input: string; max_output_tokens: number; text: { format: { type: string; name: string; strict: boolean; schema: unknown } }; [key: string]: unknown };

// Gemini accepts a subset of JSON Schema and rejects keywords it does not know, so strip the OpenAI-strict
// `additionalProperties` marker. Types, required, enum, items and min/max bounds all pass through unchanged.
export function geminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (schema && typeof schema === 'object') {
    return Object.fromEntries(Object.entries(schema as Record<string, unknown>).filter(([key]) => key !== 'additionalProperties').map(([key, value]) => [key, geminiSchema(value)]));
  }
  return schema;
}

const post = (url: string, key: string, body: unknown, signal: AbortSignal, extra: Record<string, string> = {}) =>
  fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra }, signal, body: JSON.stringify(body) });

function sendStructured(provider: LiveProvider, model: string, effort: string, body: StructuredBody, key: string, signal: AbortSignal): Promise<Response> {
  const { model: requested, ...rest } = body; void requested;
  if (provider === 'openai') return post(OPENAI_URL, key, { ...rest, model }, signal);
  const messages = [{ role: 'system', content: body.instructions }, { role: 'user', content: body.input }];
  const { name, strict, schema } = body.text.format;
  if (provider === 'gemini') {
    return post(GEMINI_URL, key, { model, max_tokens: body.max_output_tokens, ...(effort === 'off' ? {} : { reasoning_effort: effort }), messages,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema: geminiSchema(schema) } } }, signal);
  }
  return post(OPENROUTER_URL, key, { model, max_tokens: body.max_output_tokens, reasoning: effort === 'off' ? { enabled: false } : { effort: 'low', exclude: true },
    provider: { require_parameters: true, max_price: { prompt: 0, completion: 0 } }, messages, response_format: { type: 'json_schema', json_schema: { name, strict, schema } } }, signal, { 'X-OpenRouter-Title': 'ProjectPilot AI' });
}

// Converts a provider reply into the Responses-shaped object both routes validate. Upstream error bodies never get here.
async function readReply(provider: LiveProvider, role: Role, model: string, response: Response): Promise<{ data: unknown; model: string; usage: unknown }> {
  const result = await response.json();
  if (provider === 'openai') return { data: result, model: typeof result?.model === 'string' ? result.model : model, usage: result?.usage };
  const choice = result.choices?.[0];
  const actual = typeof result.model === 'string' && result.model ? result.model : model;
  console.info('Structured response status', role, actual, choice?.finish_reason, typeof choice?.message?.content === 'string' ? choice.message.content.length : 0);
  return { data: { status: choice?.finish_reason === 'stop' ? 'completed' : 'incomplete', output: [{ content: [{ type: 'output_text', text: choice?.message?.content || '' }] }] }, model: actual, usage: result.usage };
}

/** Candidates in chain order: every model of the primary, then each configured fallback. An unusable fallback is skipped; an unusable primary throws. */
function structuredCandidates(body: StructuredBody, role: Role, primaryKey?: string): Candidate[] {
  const out: Candidate[] = [];
  providerChain().forEach((provider, index) => {
    const key = (index === 0 ? primaryKey : undefined) || providerKey(provider);
    if (!key) return;
    let resolved;
    try { resolved = resolveModels(provider, role); } catch (error) { if (index === 0) throw error; return; }
    for (const model of resolved.models) out.push({ provider, model, send: (signal) => sendStructured(provider, model, resolved.effort, body, key, signal) });
  });
  return out;
}
const noKey = (provider: LiveProvider): ChainFail => ({ ok: false, kind: 'auth', status: 503, provider, model: '', tried: [], message: failureMessage(provider, 'auth') });

export type StructuredOk = { ok: true; data: unknown; meta: ProviderMeta };
/** One structured completion across the provider chain inside a single shared deadline (a Budget, or a total in milliseconds). */
export async function structuredCall(body: StructuredBody, role: Role, timeout: number | Budget, options: ChainOptions & { key?: string } = {}): Promise<StructuredOk | ChainFail> {
  const budget = typeof timeout === 'number' ? createBudget(timeout) : timeout;
  const started = budget.now();
  const candidates = structuredCandidates(body, role, options.key);
  if (!candidates.length) return noKey(providerChain()[0]);
  const outcome = await runCandidates(candidates, budget, options);
  if (!outcome.ok) return outcome;
  try {
    const reply = await readReply(outcome.provider, role, outcome.model, outcome.response);
    return { ok: true, data: reply.data, meta: buildMeta(outcome.provider, reply.model, budget.now() - started, reply.usage) };
  } catch (error) {
    console.warn('Provider reply could not be read', outcome.provider, error instanceof Error ? error.name : 'unknown');
    return { ok: false, kind: 'transient', status: 502, provider: outcome.provider, model: outcome.model, tried: outcome.tried, message: failureMessage(outcome.provider, 'transient') };
  }
}
/** Compatibility wrapper: a Responses-shaped Response (with `meta`) on success, a non-OK Response on failure. Throws for a paid OpenRouter model. */
export async function structuredRequest(body: StructuredBody, key: string, role: Role, timeout: number | Budget) {
  const outcome = await structuredCall(body, role, timeout, { key });
  if (outcome.ok) return Response.json({ ...(isRecord(outcome.data) ? outcome.data : {}), meta: outcome.meta });
  return Response.json({ error: { message: outcome.message }, kind: outcome.kind }, { status: outcome.status >= 400 ? outcome.status : 502 });
}

// ---- Website Studio: streaming chat completions on the same providers ----
type ChatInput = { role: Role; system: string; user: string; maxTokens: number; stream: boolean; schema?: { name: string; schema: unknown }; signal: AbortSignal; budgetMs?: number; attemptCapMs?: number; now?: () => number };
export type ChatResult = { response: Response; model: string; provider: StudioProvider; tried: Tried[] } | { rejection: { status: number; error: string } } | { failure: ChainFail };

function sendChat(provider: StudioProvider, model: string, effort: string, input: ChatInput, key: string, signal: AbortSignal): Promise<Response> {
  const messages = [{ role: 'system', content: input.system }, { role: 'user', content: input.user }];
  if (provider === 'gemini') {
    return post(GEMINI_URL, key, { model, max_tokens: input.maxTokens, stream: input.stream, ...(input.stream ? { stream_options: { include_usage: true } } : {}), ...(effort === 'off' ? {} : { reasoning_effort: effort }), messages,
      ...(input.schema ? { response_format: { type: 'json_schema', json_schema: { name: input.schema.name, strict: true, schema: geminiSchema(input.schema.schema) } } } : {}) }, signal);
  }
  return post(OPENROUTER_URL, key, { model, max_tokens: input.maxTokens, stream: input.stream, reasoning: effort === 'off' ? { enabled: false } : { effort: 'low', exclude: true },
    ...(input.schema ? { response_format: { type: 'json_schema', json_schema: { name: input.schema.name, strict: true, schema: input.schema.schema } } } : {}),
    provider: { max_price: { prompt: 0, completion: 0 } }, messages }, signal, { 'X-OpenRouter-Title': 'ProjectPilot AI' });
}

/** Returns the raw upstream chat response (streamed or not) so the route can relay it, a typed failure, or a rejection before any request is sent. Never uses OpenAI. */
export async function chatCompletion(input: ChatInput, key?: string): Promise<ChatResult> {
  const candidates: Candidate[] = [];
  for (const [index, provider] of studioChain().entries()) {
    const providerSecret = (index === 0 ? key : undefined) || providerKey(provider);
    if (!providerSecret) continue;
    let resolved;
    try { resolved = resolveModels(provider, input.role); } catch (error) {
      if (index > 0) continue;
      if (error instanceof ModelPolicyError) return { rejection: { status: 400, error: 'Website Studio allows only openrouter/free or :free models. Paid fallback is disabled.' } };
      throw error;
    }
    for (const model of resolved.models) candidates.push({ provider, model, send: (signal) => sendChat(provider, model, resolved.effort, input, providerSecret, signal) });
  }
  if (!candidates.length) return { failure: noKey(studioChain()[0]) };
  const budget = createBudget(input.budgetMs ?? ROUTE_BUDGETS.studio.budgetMs, input.now);
  const outcome = await runCandidates(candidates, budget, { attemptCapMs: input.attemptCapMs ?? ROUTE_BUDGETS.studio.attemptCapMs, signal: input.signal });
  if (!outcome.ok) return { failure: outcome };
  return { response: outcome.response, model: outcome.model, provider: outcome.provider as StudioProvider, tried: outcome.tried };
}
