/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// Live-run resilience: circuit breaker, Stop, usage from route meta, restore notice and project import.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, planned, executed, deliverable, restoredLiveHarness, restoreState } = require('./helpers/workflow-harness.cjs');

const META = { provider: 'openrouter', model: 'test/model', latencyMs: 120, promptTokens: 100, completionTokens: 40 };
const count = (h, type) => h.get().events.filter((e) => e.type === type).length;

/** Replaces fetch with a specialist/review fake; `onExecute` may return a Response to override the reply. */
function fakeRoutes(onExecute) {
  const calls = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    if (body.stage === 'review') return Response.json({ meta: META, reviews: body.context.outputs.map((o) => ({ outputId: o.id, result: 'pass', missingItems: [], conflicts: [], suggestions: [] })) });
    const custom = await onExecute?.(body, options, calls.length);
    if (custom) return custom;
    return Response.json({ meta: META, output: { ...deliverable(`Deliverable for ${body.taskId}`), id: `live-${calls.length}`, taskId: body.taskId, retryCount: 0 } });
  };
  return calls;
}
async function withFetch(run) {
  const old = global.fetch;
  try { return await run(); } finally { global.fetch = old; }
}

test('live replies record provider, model, latency and tokens on events and sum them into usage', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  fakeRoutes();
  await h.get().approveTaskPlan();
  const generated = h.get().events.filter((e) => e.type === 'output_generated');
  assert.equal(generated.length, 7);
  assert(generated.every((e) => e.mode === 'live' && e.provider === 'openrouter' && e.model === 'test/model' && e.latencyMs === 120 && e.promptTokens === 100 && e.completionTokens === 40));
  const review = h.get().events.find((e) => e.type === 'review_completed');
  assert.equal(review.provider, 'openrouter');
  assert.deepEqual(h.get().usage, { requests: 8, promptTokens: 800, completionTokens: 320, totalLatencyMs: 960, models: ['openrouter/test/model'] });
}));

test('replies without meta still work and leave usage at zero', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  const calls = fakeRoutes();
  const route = global.fetch;
  global.fetch = async (url, options) => { const response = await route(url, options); const body = await response.json(); delete body.meta; return Response.json(body); };
  await h.get().approveTaskPlan();
  assert.equal(calls.length, 8);
  assert(h.get().tasks.every((t) => t.state === 'completed'));
  assert.equal(h.get().usage.requests, 0);
  assert(h.get().events.filter((e) => e.type === 'output_generated').every((e) => e.provider === undefined));
}));

test('a quota error stops dispatching, leaves unstarted tasks queued, records one run_failed and one clear notice', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  const order = h.workflow.topologicalOrder(h.get().tasks);
  const calls = fakeRoutes((body) => body.taskId === order[2].id ? Response.json({ error: 'Provider limit reached.', kind: 'quota' }, { status: 502 }) : undefined);
  await h.get().approveTaskPlan();
  assert.equal(calls.filter((c) => c.stage === 'execute').length, 3, 'no task is dispatched after the quota error');
  assert.equal(calls.filter((c) => c.stage === 'review').length, 0);
  const state = h.get();
  assert.deepEqual(order.slice(0, 2).map((t) => state.tasks.find((x) => x.id === t.id).state), ['completed', 'completed']);
  assert(order.slice(2).every((t) => state.tasks.find((x) => x.id === t.id).state === 'queued' || state.tasks.find((x) => x.id === t.id).state === 'blocked'));
  assert(state.tasks.every((t) => t.state !== 'failed'));
  assert.equal(state.tasks.find((t) => t.id === order[2].id).state, 'queued');
  assert.equal(count(h, 'run_failed'), 1);
  assert.match(state.events.find((e) => e.type === 'run_failed').detail, /^quota:/);
  assert.equal(state.workflowNotice, 'Provider quota is used up. Your work is saved; press Run remaining ready tasks when quota resets or switch provider.');
  assert.equal(state.outputs.length, 2);
  // After quota resets the remaining tasks run; finished outputs are untouched.
  const kept = state.outputs.map((o) => o.id);
  fakeRoutes();
  await h.get().approveTaskPlan();
  assert(h.get().tasks.every((t) => t.state === 'completed'));
  assert(kept.every((id) => h.get().outputs.some((o) => o.id === id)));
}));

