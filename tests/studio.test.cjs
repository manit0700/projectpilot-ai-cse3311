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
  assert(!documentHtml(site, false).includes('Content-Security-Policy'));
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
