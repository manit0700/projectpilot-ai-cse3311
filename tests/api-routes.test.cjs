/* eslint-disable @typescript-eslint/no-require-imports -- Node tests transpile the real TypeScript routes. */
// Run with: node --test tests/api-routes.test.cjs
// Request validation, retry policy and provider-error mapping for /api/manager and /api/specialist.
// The provider is always a stub; no test here can reach OpenAI or OpenRouter.
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
const MANAGER = 'src/app/api/manager/route.ts', SPECIALIST = 'src/app/api/specialist/route.ts';
const request = (route, body, origin = 'http://localhost') => new Request(`http://localhost/api/${route}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const project = { id: 'p1', title: 'Study tracker', description: 'A browser-local study-session tracker for one student.', targetUser: 'Students', approvedSummary: '', status: 'agents_running', createdAt: '2026-01-01T00:00:00.000Z' };
const task = { id: 't1', projectId: 'p1', title: 'Build tracker UI', description: 'Implement the session form, list and total.', ownerAgent: 'frontend', dependencies: [], expectedOutput: 'HTML, CSS and JavaScript', constraints: 'No libraries', state: 'in_progress', order: 1 };
const context = { project, requirements: [{ id: 'r1', projectId: 'p1', text: 'Add study sessions.', priority: 'must', approvalStatus: 'approved' }], planApproved: true, tasks: [task], outputs: [] };
const specialistBody = { stage: 'execute', taskId: 't1', context };
const managerBody = { stage: 'questions', context: { project: { id: 'p1', description: 'A browser-local study-session tracker.' } } };
const specialistOutput = { summary: 'Session form with validation and a running total.', assumptions: [], blockers: [], confidence: 0.8, nextSteps: [] };
const managerItems = { items: [{ prompt: 'Which fields does a session store?', why: 'Defines the record shape.' }] };
// OpenAI Responses shape, or the OpenRouter chat shape when the request goes to OpenRouter.
const completed = (payload) => (url) => url.startsWith('https://openrouter.ai')
  ? Response.json({ model: 'test:free', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] })
  : Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] });
// A fetch stub that replays a queue of responders and counts every provider call.
function provider(...queue) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); const next = queue.length > 1 ? queue.shift() : queue[0]; return next(url, init); };
  return { fetch, calls };
}
const upstreamFailure = (status) => () => Response.json({ error: { message: 'upstream-secret-detail', type: 'provider_error' } }, { status });
const timeout = () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); };

test('manager and specialist refuse malformed JSON (400) and oversize bodies (413) before any provider call', async () => {
  for (const [route, body, big] of [[MANAGER, managerBody, 60001], [SPECIALIST, specialistBody, 300001]]) {
    const stub = provider(completed(route === MANAGER ? managerItems : specialistOutput));
    const { POST } = load(route, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
    assert.equal((await POST(request(route, '{nope'))).status, 400);
    assert.equal((await POST(request(route, 'null'))).status, 400);
    assert.equal((await POST(request(route, '[]'))).status, 400);
    assert.equal((await POST(request(route, '{"stage":"' + 'x'.repeat(big) + '"}'))).status, 413);
    assert.equal(stub.calls.length, 0, 'no provider call for rejected bodies');
    assert.equal((await POST(request(route, body))).status, 200, 'the same loader accepts a valid body');
  }
});
test('specialist caps previousOutput and each output individually', async () => {
  const stub = provider(completed(specialistOutput));
  const { POST } = load(SPECIALIST, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
  const huge = 'x'.repeat(61000);
  assert.equal((await POST(request('specialist', { ...specialistBody, previousOutput: { ...specialistOutput, summary: huge } }))).status, 413);
  assert.equal((await POST(request('specialist', { ...specialistBody, context: { ...context, outputs: [{ id: 'o1', taskId: 't1', summary: huge }] } }))).status, 413);
  assert.equal(stub.calls.length, 0);
  const ok = await POST(request('specialist', { ...specialistBody, previousOutput: { ...specialistOutput, summary: 'x'.repeat(50000) } }));
  assert.equal(ok.status, 200); assert.equal(stub.calls.length, 1);
});
test('specialist retries once on 5xx or timeout and never on 4xx', async () => {
  for (const first of [upstreamFailure(500), upstreamFailure(503), timeout]) {
    const stub = provider(first, completed(specialistOutput));
    const { POST } = load(SPECIALIST, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
    const response = await POST(request('specialist', specialistBody));
    assert.equal(response.status, 200); assert.equal(stub.calls.length, 2, 'one retry after a retryable failure');
    assert.equal((await response.json()).output.retryCount, 1);
  }
  const persistent = provider(upstreamFailure(500));
  const { POST } = load(SPECIALIST, { ...unlocked, fetch: persistent.fetch }, { OPENAI_API_KEY: 'test-key' });
  const failed = await POST(request('specialist', specialistBody));
  assert.equal(failed.status, 502); assert.equal(persistent.calls.length, 2); assert.match((await failed.json()).error, /retry/i);
  for (const status of [400, 401, 403, 429]) {
    const stub = provider(upstreamFailure(status), completed(specialistOutput));
    const route = load(SPECIALIST, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
    const response = await route.POST(request('specialist', specialistBody));
    assert.equal(response.status, 502, `upstream ${status} becomes 502`); assert.equal(stub.calls.length, 1, `upstream ${status} is never retried`);
    const text = await response.text();
    assert(!text.includes('upstream-secret-detail') && !text.includes('provider_error') && !text.includes('test-key'), 'upstream body never reaches the client');
    if (status === 429) assert.match(text, /limit/); if (status === 401) assert.match(text, /key/i);
  }
});
test('manager maps upstream 5xx and incomplete responses to 502 without leaking upstream text', async () => {
  for (const responder of [upstreamFailure(500), upstreamFailure(503), () => Response.json({ status: 'incomplete', output: [] }), () => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'not json' }] }] })]) {
    const stub = provider(responder, completed(managerItems));
    const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
    const response = await POST(request('manager', managerBody));
    assert.equal(response.status, 502); assert.equal(stub.calls.length, 1, 'the manager does not retry on its own');
    const text = await response.text(); assert(!text.includes('upstream-secret-detail') && !text.includes('test-key'));
  }
  for (const [status, pattern] of [[401, /key/i], [429, /limit/]]) {
    const stub = provider(upstreamFailure(status));
    const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
    const response = await POST(request('manager', managerBody)); assert.equal(response.status, 502); assert.match((await response.json()).error, pattern);
  }
});
test('manager over OpenRouter sends a strict json_schema format with zero max_price; truncated generations become 502', async () => {
  const stub = provider(() => Response.json({ model: 'test:free', choices: [{ finish_reason: 'length', message: { content: JSON.stringify(managerItems) } }] }), completed(managerItems));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { OPENROUTER_API_KEY: 'router-secret' });
  const truncated = await POST(request('manager', managerBody));
  assert.equal(truncated.status, 502); assert(!(await truncated.text()).includes('router-secret'));
  assert.equal(stub.calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(stub.calls[0].init.headers.Authorization, 'Bearer router-secret');
  const sent = JSON.parse(stub.calls[0].init.body);
  assert.equal(sent.model, 'openrouter/free'); assert.deepEqual(sent.provider.max_price, { prompt: 0, completion: 0 }); assert.equal(sent.provider.require_parameters, true);
  assert.equal(sent.response_format.type, 'json_schema'); assert.equal(sent.response_format.json_schema.name, 'project_questions'); assert.equal(sent.response_format.json_schema.strict, true);
  assert.deepEqual(Object.keys(sent.response_format.json_schema.schema.properties.items.items.properties), ['prompt', 'why']);
  const ok = await POST(request('manager', managerBody)); assert.equal(ok.status, 200); assert.equal((await ok.json()).items.length, 1);
});
test('live routes answer 503 only when both provider keys are absent', async () => {
  for (const [route, body, payload] of [[MANAGER, managerBody, managerItems], [SPECIALIST, specialistBody, specialistOutput]]) {
    const name = route === MANAGER ? 'manager' : 'specialist';
    const none = provider(completed(payload));
    assert.equal((await load(route, { ...unlocked, fetch: none.fetch }, {}).POST(request(name, body))).status, 503);
    assert.equal((await load(route, { ...unlocked, fetch: none.fetch }, { OPENAI_API_KEY: '   ', OPENROUTER_API_KEY: '' }).POST(request(name, body))).status, 503);
    assert.equal(none.calls.length, 0);
    for (const env of [{ OPENAI_API_KEY: 'paid-key' }, { OPENROUTER_API_KEY: 'router-key' }, { OPENAI_API_KEY: 'paid-key', OPENROUTER_API_KEY: 'router-key' }]) {
      const stub = provider(completed(payload));
      assert.equal((await load(route, { ...unlocked, fetch: stub.fetch }, env).POST(request(name, body))).status, 200);
      assert.equal(stub.calls.length, 1);
      assert.equal(stub.calls[0].url.startsWith('https://openrouter.ai'), Boolean(env.OPENROUTER_API_KEY), 'OpenRouter is preferred whenever its key is present');
    }
  }
});

const answerQuestions = [{ id: 'q1', prompt: 'Who uses it?', why: 'Scope.' }, { id: 'q2', prompt: 'Which stack?', why: 'Planning.' }];
const answersBody = (questions = answerQuestions) => ({ stage: 'answers', context: { project, questions } });
test('manager answers stage drafts one answer per question from the idea and returns them in order', async () => {
  const stub = provider(completed({ items: [{ questionId: 'q2', answer: 'Next.js with browser storage, no backend.' }, { questionId: 'q1', answer: 'Students who track study hours between classes.' }] }));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
  const response = await POST(request('manager', answersBody()));
  assert.equal(response.status, 200);
  const { items } = await response.json();
  assert.deepEqual(items.map((i) => i.id), ['answers-1', 'answers-2']);
  assert(items[0].answer.startsWith('Students') && items[1].answer.startsWith('Next.js'), 'answers are matched by question id, not model order');
  const schema = JSON.parse(stub.calls[0].init.body).text.format.schema.properties.items;
  assert.equal(schema.minItems, 2); assert.equal(schema.maxItems, 2);
  const sent = JSON.parse(stub.calls[0].init.body);
  assert(JSON.stringify(sent).includes('Who uses it?') && JSON.stringify(sent).includes('answer'), 'questions are sent and the answers schema is requested');
});
test('manager answers stage rejects missing questions and mismatched counts without leaking output', async () => {
  const stub = provider(completed({ items: [{ questionId: 'q1', answer: 'Only one drafted answer for two questions.' }] }));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
  assert.equal((await POST(request('manager', answersBody([])))).status, 400);
  assert.equal((await POST(request('manager', { stage: 'answers', context: { project } }))).status, 400);
  assert.equal(stub.calls.length, 0, 'invalid requests never reach the provider');
  const mismatch = await POST(request('manager', answersBody()));
  assert.equal(mismatch.status, 502);
  assert(!JSON.stringify(await mismatch.json()).includes('Only one drafted'));
});
test('manager answers stage rejects too-short drafted answers', async () => {
  const stub = provider(completed({ items: [{ questionId: 'q1', answer: 'ok' }, { questionId: 'q2', answer: 'Next.js with browser storage, no backend.' }] }));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
  assert.equal((await POST(request('manager', answersBody()))).status, 502);
});

test('review stage pins the schema to exactly one row per output id and accepts matching reviews', async () => {
  const outputs = [{ id: 'out-a', taskId: 't1', summary: 'First deliverable.', assumptions: [], blockers: [], confidence: 0.8, nextSteps: [], retryCount: 0, approved: 'pending' },
    { id: 'out-b', taskId: 't2', summary: 'Second deliverable.', assumptions: [], blockers: [], confidence: 0.8, nextSteps: [], retryCount: 0, approved: 'pending' }];
  const done = { ...task, state: 'completed' };
  const reviewContext = { ...context, tasks: [done, { ...done, id: 't2', title: 'Second' }], outputs };
  const row = (outputId) => ({ outputId, result: 'pass', missingItems: [], conflicts: [], suggestions: [] });
  const stub = provider(completed({ reviews: [row('out-b'), row('out-a')] }));
  const { POST } = load(SPECIALIST, { ...unlocked, fetch: stub.fetch }, { OPENAI_API_KEY: 'test-key' });
  const response = await POST(request('specialist', { stage: 'review', context: reviewContext }));
  assert.equal(response.status, 200);
  const sent = JSON.parse(stub.calls[0].init.body).text.format.schema.properties.reviews;
  assert.equal(sent.minItems, 2); assert.equal(sent.maxItems, 2);
  assert.deepEqual(sent.items.properties.outputId.enum, ['out-a', 'out-b']);
  const { reviews } = await response.json();
  assert.equal(reviews.length, 2);
});

// ---- Gemini provider (Google's chat-completions compatible endpoint) ----
const geminiChat = (payload, finish = 'stop') => () => Response.json({ model: 'gemini-2.5-flash', choices: [{ finish_reason: finish, message: { content: JSON.stringify(payload) } }] });
const geminiEnv = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'AIzaTestKeyTestKeyTestKeyTestKey123' };
const hasKey = (value, name) => value && typeof value === 'object' && (Object.hasOwn(value, name) || Object.values(value).some((v) => hasKey(v, name)));
test('gemini transport posts a Gemini-safe json_schema to the Google endpoint and accepts the reply', async () => {
  const stub = provider(geminiChat(managerItems));
  const { POST } = load(MANAGER, { ...unlocked, fetch: stub.fetch }, geminiEnv);
  const response = await POST(request('manager', managerBody));
  assert.equal(response.status, 200);
  assert.equal(stub.calls.length, 1);
  const { url, init } = stub.calls[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(init.headers.Authorization, `Bearer ${geminiEnv.GEMINI_API_KEY}`);
  const sent = JSON.parse(init.body);
  assert.equal(sent.model, 'gemini-3.6-flash', 'first default model');
  assert.equal(sent.reasoning_effort, 'low');
  assert.equal(sent.response_format.type, 'json_schema');
  assert.equal(sent.response_format.json_schema.name, 'project_questions');
  assert(!hasKey(sent.response_format.json_schema.schema, 'additionalProperties'), 'Gemini rejects additionalProperties');
  assert.equal(sent.response_format.json_schema.schema.properties.items.items.required.length, 2, 'required fields are preserved');
  assert.equal(sent.messages[0].role, 'system');
  assert(!('provider' in sent) && !('reasoning' in sent), 'no OpenRouter-only fields');
});
test('gemini honours per-role model overrides and GEMINI_REASONING_EFFORT=off', async () => {
  const stub = provider(geminiChat(specialistOutput));
  const env = { ...geminiEnv, GEMINI_MODEL: 'gemini-flash-latest', GEMINI_DEVELOPER_MODEL: 'gemini-2.5-pro', GEMINI_REASONING_EFFORT: 'off' };
  const { POST } = load(SPECIALIST, { ...unlocked, fetch: stub.fetch }, env);
  assert.equal((await POST(request('specialist', specialistBody))).status, 200);
  const sent = JSON.parse(stub.calls[0].init.body);
  assert.equal(sent.model, 'gemini-2.5-pro');
  assert(!('reasoning_effort' in sent));
});
test('gemini truncation and quota errors map to safe 502s without leaking the key or upstream text', async () => {
  const cut = provider(geminiChat(managerItems, 'length'));
  const first = await load(MANAGER, { ...unlocked, fetch: cut.fetch }, geminiEnv).POST(request('manager', managerBody));
  assert.equal(first.status, 502);
  const quota = provider(() => Response.json([{ error: { code: 429, message: `Quota exceeded for key ${geminiEnv.GEMINI_API_KEY}` } }], { status: 429 }));
  const second = await load(MANAGER, { ...unlocked, fetch: quota.fetch }, geminiEnv).POST(request('manager', managerBody));
  assert.equal(second.status, 502);
  const body = JSON.stringify(await second.json());
  assert(!body.includes('AIza') && !body.includes('Quota exceeded'));
  const newFormat = provider(() => Response.json({ error: { message: 'Bad key AQ.Ab8RN6Jabcdefghijklmnopqrstuvwxyz0123456789' } }, { status: 400 }));
  const logged = []; const original = console.warn; console.warn = (...a) => logged.push(a.join(' '));
  try { await load(MANAGER, { ...unlocked, fetch: newFormat.fetch }, geminiEnv).POST(request('manager', managerBody)); } finally { console.warn = original; }
  assert(logged.length && !logged.join(' ').includes('AQ.Ab8R'), 'new-format keys are redacted from logs');
});
test('provider selection: gemini needs its key, reports itself, and Studio follows it or falls back to OpenRouter', async () => {
  const { GET, POST } = load(MANAGER, { ...unlocked, fetch: provider(geminiChat(managerItems)).fetch }, { AI_PROVIDER: 'gemini' });
  assert.equal((await POST(request('manager', managerBody))).status, 503);
  const info = await load(MANAGER, unlocked, { ...geminiEnv, OPENROUTER_API_KEY: 'or-key' }).GET().then((r) => r.json());
  assert.deepEqual(info, { configured: true, provider: 'gemini', studioProvider: 'gemini', studioConfigured: true, fallback: [], cooldowns: [] });
  const studioOr = await load(MANAGER, unlocked, { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENROUTER_API_KEY: 'or-key' }).GET().then((r) => r.json());
  assert.deepEqual(studioOr, { configured: true, provider: 'openai', studioProvider: 'openrouter', studioConfigured: true, fallback: [], cooldowns: [] });
  const auto = await load(MANAGER, unlocked, { GEMINI_API_KEY: geminiEnv.GEMINI_API_KEY }).GET().then((r) => r.json());
  assert.equal(auto.provider, 'gemini', 'a lone Gemini key selects Gemini automatically');
  const both = await load(MANAGER, unlocked, { GEMINI_API_KEY: 'k', OPENROUTER_API_KEY: 'k' }).GET().then((r) => r.json());
  assert.equal(both.provider, 'openrouter', 'existing precedence is unchanged when AI_PROVIDER is unset');
  assert(GET);
});

test('gemini falls back through the model list on busy, retired or exhausted models but not on request errors', async () => {
  const busy = () => Response.json({ error: { message: 'high demand' } }, { status: 503 });
  const env = { ...geminiEnv, GEMINI_MODEL: 'model-a, model-b ,model-c' };
  const ok = provider(busy, () => Response.json({ error: { message: 'quota' } }, { status: 429 }), geminiChat(managerItems));
  const response = await load(MANAGER, { ...unlocked, fetch: ok.fetch }, env).POST(request('manager', managerBody));
  assert.equal(response.status, 200);
  assert.deepEqual(ok.calls.map((c) => JSON.parse(c.init.body).model), ['model-a', 'model-b', 'model-c']);
  const bad = provider(() => Response.json({ error: { message: 'invalid schema' } }, { status: 400 }), geminiChat(managerItems));
  assert.equal((await load(MANAGER, { ...unlocked, fetch: bad.fetch }, env).POST(request('manager', managerBody))).status, 502);
  assert.equal(bad.calls.length, 1, 'a 400 is not retried on another model');
  const allBusy = provider(busy);
  assert.equal((await load(MANAGER, { ...unlocked, fetch: allBusy.fetch }, env).POST(request('manager', managerBody))).status, 502);
  assert.equal(allBusy.calls.length, 3, 'every model is tried once, then the stage fails safely');
});
