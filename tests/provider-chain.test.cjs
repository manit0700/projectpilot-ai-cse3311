/* eslint-disable @typescript-eslint/no-require-imports -- Node tests transpile the real TypeScript modules. */
// Run with: node --test tests/provider-chain.test.cjs
// Provider chain order, fall-through rules, shared deadline, typed failures and usage metadata.
// Every provider is a stub; nothing here reaches the network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative, overrides = {}, env = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const req = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides, env);
    if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), overrides, env);
    return require(name);
  };
  new Function('require', 'module', 'exports', 'process', 'fetch', output)(req, mod, mod.exports, { env }, overrides.fetch || global.fetch);
  return mod.exports;
}
const unlocked = { '@/lib/live-access': { requireLiveAccess: () => null } };
const MANAGER = 'src/app/api/manager/route.ts', SPECIALIST = 'src/app/api/specialist/route.ts', STUDIO = 'src/app/api/studio/route.ts';
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const post = (route, body, headers = { origin: 'http://localhost' }) => new Request(`http://localhost/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
function provider(...queue) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined }); const next = queue.length > 1 ? queue.shift() : queue[0]; return next(url, init); };
  return { fetch, calls };
}
const chat = (payload, usage, model = 'served-model') => () => Response.json({ model, ...(usage ? { usage } : {}), choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] });
const failing = (status, error = { message: 'upstream-secret-detail' }) => () => Response.json({ error }, { status });
const timeoutError = () => { throw new DOMException('timed out', 'TimeoutError'); };
const names = (calls) => calls.map((c) => (c.url.includes('googleapis') ? 'gemini' : c.url.includes('openrouter') ? 'openrouter' : 'openai'));

const project = { id: 'p1', title: 'Study tracker', description: 'A browser-local study-session tracker for one student.', targetUser: 'Students', approvedSummary: '', status: 'agents_running', createdAt: '2026-01-01T00:00:00.000Z' };
const managerBody = { stage: 'questions', context: { project: { id: 'p1', description: 'A browser-local study-session tracker.' } } };
const managerItems = { items: [{ prompt: 'Which fields does a session store?', why: 'Defines the record shape.' }] };
const task = { id: 't1', projectId: 'p1', title: 'Build tracker UI', description: 'Implement the session form, list and total.', ownerAgent: 'frontend', dependencies: [], expectedOutput: 'HTML, CSS and JavaScript', constraints: 'No libraries', state: 'in_progress', order: 1 };
const context = { project, requirements: [{ id: 'r1', projectId: 'p1', text: 'Add study sessions.', priority: 'must', approvalStatus: 'approved' }], planApproved: true, tasks: [task], outputs: [] };
const specialistBody = { stage: 'execute', taskId: 't1', context };
const specialistOutput = { summary: 'Session form with validation and a running total.', assumptions: [], blockers: [], confidence: 0.8, nextSteps: [] };
const gemini = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'AIzaTestKeyTestKeyTestKeyTestKey123', GEMINI_MODEL: 'model-a,model-b' };
const all = { ...gemini, OPENROUTER_API_KEY: 'router-key', OPENAI_API_KEY: 'openai-key' };

test('chain order: primary first, fallbacks only from AI_FALLBACK, only with keys, never duplicated', () => {
  const chain = (env, fn = 'providerChain') => load('src/lib/provider-chain.ts', {}, env)[fn]();
  assert.deepEqual(chain(all), ['gemini'], 'no AI_FALLBACK means no provider fallback, even with every key present');
  assert.deepEqual(chain({ ...all, AI_FALLBACK: 'openrouter,openai' }), ['gemini', 'openrouter', 'openai']);
  assert.deepEqual(chain({ ...all, AI_FALLBACK: ' OpenAI , gemini, openrouter, openai, bogus' }), ['gemini', 'openai', 'openrouter'], 'trimmed, case-insensitive, deduplicated, primary skipped');
  assert.deepEqual(chain({ ...gemini, OPENAI_API_KEY: 'k', AI_FALLBACK: 'openrouter,openai' }), ['gemini', 'openai'], 'a listed provider without a key is dropped');
  assert.deepEqual(chain({ ...all, AI_PROVIDER: 'openai', AI_FALLBACK: 'gemini' }), ['openai', 'gemini']);
  assert.deepEqual(chain({ ...all, AI_FALLBACK: 'openrouter,openai' }, 'studioChain'), ['gemini', 'openrouter'], 'Studio never uses OpenAI');
  assert.deepEqual(chain({ ...all, AI_PROVIDER: 'openai', AI_FALLBACK: 'gemini,openrouter' }, 'studioChain'), ['openrouter', 'gemini'], 'an OpenAI primary maps Studio to OpenRouter');
});
test('resolveModels: Gemini list and effort, free-only OpenRouter, per-role overrides', () => {
  const { resolveModels, ModelPolicyError } = load('src/lib/provider-chain.ts', {}, { GEMINI_MODEL: 'a, b', GEMINI_REVIEWER_MODEL: 'r', GEMINI_REASONING_EFFORT: 'off', OPENROUTER_DEVELOPER_MODEL: 'vendor/x:free', OPENROUTER_MANAGER_MODEL: 'paid/model' });
  assert.deepEqual(resolveModels('gemini', 'MANAGER'), { models: ['a', 'b'], effort: 'off' });
  assert.deepEqual(resolveModels('gemini', 'REVIEWER').models, ['r']);
  assert.deepEqual(resolveModels('openrouter', 'DEVELOPER').models, ['vendor/x:free']);
  assert.throws(() => resolveModels('openrouter', 'MANAGER'), ModelPolicyError);
  assert.deepEqual(resolveModels('openrouter', 'REVIEWER').models, ['openrouter/free']);
  assert.deepEqual(resolveModels('openai', 'MANAGER').models, ['gpt-4o-mini']);
});

test('quota on the primary falls to a listed fallback and the answering provider is reported', async () => {
  const stub = provider(failing(429, { message: 'x', status: 'RESOURCE_EXHAUSTED' }), failing(503), chat(managerItems, { prompt_tokens: 40, completion_tokens: 12 }, 'routed:free'));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { ...all, AI_FALLBACK: 'openrouter' });
  const response = await POST(post('manager', managerBody));
  assert.equal(response.status, 200);
  assert.deepEqual(names(stub.calls), ['gemini', 'gemini', 'openrouter'], 'both Gemini models first, then the fallback');
  const body = await response.json();
  assert.deepEqual(Object.keys(body.meta).sort(), ['completionTokens', 'latencyMs', 'model', 'promptTokens', 'provider']);
  assert.equal(body.meta.provider, 'openrouter'); assert.equal(body.meta.model, 'routed:free'); assert.equal(body.meta.promptTokens, 40); assert.equal(body.meta.completionTokens, 12);
  assert(Number.isInteger(body.meta.latencyMs) && body.meta.latencyMs >= 0);
});
test('auth and invalid-request failures never fall back to another provider', async () => {
  for (const status of [400, 401, 403, 422]) {
    const stub = provider(failing(status), chat(managerItems));
    const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { ...all, AI_FALLBACK: 'openrouter,openai' });
    const response = await POST(post('manager', managerBody));
    assert.equal(response.status, 502); assert.equal(stub.calls.length, 1, `status ${status} stops the chain`);
    assert.equal((await response.json()).kind, status === 401 || status === 403 ? 'auth' : 'invalid');
  }
  const keyInvalid = provider(failing(400, { message: 'API key not valid. Please pass a valid API key.' }), chat(managerItems));
  const body = await (await load(MANAGER, { ...unlocked, fetch: keyInvalid.fetch }, { ...all, AI_FALLBACK: 'openrouter' }).POST(post('manager', managerBody))).json();
  assert.equal(body.kind, 'auth', 'Google reports a bad key as 400');
  assert.equal(keyInvalid.calls.length, 1);
});
test('OpenAI is used as a fallback only when AI_FALLBACK lists it', async () => {
  const openaiReply = () => Response.json({ status: 'completed', model: 'gpt-x', usage: { input_tokens: 7, output_tokens: 3 }, output: [{ content: [{ type: 'output_text', text: JSON.stringify(managerItems) }] }] });
  const without = provider(failing(503));
  const refused = await load(MANAGER, { ...unlocked, fetch: without.fetch }, { ...all, AI_FALLBACK: 'openrouter' }).POST(post('manager', managerBody));
  assert.equal(refused.status, 502); assert(!names(without.calls).includes('openai'), 'a configured OpenAI key alone never gets used');
  const stub = provider(failing(429), failing(429), (url) => (url === OPENAI_URL ? openaiReply() : Response.json({})));
  const response = await load(MANAGER, { ...unlocked, fetch: stub.fetch }, { ...all, AI_FALLBACK: 'openai' }).POST(post('manager', managerBody));
  assert.equal(response.status, 200); assert.equal(stub.calls.at(-1).url, OPENAI_URL);
  const { meta } = await response.json();
  assert.deepEqual({ provider: meta.provider, model: meta.model, promptTokens: meta.promptTokens, completionTokens: meta.completionTokens }, { provider: 'openai', model: 'gpt-x', promptTokens: 7, completionTokens: 3 });
  assert.equal(stub.calls.at(-1).body.store, false);
});
test('meta omits token counts the provider did not report', async () => {
  const stub = provider(chat(managerItems));
  const { meta } = await (await load(MANAGER, { ...unlocked, fetch: stub.fetch }, gemini).POST(post('manager', managerBody))).json();
  assert.deepEqual(Object.keys(meta).sort(), ['latencyMs', 'model', 'provider']);
  assert.equal(meta.provider, 'gemini'); assert.equal(meta.model, 'served-model');
  const partial = provider(chat(managerItems, { prompt_tokens: 9 }));
  const second = await (await load(MANAGER, { ...unlocked, fetch: partial.fetch }, gemini).POST(post('manager', managerBody))).json();
  assert.equal(second.meta.promptTokens, 9); assert(!('completionTokens' in second.meta));
  const specialist = await (await load(SPECIALIST, { ...unlocked, fetch: provider(chat(specialistOutput, { prompt_tokens: 5, completion_tokens: 6 })).fetch }, gemini).POST(post('specialist', specialistBody))).json();
  assert.equal(specialist.output.summary, specialistOutput.summary); assert.equal(specialist.meta.completionTokens, 6);
});

test('typed kinds per status, with provider-specific quota text and no upstream leakage', async () => {
  const kinds = { 401: 'auth', 403: 'auth', 429: 'quota', 500: 'transient', 503: 'transient', 400: 'invalid' };
  for (const route of ['manager', 'specialist']) for (const [status, kind] of Object.entries(kinds)) {
    const stub = provider(failing(Number(status)));
    const { POST } = load(route === 'manager' ? MANAGER : SPECIALIST, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'sk-test-key' });
    const response = await POST(post(route, route === 'manager' ? managerBody : specialistBody));
    const text = await response.text(); const body = JSON.parse(text);
    assert.equal(response.status, 502); assert.equal(body.kind, kind, `${route} ${status}`);
    assert(!text.includes('upstream-secret-detail') && !text.includes('sk-test-key'));
  }
  const daily = provider(failing(429, { message: 'Quota exceeded for metric GenerateRequestsPerDayPerProjectPerModel-FreeTier', status: 'RESOURCE_EXHAUSTED' }));
  const dailyBody = await (await load(MANAGER, { ...unlocked, fetch: daily.fetch }, gemini).POST(post('manager', managerBody))).json();
  assert.match(dailyBody.error, /^Gemini free-tier daily quota is used up; it resets in about \d+ (hours?|minutes|seconds?)\. Fallback provider not configured\.$/);
  assert.equal(dailyBody.scope, 'day'); assert(dailyBody.retryAfterSeconds > 0 && dailyBody.retryAfterSeconds <= 86400);
  assert.equal(dailyBody.kind, 'quota'); assert.equal(daily.calls.length, 2, 'each Gemini model is tried');
  const withFallback = provider(failing(429), failing(429), failing(429));
  const noted = await (await load(MANAGER, { ...unlocked, fetch: withFallback.fetch }, { ...all, AI_FALLBACK: 'openrouter' }).POST(post('manager', managerBody))).json();
  assert.match(noted.error, /Gemini free-tier .*quota/); assert.match(noted.error, /Fallback OpenRouter was also unavailable/);
  const router = provider(failing(429));
  const routerBody = await (await load(MANAGER, { ...unlocked, fetch: router.fetch }, { OPENROUTER_API_KEY: 'router-key' }).POST(post('manager', managerBody))).json();
  assert.match(routerBody.error, /^OpenRouter free-model limit reached/);
});
test('every non-200 JSON body from the planner and studio routes carries a kind', async () => {
  const live = load('src/lib/live-access.ts', {}, { LIVE_ACCESS_CODE: 'a-long-enough-private-code-1' });
  const guards = { '@/lib/live-access': live };
  const stub = provider(chat(managerItems));
  const expectKind = async (response, status, kind) => { assert.equal(response.status, status); const body = await response.json(); assert.equal(body.kind, kind, `status ${status}`); assert.equal(typeof body.error, 'string'); };
  const manager = load(MANAGER, { ...guards, fetch: stub.fetch }, { OPENAI_API_KEY: 'k', LIVE_ACCESS_CODE: 'a-long-enough-private-code-1' });
  await expectKind(await manager.POST(post('manager', managerBody)), 401, 'auth');
  const open = (route, env = { OPENAI_API_KEY: 'k' }) => load(route, { ...unlocked, fetch: stub.fetch }, env);
  await expectKind(await open(MANAGER).POST(post('manager', '{nope')), 400, 'invalid');
  await expectKind(await open(MANAGER).POST(post('manager', { stage: 'x'.repeat(61000) })), 413, 'invalid');
  await expectKind(await open(MANAGER).POST(post('manager', managerBody, { origin: 'http://evil.example' })), 403, 'auth');
  await expectKind(await open(MANAGER, {}).POST(post('manager', managerBody)), 503, 'auth');
  await expectKind(await open(SPECIALIST).POST(post('specialist', { stage: 'execute' })), 400, 'invalid');
  await expectKind(await open(SPECIALIST, {}).POST(post('specialist', specialistBody)), 503, 'auth');
  const studio = { stage: 'plan', brief: 'Build a student portfolio', plan: '', feedback: '' };
  await expectKind(await open(STUDIO, { OPENROUTER_API_KEY: 'k' }).POST(post('studio', { ...studio, stage: 'nope' })), 400, 'invalid');
  await expectKind(await open(STUDIO, {}).POST(post('studio', studio)), 503, 'auth');
  const down = load(STUDIO, { ...unlocked, fetch: provider(failing(500)).fetch }, { OPENROUTER_API_KEY: 'k' });
  await expectKind(await down.POST(post('studio', studio)), 502, 'transient');
  const garbled = load(STUDIO, { ...unlocked, fetch: provider(() => Response.json({ choices: [{ finish_reason: 'length', message: { content: 'x' } }] })).fetch }, { OPENROUTER_API_KEY: 'k' });
  await expectKind(await garbled.POST(post('studio', studio)), 502, 'invalid');
});

test('shared deadline: one budget covers every model; attempts stop when too little remains', async () => {
  const { createBudget, remainingMs, attemptMs, ROUTE_BUDGETS } = load('src/lib/provider-chain.ts');
  let clock = 1000; const now = () => clock;
  const budget = createBudget(20000, now);
  assert.equal(remainingMs(budget), 20000); clock += 12000;
  assert.equal(remainingMs(budget), 8000);
  assert.equal(attemptMs(budget, 30000, false), 8000, 'a capped slice never exceeds what remains');
  assert.equal(attemptMs(budget, 5000, false), 5000); assert.equal(attemptMs(budget, 5000, true), 8000, 'the last candidate gets everything left');
  clock += 99999; assert.equal(remainingMs(budget), 0);
  for (const [route, key] of [['manager', 'manager'], ['specialist', 'specialist'], ['studio', 'studio']]) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', `src/app/api/${route}/route.ts`), 'utf8');
    const seconds = Number(/export const maxDuration = (\d+)/.exec(source)[1]);
    assert.equal(seconds, ROUTE_BUDGETS[key].maxDurationSeconds, `${route} route limit matches ROUTE_BUDGETS`);
    assert(ROUTE_BUDGETS[key].budgetMs <= seconds * 1000 - 5000, `${route} budget leaves headroom`);
  }
  assert(2 * ROUTE_BUDGETS.specialist.attemptCapMs <= ROUTE_BUDGETS.specialist.budgetMs, 'two specialist attempts fit');
  assert(ROUTE_BUDGETS.specialist.budgetMs < 260000, 'the route answers before the browser gives up at 260 s');
});
test('shared deadline: timeouts fall through while budget remains, then the call fails cleanly', async () => {
  const { createBudget } = load('src/lib/provider-chain.ts');
  let clock = 0; const now = () => clock;
  const advancing = (ms) => () => { clock += ms; return timeoutError(); };
  const stub = provider(advancing(12000));
  const service = load('src/lib/ai-service.ts', { fetch: stub.fetch }, { ...gemini, GEMINI_MODEL: 'a,b,c,d' });
  const body = { instructions: 'Plan', input: '{}', max_output_tokens: 100, text: { format: { type: 'json_schema', name: 'x', strict: true, schema: { type: 'object' } } } };
  const outcome = await service.structuredCall(body, 'MANAGER', createBudget(30000, now), { minAttemptMs: 5000 });
  assert.equal(outcome.ok, false); assert.equal(outcome.kind, 'transient'); assert.match(outcome.message, /timed out/);
  assert.equal(stub.calls.length, 3, '12 s + 12 s leaves 6 s for a third attempt; after that the budget is spent');
  assert.deepEqual(stub.calls.map((c) => c.body.model), ['a', 'b', 'c']);
  clock = 0; const tight = provider(advancing(12000));
  const second = await load('src/lib/ai-service.ts', { fetch: tight.fetch }, { ...gemini, GEMINI_MODEL: 'a,b,c,d' }).structuredCall(body, 'MANAGER', createBudget(16000, now), { minAttemptMs: 5000 });
  assert.equal(second.ok, false); assert.equal(tight.calls.length, 1, 'only 4 s remain after the first timeout, below the 5 s minimum');
});
test('shared deadline: a hanging attempt is cut at its slice so the next model still runs', async () => {
  const hang = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  const stub = provider(hang, chat(managerItems));
  const service = load('src/lib/ai-service.ts', { fetch: stub.fetch }, { ...gemini, GEMINI_MODEL: 'slow,fast' });
  const body = { instructions: 'Plan', input: '{}', max_output_tokens: 100, text: { format: { type: 'json_schema', name: 'x', strict: true, schema: { type: 'object' } } } };
  const started = Date.now();
  const outcome = await service.structuredCall(body, 'MANAGER', 10000, { attemptCapMs: 60, minAttemptMs: 10 });
  assert.equal(outcome.ok, true); assert.equal(outcome.meta.model, 'served-model'); assert(Date.now() - started < 3000);
  assert.deepEqual(stub.calls.map((c) => c.body.model), ['slow', 'fast']);
});
test('specialist retries share one budget instead of restarting the clock', async () => {
  const stub = provider(failing(503));
  const { POST } = load(SPECIALIST, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'k' });
  const response = await POST(post('specialist', specialistBody));
  assert.equal(response.status, 502); assert.equal(stub.calls.length, 2); assert.equal((await response.json()).kind, 'transient');
});

test('planner limiter: per-IP window, PLANNER_RATE_LIMIT override, quota kind and Retry-After', async () => {
  const stub = provider(chat(managerItems));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { ...gemini, PLANNER_RATE_LIMIT: '2' });
  const as = (ip) => post('manager', managerBody, { origin: 'http://localhost', 'x-forwarded-for': ip });
  assert.equal((await POST(as('1.1.1.1'))).status, 200); assert.equal((await POST(as('1.1.1.1'))).status, 200);
  const limited = await POST(as('1.1.1.1'));
  assert.equal(limited.status, 429); assert((await limited.json()).kind === 'quota'); assert(Number(limited.headers.get('retry-after')) >= 1);
  assert.equal((await POST(as('2.2.2.2'))).status, 200, 'another client is unaffected');
  const specialist = load(SPECIALIST, { ...unlocked, fetch: provider(chat(specialistOutput)).fetch }, { ...gemini, PLANNER_RATE_LIMIT: '1' });
  assert.equal((await specialist.POST(post('specialist', specialistBody))).status, 200);
  assert.equal((await specialist.POST(post('specialist', specialistBody))).status, 429);
  const { plannerLimiter } = load('src/lib/rate-limit.ts', {}, {});
  for (let i = 0; i < 60; i++) assert(plannerLimiter.check('k').allowed); assert(!plannerLimiter.check('k').allowed, 'default is 60 per window');
});
test('planner origin policy: foreign origins refused, missing Origin required only in production', async () => {
  const stub = provider(chat(managerItems), chat(specialistOutput));
  const noOrigin = (route, body) => post(route, body, {});
  for (const [route, file, body] of [['manager', MANAGER, managerBody], ['specialist', SPECIALIST, specialistBody]]) {
    const dev = load(file, { ...unlocked, fetch: provider(chat(route === 'manager' ? managerItems : specialistOutput)).fetch }, gemini);
    assert.equal((await dev.POST(noOrigin(route, body))).status, 200, `${route}: no Origin outside production`);
    assert.equal((await dev.POST(post(route, body, { origin: 'http://localhost:9' }))).status, 403, `${route}: wrong port`);
    assert.equal((await dev.POST(post(route, body, { origin: 'https://evil.example' }))).status, 403);
    const prod = load(file, { ...unlocked, fetch: stub.fetch }, { ...gemini, NODE_ENV: 'production' });
    const refused = await prod.POST(noOrigin(route, body));
    assert.equal(refused.status, 403); assert.equal((await refused.json()).kind, 'auth');
    assert.equal((await prod.POST(post(route, body, { origin: 'http://localhost' }))).status, 200, `${route}: a matching Origin passes in production`);
  }
});

test('requirements schema requires acceptance; the normalizer defaults a missing list and validates a present one', () => {
  const { managerSchema, normalizeManagerItems, sanitizeProject } = load('src/lib/manager-schema.ts', { './types': {}, './workflow': { validateTasks: () => null } });
  const row = managerSchema('requirements').properties.items.items;
  assert(row.required.includes('acceptance')); assert.equal(row.properties.acceptance.type, 'array');
  assert.equal(row.properties.acceptance.minItems, 1); assert.equal(row.properties.acceptance.maxItems, 4); assert.equal(row.additionalProperties, false);
  const base = { text: 'Students can add a study session.', priority: 'must' };
  assert.deepEqual(normalizeManagerItems('requirements', [base], 'p')[0].acceptance, [], 'missing acceptance defaults to none');
  const ok = normalizeManagerItems('requirements', [{ ...base, acceptance: ['  Given a form, when I submit minutes, then the total updates.  '] }], 'p')[0];
  assert.deepEqual(ok.acceptance, ['Given a form, when I submit minutes, then the total updates.']);
  for (const acceptance of [['short'], 'not a list', [42], ['Given a valid form when sent then it saves.', '', 'x'.repeat(14), 'y'.repeat(14), 'z'.repeat(14)]]) assert.throws(() => normalizeManagerItems('requirements', [{ ...base, acceptance }], 'p'), /acceptance/i);
  assert('acceptance' in managerSchema('questions').properties.items.items.properties === false);
  assert.deepEqual(sanitizeProject({ id: 'p', status: 'x', evil: 'y', description: 'd' }).project, { id: 'p', description: 'd' });
});
test('manager forwards rubric and constitution, strips unknown fields and caps both at 4,000 characters', async () => {
  const stub = provider(chat(managerItems));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, gemini);
  const withProject = (extra) => ({ stage: 'questions', context: { project: { ...managerBody.context.project, ...extra }, leaked: 'drop me' } });
  const response = await POST(post('manager', withProject({ rubric: 'R'.repeat(4000), constitution: ' Use Next.js only. ', status: 'agents_running', secret: 'drop me too' })));
  assert.equal(response.status, 200);
  const sent = stub.calls[0].body;
  const input = JSON.parse(sent.messages[1].content);
  assert.equal(input.project.rubric.length, 4000); assert.equal(input.project.constitution, 'Use Next.js only.');
  assert(!JSON.stringify(input).includes('drop me') && !('status' in input.project), 'unknown fields are stripped');
  assert.match(sent.messages[0].content, /project\.rubric/); assert.match(sent.messages[0].content, /project\.constitution/); assert.match(sent.messages[0].content, /untrusted/);
  assert.match(sent.messages[0].content, /Given\/When\/Then/);
  const before = stub.calls.length;
  for (const bad of [{ rubric: 'R'.repeat(4001) }, { constitution: 'C'.repeat(4001) }, { rubric: 12 }, { constitution: ['x'] }]) {
    const rejected = await POST(post('manager', withProject(bad)));
    assert.equal(rejected.status, 400); assert.equal((await rejected.json()).kind, 'invalid');
  }
  assert.equal(stub.calls.length, before, 'oversized standing text never reaches the provider');
});
test('specialist forwards rubric and constitution and rejects oversized ones', async () => {
  const stub = provider(chat(specialistOutput), chat({ reviews: [] }));
  const { POST } = load(SPECIALIST, { ...unlocked, fetch: stub.fetch }, gemini);
  const withProject = (extra) => ({ ...specialistBody, context: { ...context, project: { ...project, ...extra, internal: 'drop' } } });
  assert.equal((await POST(post('specialist', withProject({ rubric: 'Rubric: tests exist', constitution: 'No libraries' })))).status, 200);
  const input = JSON.parse(stub.calls[0].body.messages[1].content);
  assert.equal(input.project.rubric, 'Rubric: tests exist'); assert.equal(input.project.constitution, 'No libraries'); assert(!('internal' in input.project) && !('status' in input.project));
  assert.match(stub.calls[0].body.messages[0].content, /project\.rubric/);
  assert.equal((await POST(post('specialist', withProject({ rubric: 'R'.repeat(4001) })))).status, 400);
  assert.equal(stub.calls.length, 1);
});

test('Studio chain stays on Gemini and OpenRouter, reports who answered, and never reaches OpenAI', async () => {
  const studio = { stage: 'plan', brief: 'Build a student portfolio', plan: '', feedback: '' };
  const env = { ...all, AI_FALLBACK: 'openai,openrouter' };
  const stub = provider(failing(429), failing(503), () => Response.json({ model: 'free:model', usage: { prompt_tokens: 11, completion_tokens: 4 }, choices: [{ finish_reason: 'stop', message: { content: 'A plan.' } }] }));
  const response = await load(STUDIO, { ...unlocked, fetch: stub.fetch }, env).POST(post('studio', studio));
  assert.equal(response.status, 200);
  assert.deepEqual(names(stub.calls), ['gemini', 'gemini', 'openrouter']);
  const body = await response.json();
  assert.equal(body.text, 'A plan.'); assert.equal(body.model, 'free:model');
  assert.deepEqual({ ...body.meta, latencyMs: 0 }, { provider: 'openrouter', model: 'free:model', latencyMs: 0, promptTokens: 11, completionTokens: 4 });
  const exhausted = provider(failing(429));
  const failed = await load(STUDIO, { ...unlocked, fetch: exhausted.fetch }, env).POST(post('studio', studio));
  assert.equal(failed.status, 502); assert(!names(exhausted.calls).includes('openai'), 'OpenAI is never a Studio provider');
  const out = await failed.json(); assert.equal(out.kind, 'quota'); assert.match(out.error, /Fallback OpenRouter was also unavailable/);
  const auth = provider(failing(401), chat({}));
  assert.equal((await load(STUDIO, { ...unlocked, fetch: auth.fetch }, env).POST(post('studio', studio))).status, 502); assert.equal(auth.calls.length, 1, 'auth does not fall back in Studio either');
});
test('Studio SSE result and non-streamed result carry meta with usage when the provider reports it', async () => {
  const { sseData } = load('src/lib/studio-stream.ts');
  const studio = { stage: 'plan', brief: 'Build a student portfolio', plan: '', feedback: '', live: true };
  const frames = [{ model: 'm1', choices: [{ delta: { content: 'Hello plan' }, finish_reason: null }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }, { choices: [], usage: { prompt_tokens: 3, completion_tokens: 2 } }];
  const stream = () => new Response(frames.map((f) => 'data: ' + JSON.stringify(f) + '\n\n').join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  const stub = provider(stream);
  const response = await load(STUDIO, { ...unlocked, fetch: stub.fetch }, gemini).POST(post('studio', studio));
  const events = []; for await (const data of sseData(response.body)) events.push(JSON.parse(data));
  assert.equal(events[0].type, 'started'); assert.equal(events[0].provider, 'gemini');
  const result = events.at(-1);
  assert.equal(result.type, 'result'); assert.equal(result.result.meta.provider, 'gemini'); assert.equal(result.result.meta.model, 'm1');
  assert.equal(result.result.meta.promptTokens, 3); assert.equal(result.result.meta.completionTokens, 2);
  assert.equal(stub.calls[0].body.stream_options.include_usage, true);
  const noUsage = provider(() => new Response('data: ' + JSON.stringify(frames[0]) + '\n\ndata: ' + JSON.stringify(frames[1]) + '\n\ndata: [DONE]\n\n'));
  const second = await load(STUDIO, { ...unlocked, fetch: noUsage.fetch }, gemini).POST(post('studio', studio));
  const more = []; for await (const data of sseData(second.body)) more.push(JSON.parse(data));
  assert(!('promptTokens' in more.at(-1).result.meta));
});
test('GET /api/manager lists configured fallbacks and nothing else new; live-access GET keeps its shape', async () => {
  const info = await load(MANAGER, unlocked, { ...all, AI_FALLBACK: 'openrouter,openai' }).GET().then((r) => r.json());
  assert.deepEqual(info, { configured: true, provider: 'gemini', studioProvider: 'gemini', studioConfigured: true, fallback: ['openrouter', 'openai'], cooldowns: [] });
  const access = await load('src/app/api/live-access/route.ts', {}, {}).GET(new Request('http://localhost/api/live-access')).then((r) => r.json());
  assert.deepEqual(Object.keys(access).sort(), ['authenticated', 'configured', 'enabled']);
});
test('provider-output: extractOutputText and usage readers', () => {
  const { extractOutputText, readUsage } = load('src/lib/provider-output.ts');
  assert.equal(extractOutputText({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'a' }, { type: 'refusal', text: 'x' }, { type: 'output_text', text: 'b' }] }] }), 'ab');
  assert.throws(() => extractOutputText({ status: 'incomplete', output: [] })); assert.throws(() => extractOutputText(null));
  assert.deepEqual(readUsage({ input_tokens: 4, output_tokens: 6 }), { promptTokens: 4, completionTokens: 6 });
  assert.deepEqual(readUsage({ prompt_tokens: 4, completion_tokens: -1 }), { promptTokens: 4 });
  assert.deepEqual(readUsage('nope'), {});
});

// ---- Quota scope, cooldowns and short minute-quota waits (all on an injected clock) ----
const quotaBody = (quotaId, retryDelay) => ({ error: { code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED', details: [
  { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId }] },
  ...(retryDelay ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] : [])] } });
const geminiQuota = (quotaId, retryDelay) => () => Response.json([quotaBody(quotaId, retryDelay)], { status: 429 });
const DAY_ID = 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', MINUTE_ID = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier';
const plannerBody = { instructions: 'Plan', input: '{}', max_output_tokens: 100, text: { format: { type: 'json_schema', name: 'x', strict: true, schema: { type: 'object' } } } };
function clocked(env, ...queue) {
  const stub = provider(...queue);
  const state = { clock: Date.UTC(2026, 0, 1, 20, 0, 0), sleeps: [] };
  const service = load('src/lib/ai-service.ts', { fetch: stub.fetch }, env);
  const now = () => state.clock;
  const sleep = async (ms) => { state.sleeps.push(ms); state.clock += ms; };
  const call = (options = {}, total = 60000) => service.structuredCall(plannerBody, 'MANAGER', service.createBudget(total, now), { sleep, minAttemptMs: 1000, ...options });
  return { stub, state, service, call };
}
test('classifyUpstream reads quota scope, retry delay and provider-wide limits without keeping upstream text', () => {
  const { classifyUpstream, secondsToMidnight, humanDuration, quotaExtras } = load('src/lib/provider-errors.ts');
  const noon = Date.UTC(2026, 0, 1, 20, 0, 0); // 12:00 Pacific, 20:00 UTC
  const body = (id, delay) => JSON.stringify([quotaBody(id, delay)]);
  assert.deepEqual({ ...classifyUpstream(429, body(DAY_ID, '44745s'), { provider: 'gemini', now: noon }) }, { kind: 'quota', daily: true, scope: 'day', retryAfterSeconds: 44745, wide: false });
  const minute = classifyUpstream(429, body(MINUTE_ID, '44s'), { provider: 'gemini', now: noon });
  assert.deepEqual([minute.scope, minute.retryAfterSeconds, minute.daily], ['minute', 44, false]);
  assert.equal(classifyUpstream(429, body('GenerateRequestsPerDayPerProject-FreeTier', '100.2s'), { provider: 'gemini', now: noon }).wide, true, 'no PerModel means the whole project is out');
  assert.equal(classifyUpstream(429, body(DAY_ID), { provider: 'gemini', now: noon }).retryAfterSeconds, 12 * 3600, 'no delay: next Pacific midnight');
  assert.equal(secondsToMidnight(noon, 'UTC'), 4 * 3600);
  assert.equal(classifyUpstream(429, 'Please retry in 7.2s', { provider: 'gemini', now: noon }).retryAfterSeconds, 8);
  const router = JSON.stringify({ error: { message: 'Rate limit exceeded: free-models-per-day.', code: 429, metadata: { headers: { 'X-RateLimit-Limit': '50', 'X-RateLimit-Reset': String(noon + 5 * 3600 * 1000) } } } });
  assert.deepEqual({ ...classifyUpstream(429, router, { provider: 'openrouter', now: noon }) }, { kind: 'quota', daily: true, scope: 'day', retryAfterSeconds: 18000, wide: true });
  assert.equal(classifyUpstream(429, 'free-models-per-day', { provider: 'openrouter', now: noon }).retryAfterSeconds, 4 * 3600, 'OpenRouter resets at UTC midnight');
  assert.equal(classifyUpstream(429, 'free-models-per-min', { provider: 'openrouter', now: noon }).scope, 'minute');
  assert.deepEqual({ ...classifyUpstream(429, 'slow down', { provider: 'openai', now: noon, retryAfterHeader: '9' }) }, { kind: 'quota', daily: false, scope: 'unknown', retryAfterSeconds: 9, wide: false });
  assert.equal(classifyUpstream(503, 'overloaded').kind, 'transient');
  assert.deepEqual([humanDuration(45), humanDuration(600), humanDuration(12 * 3600), humanDuration(3 * 86400), humanDuration(3600)], ['about 45 seconds', 'about 10 minutes', 'about 12 hours', 'about 3 days', 'about 1 hour']);
  assert.deepEqual(quotaExtras({ kind: 'quota', scope: 'day' }), { scope: 'day' }); assert.deepEqual(quotaExtras({ kind: 'transient', scope: 'day', retryAfterSeconds: 4 }), {});
});
test('a quota-exhausted model is skipped without a request until its retry delay passes', async () => {
  const { stub, state, call, service } = clocked({ ...gemini, GEMINI_MODEL: 'a,b,c' }, geminiQuota(DAY_ID, '44745s'));
  const first = await call();
  assert.equal(first.ok, false); assert.equal(first.kind, 'quota'); assert.equal(first.scope, 'day'); assert.equal(first.retryAfterSeconds, 44745);
  assert.equal(first.message, 'Gemini free-tier daily quota is used up; it resets in about 12 hours. Fallback provider not configured.');
  assert.equal(stub.calls.length, 3, 'the first failure still probes each model once');
  assert.deepEqual(service.activeCooldowns(state.clock).map((c) => [c.provider, c.model, c.untilSeconds]), [['gemini', 'a', 44745], ['gemini', 'b', 44745], ['gemini', 'c', 44745]]);
  state.clock += 3600 * 1000;
  const second = await call();
  assert.equal(stub.calls.length, 3, 'no request is sent while every model is cooling');
  assert.equal(second.kind, 'quota'); assert.equal(second.retryAfterSeconds, 41145); assert.match(second.message, /resets in about 11 hours/);
  state.clock += 41145 * 1000;
  assert.deepEqual(service.activeCooldowns(state.clock), [], 'expired cooldowns disappear');
  await call(); assert.equal(stub.calls.length, 6, 'models are tried again after the delay');
});
test('cooldown caps: 24 h for a daily quota, 90 s for a per-minute quota; unscoped 429s without a delay do not block', async () => {
  const day = clocked({ ...gemini, GEMINI_MODEL: 'a' }, geminiQuota(DAY_ID, '200000s'));
  await day.call(); assert.equal(day.service.activeCooldowns(day.state.clock)[0].untilSeconds, 86400);
  const minute = clocked({ ...gemini, GEMINI_MODEL: 'a' }, geminiQuota(MINUTE_ID, '300s'));
  const failed = await minute.call(); assert.equal(failed.scope, 'minute');
  assert.equal(minute.service.activeCooldowns(minute.state.clock)[0].untilSeconds, 90); assert.equal(minute.stub.calls.length, 1, 'a long minute delay is not waited out');
  const vague = clocked({ ...gemini, GEMINI_MODEL: 'a' }, failing(429));
  await vague.call(); await vague.call();
  assert.equal(vague.stub.calls.length, 2); assert.deepEqual(vague.service.activeCooldowns(vague.state.clock), []);
});
test('cooldown fails over to the fallback provider instantly; OpenRouter day limits cool the whole provider', async () => {
  const router = () => Response.json({ error: { message: 'Rate limit exceeded: free-models-per-day', code: 429 } }, { status: 429 });
  const env = { ...gemini, GEMINI_MODEL: 'a,b', OPENROUTER_API_KEY: 'router-key', AI_FALLBACK: 'openrouter' };
  const { stub, state, call, service } = clocked(env, geminiQuota(DAY_ID, '40000s'), geminiQuota(DAY_ID, '40000s'), chat(managerItems), chat(managerItems), router);
  const first = await call();
  assert.equal(first.ok, true); assert.equal(first.meta.provider, 'openrouter'); assert.deepEqual(names(stub.calls), ['gemini', 'gemini', 'openrouter']);
  const second = await call();
  assert.equal(second.ok, true); assert.deepEqual(names(stub.calls), ['gemini', 'gemini', 'openrouter', 'openrouter'], 'Gemini is not contacted again');
  const down = clocked({ OPENROUTER_API_KEY: 'router-key' }, router);
  const out = await down.call();
  assert.equal(out.scope, 'day'); assert.equal(out.retryAfterSeconds, 4 * 3600); assert.equal(out.message, 'OpenRouter free-model daily limit reached; it resets in about 4 hours. Fallback provider not configured.');
  assert.deepEqual(down.service.activeCooldowns(down.state.clock), [{ provider: 'openrouter', model: '*', untilSeconds: 4 * 3600 }]);
  await down.call(); assert.equal(down.stub.calls.length, 1);
  assert(state && service);
});
test('a per-minute quota of 20 s or less is waited out once on the same model', async () => {
  const { stub, state, call } = clocked({ ...gemini, GEMINI_MODEL: 'a,b' }, geminiQuota(MINUTE_ID, '12s'), chat(managerItems));
  const ok = await call();
  assert.equal(ok.ok, true); assert.deepEqual(state.sleeps, [12000]); assert.deepEqual(stub.calls.map((c) => c.body.model), ['a', 'a'], 'the same model is retried, not the next one');
  const twice = clocked({ ...gemini, GEMINI_MODEL: 'a,b' }, geminiQuota(MINUTE_ID, '12s'), geminiQuota(MINUTE_ID, '12s'), chat(managerItems));
  assert.equal((await twice.call()).ok, true); assert.deepEqual(twice.stub.calls.map((c) => c.body.model), ['a', 'a', 'b'], 'only one wait per model, then fail over');
  assert.deepEqual(twice.state.sleeps, [12000]); assert.equal(twice.service.activeCooldowns(twice.state.clock)[0].model, 'a');
  const long = clocked({ ...gemini, GEMINI_MODEL: 'a,b' }, geminiQuota(MINUTE_ID, '21s'), chat(managerItems));
  assert.equal((await long.call()).ok, true); assert.deepEqual(long.state.sleeps, []); assert.deepEqual(long.stub.calls.map((c) => c.body.model), ['a', 'b']);
  const tight = clocked({ ...gemini, GEMINI_MODEL: 'a' }, geminiQuota(MINUTE_ID, '12s'), chat(managerItems));
  const refused = await tight.call({}, 10000);
  assert.equal(refused.ok, false); assert.equal(refused.scope, 'minute'); assert.equal(refused.retryAfterSeconds, 12); assert.equal(tight.stub.calls.length, 1, 'not enough budget left to wait');
  assert.match(refused.message, /^Gemini free-tier rate limit reached; retry in about 12 seconds\./);
});
test('routes expose scope, retryAfterSeconds and cooldowns without upstream text; the second call sends nothing', async () => {
  const stub = provider(geminiQuota(DAY_ID, '44745s'));
  const route = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { ...gemini, GEMINI_MODEL: 'a,b' });
  const first = await route.POST(post('manager', managerBody));
  const body = await first.json();
  assert.equal(first.status, 502); assert.equal(body.kind, 'quota'); assert.equal(body.scope, 'day'); assert.equal(body.retryAfterSeconds, 44745);
  assert.equal(body.error, 'Gemini free-tier daily quota is used up; it resets in about 12 hours. Fallback provider not configured.');
  assert(!JSON.stringify(body).includes('You exceeded') && !JSON.stringify(body).includes('RESOURCE_EXHAUSTED') && !JSON.stringify(body).includes(gemini.GEMINI_API_KEY));
  assert.equal(stub.calls.length, 2);
  const info = await route.GET().then((r) => r.json());
  assert.deepEqual(info.cooldowns.map((c) => [c.provider, c.model]), [['gemini', 'a'], ['gemini', 'b']]);
  assert(info.cooldowns.every((c) => c.untilSeconds > 44700 && c.untilSeconds <= 44745));
  const again = await (await route.POST(post('manager', managerBody))).json();
  assert.equal(stub.calls.length, 2, 'cooling models receive no request'); assert.equal(again.kind, 'quota'); assert(again.retryAfterSeconds <= 44745);
  const specialist = load(SPECIALIST, { ...unlocked, fetch: provider(geminiQuota(DAY_ID, '600s')).fetch }, { ...gemini, GEMINI_MODEL: 'a' });
  const failed = await (await specialist.POST(post('specialist', specialistBody))).json();
  assert.equal(failed.kind, 'quota'); assert.equal(failed.scope, 'day'); assert.equal(failed.retryAfterSeconds, 600); assert.match(failed.error, /resets in about 10 minutes/);
  const studio = load(STUDIO, { ...unlocked, fetch: provider(geminiQuota(MINUTE_ID, '30s')).fetch }, { ...gemini, GEMINI_MODEL: 'a' });
  const studioBody = await (await studio.POST(post('studio', { stage: 'plan', brief: 'Build a student portfolio', plan: '', feedback: '' }))).json();
  assert.equal(studioBody.kind, 'quota'); assert.equal(studioBody.scope, 'minute'); assert.equal(studioBody.retryAfterSeconds, 30); assert.equal(studioBody.upstreamStatus, 429);
  const limited = load(MANAGER, { ...unlocked, fetch: provider(chat(managerItems)).fetch }, { ...gemini, PLANNER_RATE_LIMIT: '1' });
  await limited.POST(post('manager', managerBody));
  const blocked = await (await limited.POST(post('manager', managerBody))).json();
  assert.equal(blocked.kind, 'quota'); assert.equal(blocked.scope, 'minute'); assert(blocked.retryAfterSeconds >= 1);
});
