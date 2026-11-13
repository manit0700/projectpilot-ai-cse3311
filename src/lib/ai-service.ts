// Provider transport shared by the original planning workflow. Credentials stay server-side.
export function usesOpenRouter() {
  return process.env.AI_PROVIDER === 'openrouter' || (process.env.AI_PROVIDER !== 'openai' && Boolean(process.env.OPENROUTER_API_KEY?.trim()));
}
export function serviceKey() { return (usesOpenRouter() ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY)?.trim(); }
type StructuredBody = { instructions: string; input: string; max_output_tokens: number; text: { format: { type: string; name: string; strict: boolean; schema: unknown } }; [key: string]: unknown };
export async function structuredRequest(body: StructuredBody, key: string, role: 'MANAGER' | 'DEVELOPER' | 'REVIEWER', timeout: number) {
  if (!usesOpenRouter()) return fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body)
  });
  const model = process.env[`OPENROUTER_${role}_MODEL`]?.trim() || process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
  if (model !== 'openrouter/free' && !model.endsWith(':free')) throw new Error('Only free OpenRouter models are allowed');
  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'ProjectPilot AI' }, signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({ model, max_tokens: body.max_output_tokens, reasoning: process.env.OPENROUTER_REASONING === "off" ? { enabled: false } : { effort: "low", exclude: true },
      provider: { require_parameters: true, max_price: { prompt: 0, completion: 0 } },
      messages: [{ role: 'system', content: body.instructions }, { role: 'user', content: body.input }],
      response_format: { type: 'json_schema', json_schema: { name: body.text.format.name, strict: body.text.format.strict, schema: body.text.format.schema } }
    })
  });
  if (!upstream.ok) {
    const failure = await upstream.clone().json().catch(() => null);
    console.warn('Structured provider request rejected', upstream.status, model, typeof failure?.error?.message === 'string' ? failure.error.message.replace(/sk-[\w-]+/g, '[redacted]').slice(0, 200) : 'No detail');
    return upstream;
  }
  const result = await upstream.json();
  const choice = result.choices?.[0];
  console.info('Structured response status', role, result.model || model, choice?.finish_reason, typeof choice?.message?.content === 'string' ? choice.message.content.length : 0);
  // Preserve the established response validation and normalization in both routes.
  return Response.json({ status: choice?.finish_reason === 'stop' ? 'completed' : 'incomplete', output: [{ content: [{ type: 'output_text', text: choice?.message?.content || '' }] }] });
}
