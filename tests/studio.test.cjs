/* eslint-disable @typescript-eslint/no-require-imports -- Node tests transpile the real TypeScript route. */
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
const site = { html: '<h1>Hello</h1>', css: 'body{color:green}', js: 'console.log("hello")' };
function request(body, origin = 'http://localhost') { return new Request('http://localhost/api/studio', { method: 'POST', headers: { origin }, body: JSON.stringify(body) }); }
const payload = { stage: 'build', brief: 'Build a student portfolio', plan: 'Create a header and project list.', feedback: '', files: site };
test('preview isolates generated code and export contains complete HTML', () => {
  const { documentHtml, validFiles } = load('src/lib/studio.ts');
  assert(validFiles(site)); assert(!validFiles({ ...site, js: null })); assert(!validFiles({ ...site, html: '' }));
  const preview = documentHtml({ ...site, js: '</script><script>alert(1)' });
  assert(preview.includes("connect-src 'none'")); assert(preview.includes('<\\/script>'));
  const published = documentHtml({ ...site, html: '<meta http-equiv="refresh" content="0;url=https://evil.example"><base href="https://evil.example/"><h1>Hi</h1>' }, false);
  assert(published.includes('Content-Security-Policy')); assert(published.includes("img-src data: blob:")); assert(published.includes("form-action 'none'"));
  assert.equal(published.match(/<meta http-equiv/g).length, 1); assert(!published.includes('<base')); assert(!published.includes('evil.example'));
  assert(preview.includes("img-src data: blob:")); assert(!preview.includes('https:'));
});
test('studio enforces access, origin, input bounds, free-only routing and server credentials', async () => {
  const env = { OPENROUTER_API_KEY: 'server-only-secret', OPENROUTER_MODEL: 'openrouter/free' };
  const calls = [];
  const overrides = { '@/lib/live-access': { requireLiveAccess: () => null }, fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ model: 'test:free', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(site) } }] }); } };
  const { POST } = load('src/app/api/studio/route.ts', overrides, env);
  assert.equal((await POST(request(payload, 'https://foreign.example'))).status, 403);
  assert.equal((await POST(request({ ...payload, stage: 'constructor' }))).status, 400);
  assert.equal((await POST(request({ ...payload, files: null }))).status, 400);
  const response = await POST(request(payload)); assert.equal(response.status, 200);
  const result = await response.json(); assert.deepEqual(result.files, site); assert(!JSON.stringify(result).includes('server-only-secret'));
  const sent = JSON.parse(calls[0].options.body); assert.equal(sent.model, 'openrouter/free'); assert.deepEqual(sent.provider.max_price, { prompt: 0, completion: 0 });
  env.OPENROUTER_MODEL = 'paid/model'; assert.equal((await POST(request(payload))).status, 400); assert.equal(calls.length, 1);
  const blocked = load('src/app/api/studio/route.ts', { '@/lib/live-access': { requireLiveAccess: () => Response.json({}, { status: 401 }) } });
  assert.equal((await blocked.POST(request(payload))).status, 401);
});
test('studio preserves failures and refuses truncated or malformed generations without automatic retries', async () => {
  let calls = 0;
  let response = () => Response.json({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(site) } }] });
  const { POST } = load('src/app/api/studio/route.ts', { '@/lib/live-access': { requireLiveAccess: () => null }, fetch: async () => { calls++; return response(); } }, { OPENROUTER_API_KEY: 'test' });
  assert.equal((await POST(request(payload))).status, 502); assert.equal(calls, 1);
  response = () => Response.json({}, { status: 429 });
  const limited = await POST(request(payload)); assert.match((await limited.json()).error, /limit/); assert.equal(calls, 2);
  response = () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'not JSON' } }] });
  assert.equal((await POST(request(payload))).status, 502);
});
test('GitHub MCP fixes repository and file path, requires explicit publish, and creates a draft on a new branch', async () => {
  const calls = []; let options;
  class Client {
    async connect(transport) { options = transport.options; }
    async listTools() { return { tools: ['get_file_contents', 'create_branch', 'push_files', 'create_pull_request'].map(name => ({ name })) }; }
    async callTool(call) { calls.push(call); return { content: [{ type: 'text', text: JSON.stringify({ number: 42 }) }] }; }
    async close() {}
  }
  class Transport { constructor(url, opts) { assert.equal(url.hostname, 'api.githubcopilot.com'); this.options = opts; } }
  const { POST } = load('src/app/api/studio/github/route.ts', { '@/lib/live-access': { requireLiveAccess: () => null }, '@modelcontextprotocol/sdk/client/index.js': { Client }, '@modelcontextprotocol/sdk/client/streamableHttp.js': { StreamableHTTPClientTransport: Transport } }, { GITHUB_MCP_TOKEN: 'secret', GITHUB_MCP_REPOSITORY: 'owner/repo', GITHUB_MCP_BASE_BRANCH: 'master' });
  assert.equal((await POST(request({ action: 'publish', files: site }))).status, 400);
  assert.equal((await POST(request({ action: 'connect' }))).status, 200); assert.equal(options.requestInit.headers['X-MCP-Readonly'], 'true');
  const result = await (await POST(request({ action: 'publish', confirm: true, files: site, repository: 'attacker/repo' }))).json();
  assert.equal(result.url, 'https://github.com/owner/repo/pull/42');
  assert.deepEqual(calls.map(c => c.name), ['create_branch', 'push_files', 'create_pull_request']);
  assert(calls.every(c => c.arguments.owner === 'owner' && c.arguments.repo === 'repo'));
  assert.match(calls[0].arguments.branch, /^projectpilot\/site-/); assert.equal(calls[1].arguments.files[0].path, 'projectpilot-site/index.html'); assert.equal(calls[2].arguments.draft, true);
});
test('original manager and specialists can use free OpenRouter structured responses without paid fallback', async () => {
  const env = { OPENROUTER_API_KEY: 'router-secret', OPENAI_API_KEY: 'old-paid-secret' };
  const calls = [];
  const service = load('src/lib/ai-service.ts', { fetch: async (url, init) => { calls.push({ url, init }); return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"items":[]}' } }] }); } }, env);
  assert(service.usesOpenRouter()); assert.equal(service.serviceKey(), 'router-secret');
  const body = { instructions: 'Plan', input: '{}', max_output_tokens: 200, text: { format: { type: 'json_schema', name: 'test', strict: true, schema: { type: 'object' } } } };
  const response = await service.structuredRequest(body, service.serviceKey(), 'MANAGER', 1000);
  assert.equal((await response.json()).status, 'completed');
  assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  const sent = JSON.parse(calls[0].init.body); assert.equal(sent.model, 'openrouter/free'); assert.equal(sent.provider.max_price.completion, 0); assert.equal(sent.response_format.json_schema.name, 'test'); assert.equal(sent.response_format.json_schema.type, undefined);
  env.OPENROUTER_REVIEWER_MODEL = 'paid/model';
  await assert.rejects(service.structuredRequest(body, 'router-secret', 'REVIEWER', 1000)); assert.equal(calls.length, 1);
  env.AI_PROVIDER = 'openai'; assert(!service.usesOpenRouter()); assert.equal(service.serviceKey(), 'old-paid-secret');
});
test('SSE parser handles split UTF-8, comments and CRLF frames', async () => {
  const { sseData } = load('src/lib/studio-stream.ts');
  const encoded = new TextEncoder().encode(': heartbeat\r\n\r\ndata: {"text":"héllo"}\r\n\r\ndata: [DONE]\n\n');
  const body = new ReadableStream({ start(c) { for (let i=0;i<encoded.length;i+=3) c.enqueue(encoded.slice(i,i+3)); c.close(); } });
  const events = []; for await(const data of sseData(body)) events.push(data);
  assert.deepEqual(events, ['{"text":"héllo"}', '[DONE]']);
});
test('live stream sends authored text and validated files, excludes reasoning, and reports truncation without replacing work', async () => {
  const { sseData } = load('src/lib/studio-stream.ts');
  let finish = 'stop';
  const { POST } = load('src/app/api/studio/route.ts', {
    '@/lib/live-access': { requireLiveAccess: () => null },
    fetch: async () => {
      const chunks = [{ model: 'test:free', choices: [{ delta: { reasoning: 'private reasoning', content: JSON.stringify(site) }, finish_reason: null }] }, { choices: [{ delta: {}, finish_reason: finish }] }];
      return new Response(chunks.map(c=>'data: '+JSON.stringify(c)+'\n\n').join('')+'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    }
  }, { OPENROUTER_API_KEY: 'server-secret' });
  let response = await POST(request({ ...payload, live: true }));
  assert(response.headers.get('content-type').includes('text/event-stream'));
  let events = []; for await(const data of sseData(response.body)) events.push(JSON.parse(data));
  assert.equal(events[1].type, 'delta'); assert.deepEqual(events.at(-1).result.files, site);
  assert(!JSON.stringify(events).includes('private reasoning')); assert(!JSON.stringify(events).includes('server-secret'));
  finish = 'length'; response = await POST(request({ ...payload, live: true }));
  events = []; for await(const data of sseData(response.body)) events.push(JSON.parse(data));
  assert.equal(events.at(-1).type, 'error'); assert(!events.some(e=>e.type==='result'));
});
test('original planning handoff rejects unapproved requirements and carries real task contracts', () => {
  const { createStudioHandoff, validHandoff } = load('src/lib/studio-handoff.ts');
  const context = { project: {id:'p',title:'Study tracker',description:'Track course study sessions locally.',targetUser:'Students',approvedSummary:'A small study website'}, requirements:[{text:'Reject invalid minutes.',approvalStatus:'pending'}], tasks:[{id:'t1',order:1,title:'Create tracker',description:'Implement session list and input validation.',ownerAgent:'frontend',dependencies:[],expectedOutput:'Working HTML/CSS/JS',constraints:'No external services'}] };
  assert.throws(()=>createStudioHandoff(context), /Approve/);
  context.requirements[0].approvalStatus='approved';
  const handoff = createStudioHandoff(context); assert(validHandoff(handoff));
  assert(handoff.plan.includes('Reject invalid minutes.')); assert(handoff.plan.includes('Working HTML/CSS/JS')); assert(handoff.plan.includes('No external services'));
  context.tasks[0].dependencies=['missing']; assert.throws(()=>createStudioHandoff(context));
});
test('full-document generations become editable HTML, CSS and JavaScript without duplicate inline execution', () => {
 const {normalizeGeneratedFiles}=load('src/lib/studio.ts');
 const normalized=normalizeGeneratedFiles({html:'<!doctype html><html><head><style>body{color:green}</style></head><body><h1>Hello</h1><script>console.log("hi")</script></body></html>',css:'',js:''});
 assert.equal(normalized.html,'<h1>Hello</h1>');assert.equal(normalized.css,'body{color:green}');assert.equal(normalized.js,'console.log("hi")');
 const data=normalizeGeneratedFiles({html:'<h1>Hello</h1><script type="application/ld+json">{"name":"site"}</script>',css:'',js:''});assert(data.html.includes('application/ld+json'));assert.equal(data.js,'');
});

function liveRequest(body, headers = {}) { return new Request('http://localhost/api/live-access', { method: 'POST', headers: { origin: 'http://localhost', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }); }
test('live access refuses short production codes, derives the cookie key, and compares without a length oracle', async () => {
  const strong = 'correct-horse-battery-staple-2026';
  const errors = []; const originalError = console.error; console.error = (...args) => errors.push(args.join(' '));
  try {
    const weak = load('src/lib/live-access.ts', {}, { NODE_ENV: 'production', LIVE_ACCESS_CODE: 'short-code' });
    assert.equal(weak.unlockLive('short-code', true, liveRequest({})).status, 503);
    assert.equal(weak.liveAccessConfigured(), false); assert.equal(weak.liveAccessEnabled(), true);
    assert.equal(weak.hasLiveAccess(liveRequest({})), false); assert.equal(weak.requireLiveAccess(liveRequest({})).status, 503);
    assert(errors.some(e => /LIVE_ACCESS_CODE/.test(e)));
    const dev = load('src/lib/live-access.ts', {}, { NODE_ENV: 'development', LIVE_ACCESS_CODE: 'short-code' });
    assert.equal(dev.unlockLive('short-code', true, liveRequest({})).status, 200);
    const prod = load('src/lib/live-access.ts', {}, { NODE_ENV: 'production', LIVE_ACCESS_CODE: strong });
    assert.equal(prod.unlockLive(strong.slice(0, 10), true, liveRequest({})).status, 401);
    assert.equal(prod.unlockLive(strong + 'x', true, liveRequest({})).status, 401);
    assert.equal(prod.unlockLive(strong, false, liveRequest({})).status, 400);
    const unlocked = prod.unlockLive(strong, true, liveRequest({})); assert.equal(unlocked.status, 200);
    const cookie = unlocked.headers.get('set-cookie').split(';')[0];
    assert(prod.hasLiveAccess(new Request('http://localhost/api/studio', { headers: { cookie } })));
    const [expires] = cookie.split('=')[1].split('.');
    const rawKeyMac = require('node:crypto').createHmac('sha256', strong).update(expires).digest('hex');
    assert(!prod.hasLiveAccess(new Request('http://localhost/api/studio', { headers: { cookie: `projectpilot-live=${expires}.${rawKeyMac}` } })), 'cookie must not verify against the raw access code');
    assert.equal(prod.requireLiveAccess(new Request('http://localhost/api/studio')).status, 401);
  } finally { console.error = originalError; }
});
test('live access route limits unlock attempts per client, requires Origin, and returns only gate state', async () => {
  const { GET, POST } = load('src/app/api/live-access/route.ts', {}, { NODE_ENV: 'production', LIVE_ACCESS_CODE: 'correct-horse-battery-staple-2026' });
  const state = await (await GET(new Request('http://localhost/api/live-access'))).json();
  assert.deepEqual(Object.keys(state).sort(), ['authenticated', 'configured', 'enabled']); assert.equal(state.authenticated, false);
  assert.equal((await POST(new Request('http://localhost/api/live-access', { method: 'POST', body: '{}' }))).status, 403);
  assert.equal((await POST(liveRequest({ code: 'x', consent: true }, { origin: 'https://foreign.example' }))).status, 403);
  assert.equal((await POST(liveRequest('{not json', { 'x-forwarded-for': '203.0.113.9' }))).status, 400);
  assert.equal((await POST(liveRequest({ code: 'a'.repeat(2500), consent: true }, { 'x-forwarded-for': '203.0.113.9' }))).status, 413);
  let last;
  for (let i = 0; i < 8; i++) last = await POST(liveRequest({ code: 'wrong', consent: true }, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
  assert.equal(last.status, 401);
  const blocked = await POST(liveRequest({ code: 'correct-horse-battery-staple-2026', consent: true }, { 'x-forwarded-for': '203.0.113.9' }));
  assert.equal(blocked.status, 429); assert(blocked.headers.get('retry-after'));
  assert.equal((await POST(liveRequest({ code: 'correct-horse-battery-staple-2026', consent: true }, { 'x-forwarded-for': '198.51.100.7' }))).status, 200, 'other clients are unaffected');
});
test('rate limiter windows expire and keys stay bounded', () => {
  const { createRateLimiter, clientKey } = load('src/lib/rate-limit.ts');
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert(limiter.check('a', 0).allowed); assert(limiter.check('a', 1).allowed); const third = limiter.check('a', 2); assert(!third.allowed); assert(third.retryAfterSeconds >= 1);
  assert(limiter.check('a', 1001).allowed);
  for (let i = 0; i < 6000; i++) limiter.check('k' + i, 5000); assert(limiter.check('a', 5000).allowed);
  assert.equal(clientKey(new Request('http://x', { headers: { 'x-forwarded-for': ' 203.0.113.5 , 10.0.0.1' } })), '203.0.113.5');
  assert.equal(clientKey(new Request('http://x')), 'unknown');
});
test('normalization strips meta http-equiv and base directives from generated markup', () => {
  const { normalizeGeneratedFiles } = load('src/lib/studio.ts');
  const out = normalizeGeneratedFiles({ html: '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=https://evil.example"><base href="https://evil.example/"></head><body><META HTTP-EQUIV=\'refresh\' CONTENT=\'1\'><h1>Hi</h1><meta name="ok" content="kept"><base target="_blank"></body></html>', css: '', js: '' });
  assert.equal(out.html, '<h1>Hi</h1><meta name="ok" content="kept">');
});
test('findExternalResources reports every way a published site could leave its own file', () => {
  const { findExternalResources } = load('src/lib/html-sanitize.ts');
  assert.deepEqual(findExternalResources('<h1>Hello</h1><a href="https://example.com">ok link</a><img src="data:image/png;base64,AAAA" alt=""><link rel="icon" href="data:image/png;base64,AAAA"><p>Turn on=lights</p>', 'body{background:url(data:image/png;base64,AAAA)}'), []);
  const found = findExternalResources('<script src="https://cdn.example/x.js"></script><link rel="stylesheet" href="//fonts.example/a.css"><iframe src="https://evil.example"></iframe><object data="x.swf"></object><embed src="x.mov"><meta http-equiv="refresh" content="0"><base href="/"><button onclick="alert(1)" ONMOUSEOVER=\'x()\'>Go</button>', '@import url("https://fonts.example/f.css"); h1{background:url(https://tracker.example/p.gif)}');
  const kinds = found.map(f => f.split(' ')[0] + (f.startsWith('inline') || f.startsWith('css') ? ' ' + f.split(' ')[1] : ''));
  assert.deepEqual(kinds, ['<script', '<link', '<iframe>', '<object>', '<embed>', '<meta', '<base>', 'inline handler', 'inline handler', 'css @import', 'css url()']);
  assert(found.some(f => f.includes('onclick')) && found.some(f => f.includes('ONMOUSEOVER')));
});
test('studio routes return 400 for malformed JSON and 413 for oversize bodies instead of 502', async () => {
  let calls = 0;
  const overrides = { '@/lib/live-access': { requireLiveAccess: () => null }, fetch: async () => { calls++; return Response.json({}); } };
  const { POST } = load('src/app/api/studio/route.ts', overrides, { OPENROUTER_API_KEY: 'test' });
  const raw = (body, headers = {}) => new Request('http://localhost/api/studio', { method: 'POST', headers: { origin: 'http://localhost', ...headers }, body });
  assert.equal((await POST(raw('{"stage":'))).status, 400);
  assert.equal((await POST(raw('[1,2]'))).status, 400);
  assert.equal((await POST(raw(JSON.stringify({ ...payload, plan: 'x'.repeat(420001) })))).status, 413);
  assert.notEqual((await POST(new Request('http://localhost/api/studio', { method: 'POST', body: JSON.stringify(payload) }))).status, 403, 'missing Origin is accepted outside production');
  const production = load('src/app/api/studio/route.ts', overrides, { OPENROUTER_API_KEY: 'test', NODE_ENV: 'production' });
  assert.equal((await production.POST(new Request('http://localhost/api/studio', { method: 'POST', body: JSON.stringify(payload) }))).status, 403, 'missing Origin is refused in production');
  assert.equal((await POST(raw(JSON.stringify(payload), { origin: 'http://localhost:9999' }))).status, 403, 'port must match');
  assert.equal(calls, 1, 'only the accepted no-Origin request reached the provider');
  const github = load('src/app/api/studio/github/route.ts', { ...overrides, '@modelcontextprotocol/sdk/client/index.js': { Client: class {} }, '@modelcontextprotocol/sdk/client/streamableHttp.js': { StreamableHTTPClientTransport: class {} } }, { GITHUB_MCP_TOKEN: 'secret', GITHUB_MCP_REPOSITORY: 'owner/repo' });
  assert.equal((await github.POST(raw('{oops'))).status, 400);
  assert.equal((await github.POST(raw(JSON.stringify({ action: 'publish', confirm: true, files: { ...site, css: 'x'.repeat(400001) } })))).status, 413);
});
test('publishing refuses sites with external resources and labels the pull request as self-contained', async () => {
  const calls = [];
  class Client { async connect() {} async listTools() { return { tools: ['create_branch', 'push_files', 'create_pull_request'].map(name => ({ name })) }; } async callTool(call) { calls.push(call); return { content: [{ type: 'text', text: '{"number":7}' }] }; } async close() {} }
  const { POST } = load('src/app/api/studio/github/route.ts', { '@/lib/live-access': { requireLiveAccess: () => null }, '@modelcontextprotocol/sdk/client/index.js': { Client }, '@modelcontextprotocol/sdk/client/streamableHttp.js': { StreamableHTTPClientTransport: class {} } }, { GITHUB_MCP_TOKEN: 'secret', GITHUB_MCP_REPOSITORY: 'owner/repo' });
  const rejected = await POST(request({ action: 'publish', confirm: true, files: { ...site, html: '<h1>Hi</h1><script src="https://cdn.example/app.js"></script>' } }));
  assert.equal(rejected.status, 400); const body = await rejected.json(); assert.match(body.error, /self-contained/); assert.equal(body.external.length, 1); assert.equal(calls.length, 0);
  assert.equal((await POST(request({ action: 'publish', confirm: true, files: { ...site, html: '<div onclick="x()">Hi</div>' } }))).status, 400);
  assert.equal((await POST(request({ action: 'publish', confirm: true, files: { ...site, css: '@import "https://x.example/a.css";' } }))).status, 400);
  assert.equal((await POST(request({ action: 'publish', confirm: true, files: site }))).status, 200);
  const pushed = calls.find(c => c.name === 'push_files').arguments.files[0].content; assert(pushed.includes('Content-Security-Policy'));
  assert.match(calls.find(c => c.name === 'create_pull_request').arguments.body, /self-contained/);
});

// ---- Studio on Gemini ----
const geminiEnv = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'AQ.Ab8RN6Jtest-key-that-must-never-leak-0123456789' };
const hasKey = (value, name) => value && typeof value === 'object' && (Object.hasOwn(value, name) || Object.values(value).some((v) => hasKey(v, name)));
const unlocked = { '@/lib/live-access': { requireLiveAccess: () => null } };
test('studio on Gemini posts to the Google endpoint with a Gemini-safe schema and relays a validated build', async () => {
  const calls = [];
  const { POST } = load('src/app/api/studio/route.ts', { ...unlocked, fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ model: 'gemini-3.6-flash', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(site) } }] }); } }, geminiEnv);
  const response = await POST(request(payload));
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).files, site);
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${geminiEnv.GEMINI_API_KEY}`);
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.model, 'gemini-3.6-flash'); assert.equal(sent.response_format.json_schema.name, 'website_files');
  assert(!hasKey(sent.response_format.json_schema.schema, 'additionalProperties')); assert.deepEqual(sent.response_format.json_schema.schema.required, ['html', 'css', 'js']);
  assert(!('provider' in sent) && !('reasoning' in sent), 'no OpenRouter-only fields'); assert.equal(sent.reasoning_effort, 'low');
});
test('studio on Gemini streams deltas, falls back across models, and never leaks the key', async () => {
  const { sseData } = load('src/lib/studio-stream.ts');
  const models = [];
  const { POST } = load('src/app/api/studio/route.ts', { ...unlocked, fetch: async (url, options) => {
    const model = JSON.parse(options.body).model; models.push(model);
    if (model === 'gemini-3.6-flash') return Response.json({ error: { message: `busy for ${geminiEnv.GEMINI_API_KEY}` } }, { status: 503 });
    const chunks = [{ model, choices: [{ delta: { content: JSON.stringify(site) }, finish_reason: null }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }];
    return new Response(chunks.map((c) => 'data: ' + JSON.stringify(c) + '\n\n').join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  } }, geminiEnv);
  const response = await POST(request({ ...payload, live: true }));
  const events = []; for await (const data of sseData(response.body)) events.push(JSON.parse(data));
  assert.deepEqual(models, ['gemini-3.6-flash', 'gemini-3-flash-preview'], 'the busy model falls through to the next');
  assert.equal(events[0].type, 'started'); assert.equal(events[0].model, 'gemini-3-flash-preview');
  assert.deepEqual(events.at(-1).result.files, site); assert(!JSON.stringify(events).includes(geminiEnv.GEMINI_API_KEY));
});
test('studio on Gemini maps provider errors to safe messages and reports a missing key by name', async () => {
  const quota = load('src/app/api/studio/route.ts', { ...unlocked, fetch: async () => Response.json([{ error: { message: `Quota exceeded ${geminiEnv.GEMINI_API_KEY}` } }], { status: 429 }) }, { ...geminiEnv, GEMINI_MODEL: 'only-model' });
  const limited = await quota.POST(request(payload)); assert.equal(limited.status, 502);
  const text = JSON.stringify(await limited.json()); assert(text.includes('Gemini free-tier quota')); assert(!text.includes('AQ.') && !text.includes('Quota exceeded'));
  const missing = await load('src/app/api/studio/route.ts', { ...unlocked, fetch: async () => { throw new Error('must not call'); } }, { AI_PROVIDER: 'gemini' }).POST(request(payload));
  assert.equal(missing.status, 503); assert((await missing.json()).error.includes('GEMINI_API_KEY'));
});
test('studio stays on OpenRouter unless Gemini is the selected provider', async () => {
  const urls = [];
  const fetchStub = async (url) => { urls.push(url); return Response.json({ model: 'x:free', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(site) } }] }); };
  for (const env of [{ OPENROUTER_API_KEY: 'k', GEMINI_API_KEY: 'g' }, { AI_PROVIDER: 'openai', OPENROUTER_API_KEY: 'k', GEMINI_API_KEY: 'g' }]) {
    assert.equal((await load('src/app/api/studio/route.ts', { ...unlocked, fetch: fetchStub }, env).POST(request(payload))).status, 200);
  }
  assert.deepEqual(urls, ['https://openrouter.ai/api/v1/chat/completions', 'https://openrouter.ai/api/v1/chat/completions']);
});