test('an auth error trips the breaker too, while transient and invalid errors only fail their own task', () => withFetch(async () => {
  const auth = await restoredLiveHarness();
  const order = auth.workflow.topologicalOrder(auth.get().tasks);
  const calls = fakeRoutes((body) => body.taskId === order[0].id ? Response.json({ error: 'The AI provider rejected the access key.', kind: 'auth' }, { status: 502 }) : undefined);
  await auth.get().approveTaskPlan();
  assert.equal(calls.filter((c) => c.stage === 'execute').length, 1);
  assert(auth.get().tasks.every((t) => t.state !== 'failed' && t.state !== 'completed'));
  assert.match(auth.get().workflowNotice, /rejected the API key/);
  assert.equal(count(auth, 'run_failed'), 1);

  const transient = await restoredLiveHarness();
  const first = transient.workflow.topologicalOrder(transient.get().tasks)[0];
  const seen = fakeRoutes((body) => body.taskId === first.id ? Response.json({ error: 'Temporary problem.', kind: 'transient' }, { status: 502 }) : undefined);
  await transient.get().approveTaskPlan();
  assert.equal(transient.get().tasks.find((t) => t.id === first.id).state, 'failed');
  assert(seen.filter((c) => c.stage === 'execute').length > 1, 'the run continues past a transient failure');
  assert.match(transient.get().events.find((e) => e.type === 'run_failed').detail, /^transient: Temporary problem/);
  assert.equal(count(transient, 'run_failed'), 1, 'blocked dependents are held, not failed');
}));

test('Stop aborts the in-flight live request, queues the task again and writes run_stopped', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  let started;
  const reachedFetch = new Promise((resolve) => { started = resolve; });
  let signal;
  global.fetch = async (_url, options) => {
    signal = options.signal;
    started();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
  };
  const running = h.get().approveTaskPlan();
  await reachedFetch;
  assert.equal(h.get().busy, true);
  h.get().stopRun();
  await running;
  assert.equal(signal.aborted, true);
  assert.equal(h.get().busy, false);
  const state = h.get();
  const first = h.workflow.topologicalOrder(state.tasks)[0];
  assert.equal(state.tasks.find((t) => t.id === first.id).state, 'queued');
  assert(state.tasks.every((t) => t.state !== 'in_progress' && t.state !== 'failed'));
  assert.equal(count(h, 'run_stopped'), 1);
  assert.equal(count(h, 'run_failed'), 0);
  assert.match(state.workflowNotice, /Run stopped/);
  h.get().stopRun(); // Stop while idle is a no-op.
  assert.equal(count(h, 'run_stopped'), 1);
  fakeRoutes();
  await h.get().approveTaskPlan();
  assert(h.get().tasks.every((t) => t.state === 'completed'));
}));

test('Stop also works in Demo: the finished step is discarded and the task returns to the queue', async () => {
  const h = harness(); planned(h);
  const running = h.get().approveTaskPlan();
  h.get().stopRun();
  await running;
  assert.equal(h.get().busy, false);
  assert.equal(h.get().outputs.length, 0);
  assert(h.get().tasks.every((t) => t.state === 'queued' || t.state === 'blocked' || t.state === 'needs_revision'));
  assert.equal(count(h, 'run_stopped'), 1);
  await h.get().approveTaskPlan();
  assert(h.get().tasks.every((t) => t.state === 'completed'));
});

test('restoring an interrupted run names how many tasks were interrupted', async () => {
  const source = harness(); planned(source);
  const saved = source.get();
  saved.project = { ...saved.project, status: 'agents_running' };
  saved.tasks = saved.tasks.map((t, i) => i < 2 ? { ...t, state: 'in_progress' } : t);
  const { h } = await restoreState(saved, 'demo', 3);
  assert.match(h.get().workflowNotice, /^An interrupted run was restored\. 2 tasks were interrupted/);
  saved.tasks = saved.tasks.map((t, i) => i === 0 ? { ...t, state: 'in_progress' } : { ...t, state: 'queued' });
  assert.match((await restoreState(saved, 'demo', 3)).h.get().workflowNotice, /1 task was interrupted/);
});

function exportJson(h, overrides = {}) {
  const envelope = JSON.parse(h.persistence.serializeExport(h.get(), 'demo'));
  return JSON.stringify({ ...envelope, ...overrides });
}

