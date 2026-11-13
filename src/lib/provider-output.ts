// Reply helpers shared by the planning routes: usage metadata and output-text extraction.
import type { LiveProvider } from './provider-errors';

/** Which provider/model answered and what it cost in tokens. Unknown numbers are omitted, never guessed. */
export type ProviderMeta = { provider: LiveProvider; model: string; latencyMs: number; promptTokens?: number; completionTokens?: number };
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined);
/** Reads chat-completions usage (prompt_tokens/completion_tokens) or Responses-API usage (input_tokens/output_tokens). */
export function readUsage(usage: unknown): { promptTokens?: number; completionTokens?: number } {
  if (!isRecord(usage)) return {};
  const promptTokens = count(usage.prompt_tokens ?? usage.input_tokens), completionTokens = count(usage.completion_tokens ?? usage.output_tokens);
  return { ...(promptTokens === undefined ? {} : { promptTokens }), ...(completionTokens === undefined ? {} : { completionTokens }) };
}
export function buildMeta(provider: LiveProvider, model: string, latencyMs: number, usage?: unknown): ProviderMeta {
  return { provider, model, latencyMs: Math.max(0, Math.round(latencyMs)), ...readUsage(usage) };
}
/** Text of a completed Responses-shaped reply (OpenAI native or normalized chat). Throws unless the reply finished cleanly. */
export function extractOutputText(data: unknown): string {
  if (!isRecord(data) || data.status !== 'completed') throw new Error('Incomplete response');
  return (Array.isArray(data.output) ? data.output : []).flatMap((item: unknown) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .filter((item: unknown): item is { type: string; text: string } => isRecord(item) && item.type === 'output_text' && typeof item.text === 'string').map((item) => item.text).join('');
}
