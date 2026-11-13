/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// Run with: node --test tests/workflow-persistence.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, planned, executed, withProviderEnv, OPENAI_TEST_ENV, modelResponse, restoreState } = require('./helpers/workflow-harness.cjs');

test('saved approvals restore and interrupted execution becomes retryable', async () => {
  const source = harness(); planned(source);
  const saved = source.get();
  saved.project = { ...saved.project, status: 'agents_running' };
  saved.tasks = saved.tasks.map((t, i) => i === 0 ? { ...t, state: 'in_progress' } : t);
  let raw = JSON.stringify({ version: 2, state: saved, mode: 'live' });
  const oldWindow = global.window, oldStorage = global.localStorage;
  global.window = { setTimeout, clearTimeout };
  global.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  try {
    const restored = harness(); restored.get();
    restored.effects()[0]();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const state = restored.get();
    assert.equal(state.hydrated, true);
    assert.equal(state.managerMode, 'live');
    assert.equal(state.currentStep, 'board');
    assert.equal(state.tasks[0].state, 'failed');
    assert(state.requirements.every((r) => r.approvalStatus === 'approved'));
    state.goTo('requirements'); restored.get(); restored.effects()[1]();
    assert.equal(JSON.parse(raw).state.currentStep, 'requirements');
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    if (oldWindow === undefined) delete global.window; else global.window = oldWindow;
    if (oldStorage === undefined) delete global.localStorage; else global.localStorage = oldStorage;
  }
});

test('invalid JSON, old formats and malformed saved collections keep recovery data and a usable session', async () => {
  for (const raw of ['{not valid JSON', JSON.stringify({ version: 1, state: {} }), JSON.stringify({ version: 4, state: harness().get() }), JSON.stringify({ version: 3, state: { ...harness().get(), outputs: [null] } })]) {
    const { h, data } = await restoreState(raw);
    assert.equal(h.get().hydrated, true);
    assert.equal(h.get().project.id, '');
    assert.equal(data.get('projectpilot-recovery'), raw);
    h.get().startDemoProject(); assert(h.get().questions.length > 0); h.get().submitAnswers(); assert(h.get().requirements.length > 0);
  }
});

test('version 2 saves migrate: start time is recovered, the fabricated default rating becomes unrated, real ratings survive', async () => {
  const source = harness(); await executed(source);
  const legacy = { ...source.get(), metrics: { userAcceptanceRate: 100, numberOfRevisions: 0, taskCompletionRate: 100, conflictRate: 0, planningTimeSavedMinutes: 60, usefulnessScore: 7 } };
  delete legacy.startedAt; delete legacy.completedAt;
  const { h, data } = await restoreState(legacy, 'demo', 2);
  assert.equal(h.get().project.id, legacy.project.id);
  assert.equal(h.get().outputs.length, legacy.outputs.length);
  assert.equal(h.get().metrics.usefulnessScore, null);
  assert.equal(h.get().startedAt, Date.parse(legacy.project.createdAt));
  assert.equal(h.get().completedAt, null);
  assert.equal('planningTimeSavedMinutes' in h.get().metrics, false);
  assert.equal(data.get('projectpilot-recovery'), undefined);
  const rated = await restoreState({ ...legacy, metrics: { ...legacy.metrics, usefulnessScore: 9 } }, 'demo', 2);
  assert.equal(rated.h.get().metrics.usefulnessScore, 9);
  assert.equal(h.persistence.SAVE_VERSION, 3);
  assert.equal(JSON.parse(h.persistence.serializeState(h.get(), 'demo')).version, 3);
});

test('delayed manager timeout preserves draft through restore and permits a successful retry', () => withProviderEnv(OPENAI_TEST_ENV, async () => {
  const { h } = await restoreState(harness().get(), 'live');
  const oldFetch = global.fetch, oldTimeout = AbortSignal.timeout;
  AbortSignal.timeout = () => oldTimeout(30);
  const brief = 'A student study tracker with saved sessions';
  let delayed = true;
  global.fetch = async (url, options) => {
    if (url === '/api/manager') return h.route.POST(new Request('http://localhost/api/manager', options));
    if (!delayed) return modelResponse({ items: [{ prompt: 'What study sessions should be stored?', why: 'Define the record format' }] });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(modelResponse({ items: [] })), 300);
      options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Delayed request aborted', 'TimeoutError')); }, { once: true });
    });
  };
  const idle = async () => { for (let i = 0; i < 50 && h.get().busy; i++) await new Promise((resolve) => setTimeout(resolve, 10)); assert.equal(h.get().busy, false); };
  try {
    h.get().startProject(brief, 'Students'); await idle();
    assert.match(h.get().workflowNotice, /timed out/);
    assert.equal(h.get().draftBrief.idea, brief);
    const restored = await restoreState(h.get(), 'live');
    assert.equal(restored.h.get().draftBrief.idea, brief);
    delayed = false;
    h.get().startProject(brief, 'Students'); await idle();
    assert.equal(h.get().currentStep, 'questions');
    assert.equal(h.get().questions.length, 1);
  } finally { global.fetch = oldFetch; AbortSignal.timeout = oldTimeout; }
}));