test('importProject accepts a previously exported plan.json, keeps its event log and a recovery copy of the old project', async () => {
  const source = harness(); await executed(source);
  const json = exportJson(source);
  const oldWindow = global.window, oldStorage = global.localStorage;
  const data = new Map();
  global.window = { setTimeout, clearTimeout };
  global.localStorage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  try {
    const target = harness(); target.get().startDemoProject();
    const previousId = target.get().project.id;
    assert.deepEqual(target.get().importProject(json), { ok: true });
    assert.equal(target.get().project.id, source.get().project.id);
    assert.equal(target.get().outputs.length, source.get().outputs.length);
    assert.equal(target.get().events.length, source.get().events.length);
    assert.equal(target.get().currentStep, source.get().currentStep);
    assert.equal(JSON.parse(data.get('projectpilot-recovery')).state.project.id, previousId);
    assert.deepEqual(target.get().exportState().project, target.get().project);
  } finally {
    if (oldWindow === undefined) delete global.window; else global.window = oldWindow;
    if (oldStorage === undefined) delete global.localStorage; else global.localStorage = oldStorage;
  }
});

test('importProject rejects malformed files, other apps, unknown versions and invalid content without touching the project', async () => {
  const source = harness(); planned(source);
  const target = harness(); target.get().startDemoProject();
  const before = target.get().project.id;
  const bad = [
    ['{nope', /not valid JSON/],
    [JSON.stringify([]), /not a ProjectPilot/],
    [exportJson(source, { app: 'other' }), /not a ProjectPilot/],
    [exportJson(source, { app: undefined }), /not a ProjectPilot/],
    [exportJson(source, { version: 4 }), /Unsupported export version/],
    [exportJson(source, { version: 1 }), /Unsupported export version/],
    [exportJson(source, { state: null }), /no project data/],
    [exportJson(source, { state: { ...source.get(), outputs: [null] } }), /failed validation/],
    [exportJson(source, { state: { ...source.get(), tasks: [{ ...source.get().tasks[0], dependencies: [source.get().tasks[0].id] }] } }), /failed validation/],
    ['x'.repeat(9_000_000), /too large/],
  ];
  for (const [json, pattern] of bad) {
    const result = target.get().importProject(json);
    assert.equal(result.ok, false);
    assert.match(result.error, pattern);
    assert.equal(target.get().project.id, before);
  }
});

test('importProject refuses while a run is in progress and works again afterwards', async () => {
  const source = harness(); await executed(source);
  const json = exportJson(source);
  const h = harness(); planned(h);
  const running = h.get().approveTaskPlan();
  const refused = h.get().importProject(json);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /run is in progress/);
  await running;
  assert.notEqual(h.get().project.id, source.get().project.id);
  assert.deepEqual(h.get().importProject(json), { ok: true });
  assert.equal(h.get().project.id, source.get().project.id);
});

// Quota scope: per-minute limits pause once and resume by themselves, daily limits stop with a reset time.
const quotaReply = (scope, retryAfterSeconds, extra = {}) => Response.json({ error: 'Provider limit reached.', kind: 'quota', scope, retryAfterSeconds, ...extra }, { status: 502 });
/** Replaces the pause timer so a test decides when (and whether) the countdown ends. */
function fakeTimer(h) {
  const timer = { waits: [], release: null };
  h.load('store-run.ts').timing.sleep = (ms, signal) => new Promise((resolve, reject) => {
    timer.waits.push(ms);
    timer.release = resolve;
    signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true });
  });
  return timer;
}
const until = async (check) => { for (let i = 0; i < 200 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 5)); assert(check(), 'condition was not reached'); };

test('a per-minute quota error pauses with a visible countdown, then resumes exactly once and finishes the run', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  const timer = fakeTimer(h);
  const order = h.workflow.topologicalOrder(h.get().tasks);
  let limited = 0;
  const calls = fakeRoutes((body) => { if (body.taskId === order[1].id && limited++ === 0) return quotaReply('minute', 25); });
  const before = Date.now();
  const running = h.get().approveTaskPlan();
  await until(() => timer.waits.length === 1);
  assert.deepEqual(timer.waits, [25000]);
  const paused = h.get();
  assert(paused.pausedUntil >= before + 25000 && paused.pausedUntil <= Date.now() + 25000);
  assert.equal(paused.busy, true);
  assert.match(paused.workflowNotice, /Resuming automatically in about 25 seconds/);
  assert.equal(paused.tasks.find((t) => t.id === order[1].id).state, 'queued');
  assert.equal(calls.filter((c) => c.stage === 'execute').length, 2);
  assert.equal(count(h, 'run_failed'), 1);
  assert.equal(paused.events.find((e) => e.type === 'run_failed').detail, 'quota (minute, retry after 25s): Provider limit reached.');
  timer.release();
  await running;
  assert.equal(h.get().pausedUntil, null);
  assert(h.get().tasks.every((t) => t.state === 'completed'));
  assert.equal(timer.waits.length, 1, 'one automatic resume only');
  assert.equal(h.get().workflowNotice, null);
}));

test('a second per-minute limit after the automatic resume stops the run instead of pausing again', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  const timer = fakeTimer(h);
  const order = h.workflow.topologicalOrder(h.get().tasks);
  fakeRoutes((body) => body.taskId === order[1].id ? quotaReply('minute', 10) : undefined);
  const running = h.get().approveTaskPlan();
  await until(() => timer.waits.length === 1);
  timer.release();
  await running;
  assert.equal(timer.waits.length, 1);
  assert.equal(h.get().pausedUntil, null);
  assert.equal(h.get().busy, false);
  assert.equal(h.get().tasks.find((t) => t.id === order[1].id).state, 'queued');
  assert(h.get().tasks.every((t) => t.state !== 'failed'));
  assert.equal(count(h, 'run_failed'), 2);
  assert.match(h.get().workflowNotice, /rate limit/);
}));

test('Stop during the pause cancels the countdown, keeps the queue and does not resume', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  const timer = fakeTimer(h);
  const order = h.workflow.topologicalOrder(h.get().tasks);
  const calls = fakeRoutes((body) => body.taskId === order[1].id ? quotaReply('minute', 30) : undefined);
  const running = h.get().approveTaskPlan();
  await until(() => timer.waits.length === 1);
  assert.notEqual(h.get().pausedUntil, null);
  h.get().stopRun();
  await running;
  assert.equal(h.get().pausedUntil, null);
  assert.equal(h.get().busy, false);
  assert.equal(count(h, 'run_stopped'), 1);
  assert.equal(calls.filter((c) => c.stage === 'execute').length, 2, 'nothing was dispatched after Stop');
  assert.equal(h.get().tasks.find((t) => t.id === order[1].id).state, 'queued');
  assert.match(h.get().workflowNotice, /Run stopped/);
}));

test('a minute limit above 60 seconds, or a missing retry time, stops like before instead of pausing', () => withFetch(async () => {
  for (const retry of [61, undefined]) {
    const h = await restoredLiveHarness();
    const timer = fakeTimer(h);
    const calls = fakeRoutes(() => quotaReply('minute', retry));
    await h.get().approveTaskPlan();
    assert.equal(timer.waits.length, 0);
    assert.equal(calls.filter((c) => c.stage === 'execute').length, 1);
    assert.equal(count(h, 'run_failed'), 1);
    assert.equal(h.get().pausedUntil, null);
  }
}));

test('a daily quota stops once, names the reset time in the notice and event, and loads provider cooldowns', () => withFetch(async () => {
  const h = await restoredLiveHarness();
  const cooldowns = { gemini: { until: 123 } };
  const calls = fakeRoutes(() => quotaReply('day', 12 * 3600, { provider: 'gemini' }));
  const route = global.fetch;
  global.fetch = async (url, options) => options?.method === 'GET' ? Response.json({ ok: true, cooldowns }) : route(url, options);
  await h.get().approveTaskPlan();
  assert.equal(calls.filter((c) => c.stage === 'execute').length, 1);
  assert.equal(h.get().workflowNotice, 'Gemini daily quota is used up; it resets in about 12 hours. Your work is saved; press Run remaining ready tasks later, or add a fallback provider.');
  assert.equal(h.get().events.find((e) => e.type === 'run_failed').detail, 'quota (day, retry after 43200s): Provider limit reached.');
  assert.equal(h.get().pausedUntil, null);
  await until(() => h.get().providerCooldowns !== null);
  assert.deepEqual(h.get().providerCooldowns, cooldowns);
  assert(h.get().tasks.every((t) => t.state !== 'failed'));
}));

test('quota notices read well for every scope and reset time', () => {
  const log = harness().load('manager-log.ts');
  assert.match(log.quotaNotice('day', 3600), /resets in about 1 hour\./);
  assert.match(log.quotaNotice('day', undefined), /^Provider daily quota is used up\. Your work is saved/);
  assert.match(log.quotaNotice('minute', 300), /clears in about 5 minutes/);
  assert.equal(log.quotaNotice(undefined, undefined), log.HALT_NOTICE.quota);
});
