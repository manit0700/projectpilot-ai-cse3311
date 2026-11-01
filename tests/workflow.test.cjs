/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the existing TypeScript modules. */
// Run with: node --test tests/workflow.test.cjs
// Uses Node's built-in test runner and the existing TypeScript compiler.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// A small hook harness exercises the actual store actions without adding a React
// testing dependency. Browser checks separately cover real rendering/interactions.
function harness() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const failures = new Set();
  const calls = [];
  const react = {
    createContext: () => ({ Provider: 'test-provider' }),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect: (callback) => { effects.push(callback); },
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const localRequire = (name) => {
      if (name === 'react') return react;
      if (name.startsWith('@/lib/')) return load(path.resolve(__dirname, '../src/lib', name.slice(6) + '.ts'));
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      const resolved = ['.ts', '.tsx'].map((ext) => base + ext).find(fs.existsSync);
      const exports = load(resolved);
      if (name !== './mock-ai') return exports;
      return { ...exports, runAgentWithRetry: async (task) => {
        calls.push(task.id);
        if (failures.has(task.id)) throw new Error('Injected test failure');
        return { id: `out-${task.id}-${calls.length}`, taskId: task.id, summary: `UI API testing deliverable for ${task.title}`, assumptions: [], blockers: [], confidence: 0.9, nextSteps: [], retryCount: 0, approved: 'pending' };
      } };
    };
    new Function('require', 'module', 'exports', source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const root = path.resolve(__dirname, '../src/lib');
  const { ProjectStoreProvider } = load(path.join(root, 'store.tsx'));
  const get = () => { cursor = 0; effects = []; return ProjectStoreProvider({ children: null }).props.value; };
  return { get, effects: () => effects, failures, calls, workflow: load(path.join(root, 'workflow.ts')), exporter: load(path.join(root, 'plan-export.ts')), manager: load(path.join(root, 'manager-schema.ts')), mock: load(path.join(root, 'mock-ai.ts')), accessRoute: load(path.resolve(root, '../app/api/live-access/route.ts')), specialistRoute: load(path.resolve(root, '../app/api/specialist/route.ts')), specialistSchema: load(path.join(root, 'specialist-schema.ts')), route: load(path.resolve(root, '../app/api/manager/route.ts')) };
}
function planned(h) {
  h.get().startDemoProject();
  for (const r of h.get().requirements) h.get().toggleRequirement(r.id, 'approved');
  h.get().approveRequirements();
}
async function executed(h) { planned(h); await h.get().approveTaskPlan(); }
function approveAll(h) { for (const o of h.get().outputs) h.get().approveOutput(o.id); }

test('normal input flow enforces requirements; editing preserves IDs and resets only edited approval', () => {
  const h = harness();
  h.get().startProject('A campus study group planner', 'Students');
  h.get().submitAnswers();
  assert.equal(h.get().requirements.length, 0);
  for (const q of h.get().questions) h.get().updateAnswer(q.id, 'Small single-user demo');
  h.get().submitAnswers();
  const before = h.get().requirements;
  h.get().approveRequirements();
  assert.equal(h.get().tasks.length, 0);
  for (const r of before) h.get().toggleRequirement(r.id, 'approved');
  h.get().editRequirement(before[0].id, 'Edited requirement');
  assert.equal(h.get().requirements[0].approvalStatus, 'pending');
  assert.deepEqual(h.get().requirements.map((r) => r.id), before.map((r) => r.id));
  assert(h.get().requirements.slice(1).every((r) => r.approvalStatus === 'approved'));
  h.get().goTo('tasks');
  assert.equal(h.get().currentStep, 'requirements');
  h.get().toggleRequirement(before[0].id, 'approved');
  h.get().approveRequirements();
  assert.equal(h.get().currentStep, 'tasks');
});

test('task edits reject self, unknown and circular dependencies, and never execute agents', () => {
  const h = harness(); planned(h);
  const [db, api] = h.get().tasks;
  assert.match(h.get().editTask(db.id, { ...db, dependencies: [db.id] }), /itself/);
  assert.match(h.get().editTask(db.id, { ...db, dependencies: ['unknown'] }), /existing/);
  assert.match(h.get().editTask(db.id, { ...db, dependencies: [api.id] }), /circular/);
  assert.equal(h.get().tasks[0].title, db.title);
  assert.equal(h.get().editTask(db.id, { ...db, title: 'Updated data model', ownerAgent: 'backend' }), null);
  assert.equal(h.get().planApproved, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.get().outputs.length, 0);
  assert(h.get().staleTaskIds.includes(api.id));
  assert(!h.get().staleTaskIds.includes(h.get().tasks.find((t) => t.title === 'Sketch primary UI screens').id));
});

test('backward viewing is non-destructive and cannot bypass approval gates', async () => {
  const h = harness(); await executed(h);
  const tasks = h.get().tasks, outputs = h.get().outputs, requirements = h.get().requirements;
  h.get().goTo('idea');
  h.get().startDemoProject();
  assert.equal(h.get().tasks, tasks);
  h.get().goTo('questions'); h.get().submitAnswers();
  assert.equal(h.get().requirements, requirements);
  h.get().approveRequirements();
  assert.equal(h.get().tasks, tasks);
  assert.equal(h.get().outputs, outputs);
  h.get().goTo('final');
  assert.notEqual(h.get().currentStep, 'final');
  h.get().skipFeedback();
  assert.equal(h.get().currentStep, 'review');
});

test('individual approval and targeted revision preserve unaffected approved outputs', async () => {
  const h = harness(); await executed(h);
  const first = h.get().outputs[0], second = h.get().outputs[1];
  h.get().approveOutput(first.id);
  assert.equal(h.get().outputs[0].approved, 'approved');
  assert(h.get().outputs.slice(1).every((o) => o.approved === 'pending'));
  const approved = h.get().outputs[0];
  h.get().requestRevision(second.id);
  h.get().approveOutputs();
  assert.equal(h.get().currentStep, 'feedback');
  const pendingRevision = h.get().submitFeedback('Clarify acceptance criteria');
  h.get().skipFeedback(); h.get().goTo('final'); h.get().reset();
  assert.equal(h.get().project.status, 'revising');
  await pendingRevision;
  assert.equal(h.get().currentStep, 'review');
  assert.equal(h.get().outputs[0], approved);
  assert.equal(h.get().outputs[1].approved, 'pending');
  assert.equal(h.get().feedbackItems[0].affectedTasks.length, 1);
  assert.equal(h.get().feedbackItems[0].affectedTasks[0], second.taskId);
  h.get().skipFeedback(); assert.notEqual(h.get().currentStep, 'final');
  approveAll(h); h.get().approveOutputs(); h.get().skipFeedback();
  assert.equal(h.get().currentStep, 'final');
});

test('failed retry is isolated; skip never completes a failed dependency or unlocks final', async () => {
  const h = harness(); planned(h);
  const db = h.get().tasks.find((t) => t.ownerAgent === 'database');
  h.failures.add(db.id);
  const running = h.get().approveTaskPlan();
  await h.get().approveTaskPlan(); // Duplicate clicks must not create another run.
  await running;
  assert.equal(h.calls.filter((id) => id === db.id).length, 1);
  const independent = h.get().outputs[0];
  h.get().approveOutput(independent.id);
  const approved = h.get().outputs.find((o) => o.id === independent.id);
  h.get().skipTask(db.id);
  assert.equal(h.get().tasks.find((t) => t.id === db.id).state, 'failed');
  assert(h.get().skippedTaskIds.includes(db.id));
  h.get().skipFeedback(); assert.notEqual(h.get().currentStep, 'final');
  assert(h.get().tasks.some((t) => t.dependencies.includes(db.id) && t.state === 'blocked'));
  h.failures.delete(db.id);
  const calls = h.calls.length;
  await h.get().retryTask(db.id);
  assert.equal(h.calls.length, calls + 1);
  assert.equal(h.calls.at(-1), db.id);
  assert.equal(h.get().outputs.find((o) => o.id === independent.id), approved);
  assert(!h.get().skippedTaskIds.includes(db.id));
  await h.get().approveTaskPlan();
  assert(h.get().tasks.every((t) => t.state === 'completed'));
  assert.equal(h.get().outputs.find((o) => o.id === independent.id), approved);
});

test('editing approved requirements reopens the plan while preserving existing work and IDs', async () => {
  const h = harness(); await executed(h); approveAll(h); h.get().approveOutputs(); h.get().skipFeedback();
  const tasks = h.get().tasks, outputs = h.get().outputs;
  h.get().goTo('requirements');
  h.get().editRequirement(h.get().requirements[0].id, 'Updated approved scope');
  assert.equal(h.get().planApproved, false);
  assert.deepEqual(h.get().tasks.map((t) => t.id), tasks.map((t) => t.id));
  assert.deepEqual(h.get().outputs.map((o) => o.summary), outputs.map((o) => o.summary));
  assert(h.get().outputs.every((o) => o.approved === 'pending'));
  assert.equal(h.get().canNavigate('final'), false);
  h.get().toggleRequirement(h.get().requirements[0].id, 'approved');
  h.get().approveRequirements();
  assert.deepEqual(h.get().tasks.map((t) => t.id), tasks.map((t) => t.id));
  await h.get().approveTaskPlan();
  assert(h.get().outputs.every((o) => o.approved === 'pending'));
  assert.equal(h.get().staleTaskIds.length, 0);
});

test('export rejects unapproved state, includes approved data and labels estimates', async () => {
  const h = harness(); await executed(h);
  assert.throws(() => h.exporter.planMarkdown(h.get()), /approval/);
  approveAll(h); h.get().approveOutputs(); h.get().skipFeedback();
  const markdown = h.exporter.planMarkdown(h.get());
  for (const label of ['Approved requirements', 'Ordered task plan', 'Approved agent outputs', 'Testing / acceptance information', 'Documentation information', 'Estimated planning time saved', 'not measured']) assert(markdown.includes(label));
  assert(markdown.includes(h.get().tasks[0].id));
  assert(markdown.includes(h.get().outputs[0].summary));
});


test('live manager validates tasks and cannot bypass approved requirements', async () => {
  const h = harness();
  const project = { id: 'p', description: 'A student study planner' };
  const task = { id: 't1', title: 'Build planner', description: 'Create calendar', ownerAgent: 'frontend', dependencies: [], expectedOutput: 'Calendar UI', constraints: [] };
  const tasks = h.manager.normalizeManagerItems('tasks', [task], 'p');
  assert.equal(tasks[0].state, 'queued');
  assert.equal(tasks[0].projectId, 'p');
  assert.throws(() => h.manager.normalizeManagerItems('tasks', [{ ...task, dependencies: ['missing'] }], 'p'), /existing/);
  assert.throws(() => h.manager.normalizeManagerItems('tasks', [{ ...task, dependencies: ['t2'] }, { ...task, id: 't2', dependencies: ['t1'] }], 'p'), /circular/);
  assert.throws(() => h.manager.normalizeManagerItems('requirements', [], 'p'), /empty/);
  const blocked = await h.route.POST(new Request('http://localhost/api/manager', { method: 'POST', body: JSON.stringify({ stage: 'tasks', context: { project, requirements: [{ approvalStatus: 'pending' }] } }) }));
  assert.equal(blocked.status, 400);
});

test('browser origin uses the requested host and rejects foreign origins', async () => {
  const h = harness();
  const body = JSON.stringify({ stage: 'tasks', context: { project: { id: 'p', description: 'Study planner' }, requirements: [] } });
  const sameHost = await h.route.POST(new Request('http://localhost:3312/api/manager', { method: 'POST', headers: { origin: 'http://127.0.0.1:3312', host: '127.0.0.1:3312' }, body }));
  assert.equal(sameHost.status, 400); // Passes origin check, fails approval gate.
  const foreign = await h.route.POST(new Request('http://localhost:3312/api/manager', { method: 'POST', headers: { origin: 'http://other.example', host: 'localhost:3312' }, body }));
  assert.equal(foreign.status, 403);
});

test('live API integration parses structured output and returns sanitized errors', async () => {
  const h = harness();
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const request = () => new Request('http://localhost/api/manager', { method: 'POST', body: JSON.stringify({ stage: 'questions', context: { project: { id: 'p', description: 'Study planner' } } }) });
  try {
    delete process.env.OPENAI_API_KEY;
    assert.equal((await h.route.POST(request())).status, 503);
    process.env.OPENAI_API_KEY = 'test-only';
    global.fetch = async (_url, options) => {
      const sent = JSON.parse(options.body);
      assert.equal(sent.text.format.type, 'json_schema');
      assert.equal(sent.store, false);
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ items: [{ prompt: 'Who uses it?', why: 'Define audience' }] }) }] }] });
    };
    const response = await h.route.POST(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.items[0].answer, '');
    global.fetch = async () => Response.json({ error: 'secret diagnostic' }, { status: 429 });
    const error = await h.route.POST(request());
    assert.equal(error.status, 502);
    assert.match((await error.json()).error, /limit/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  }
});


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

function specialistPayload(h, overrides = {}) {
  planned(h);
  const s = h.get();
  return { stage: 'execute', taskId: s.tasks[0].id, context: { ...s, planApproved: true }, ...overrides };
}
const specialistRequest = (body, origin = 'http://localhost') => new Request('http://localhost/api/specialist', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });
const deliverable = (summary = 'Concrete deliverable with implementation') => ({ summary, assumptions: [], blockers: [], confidence: 0.8, nextSteps: ['Run the generated tests locally'] });
const modelResponse = (value) => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });

test('specialists reject unapproved plans, malformed context, foreign origins and blocked dependencies', async () => {
  const h = harness(); const body = specialistPayload(h);
  for (const context of [null, {}, { ...body.context, planApproved: false }, { ...body.context, tasks: [null] }, { ...body.context, requirements: [null] }]) {
    assert.equal((await h.specialistRoute.POST(specialistRequest({ ...body, context }))).status, 400);
  }
  assert.equal((await h.specialistRoute.POST(specialistRequest(body, 'http://foreign.example'))).status, 403);
  assert.equal((await h.specialistRoute.POST(specialistRequest(body, 'invalid'))).status, 403);
  const dependent = body.context.tasks.find((t) => t.dependencies.length);
  assert.equal((await h.specialistRoute.POST(specialistRequest({ ...body, taskId: dependent.id }))).status, 400);
  assert.equal((await h.specialistRoute.POST(specialistRequest({ ...body, stage: 'review' }))).status, 400);
});

test('specialist retries invalid output once, keeps credentials server-side and normalizes approval', async () => {
  const h = harness(), body = specialistPayload(h);
  const oldFetch = global.fetch, key = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    assert.equal((await h.specialistRoute.POST(specialistRequest(body))).status, 503);
    process.env.OPENAI_API_KEY = 'test-only';
    let calls = 0;
    global.fetch = async (_url, options) => {
      calls++;
      const sent = JSON.parse(options.body);
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      assert.equal(sent.store, false);
      assert.equal(sent.text.format.strict, true);
      assert(sent.instructions.includes(body.context.tasks[0].ownerAgent));
      assert(!options.body.includes('test-only'));
      return modelResponse(calls === 1 ? { ...deliverable(), confidence: 4 } : { ...deliverable(), approved: 'approved' });
    };
    const response = await h.specialistRoute.POST(specialistRequest(body));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(calls, 2);
    assert.equal(result.output.retryCount, 1);
    assert.equal(result.output.approved, 'pending');
    assert.equal(result.output.taskId, body.taskId);
    for (const status of [401, 429]) {
      calls = 0;
      global.fetch = async () => { calls++; return Response.json({ secret: 'internal diagnostic' }, { status }); };
      const failure = await h.specialistRoute.POST(specialistRequest(body));
      assert.equal(failure.status, 502);
      assert.equal(calls, 1);
      assert(!(await failure.text()).includes('internal diagnostic'));
    }
    calls = 0;
    global.fetch = async () => { calls++; throw new DOMException('timeout', 'TimeoutError'); };
    assert.equal((await h.specialistRoute.POST(specialistRequest(body))).status, 502);
    assert.equal(calls, 2);
  } finally { global.fetch = oldFetch; if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; }
});

test('review validation requires exactly one review per output and cannot hide conflicts under pass', () => {
  const h = harness();
  const output = h.specialistSchema.normalizeSpecialist(deliverable(), 't1');
  const row = { outputId: output.id, result: 'pass', missingItems: [], conflicts: ['Schema mismatch'], suggestions: [] };
  assert.equal(h.specialistSchema.normalizeReviews({ reviews: [row] }, [output])[0].result, 'conflict');
  assert.throws(() => h.specialistSchema.normalizeReviews({ reviews: [] }, [output]));
  assert.throws(() => h.specialistSchema.normalizeReviews({ reviews: [{ ...row, outputId: 'invented' }] }, [output]));
  assert.throws(() => h.specialistSchema.normalizeReviews({ reviews: [row, row] }, [output, { ...output, id: 'other' }]));
});

async function restoredLiveHarness() {
  const source = harness(); planned(source);
  const oldWindow = global.window, oldStorage = global.localStorage;
  global.window = { setTimeout, clearTimeout };
  global.localStorage = { getItem: () => JSON.stringify({ version: 2, state: source.get(), mode: 'live' }) };
  try {
    const h = harness(); h.get(); h.effects()[0]();
    await new Promise((resolve) => setTimeout(resolve, 10));
    return h;
  } finally {
    if (oldWindow === undefined) delete global.window; else global.window = oldWindow;
    if (oldStorage === undefined) delete global.localStorage; else global.localStorage = oldStorage;
  }
}

test('live workflow passes prerequisite outputs, revises dependents and preserves unrelated approvals', async () => {
  const h = await restoredLiveHarness();
  const oldFetch = global.fetch;
  const calls = [];
  let failId = '', reviewFails = false;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.stage === 'review') {
      if (reviewFails) return Response.json({ error: 'Review unavailable' }, { status: 502 });
      return Response.json({ reviews: body.context.outputs.map((o) => ({ outputId: o.id, result: 'pass', missingItems: [], conflicts: [], suggestions: [] })) });
    }
    calls.push(body);
    if (body.taskId === failId) return Response.json({ error: 'Injected service failure' }, { status: 502 });
    const task = body.context.tasks.find((t) => t.id === body.taskId);
    for (const id of task.dependencies) assert(body.context.outputs.some((o) => o.taskId === id));
    return Response.json({ output: { ...deliverable(body.feedback ? `Rewritten deliverable: ${body.feedback}` : `Deliverable for ${body.taskId}`), id: `live-${calls.length}`, taskId: body.taskId, retryCount: 0 } });
  };
  try {
    await h.get().approveTaskPlan();
    assert.equal(h.calls.length, 0); // No mock specialist path in Live mode.
    assert(h.get().tasks.every((t) => t.state === 'completed'));
    approveAll(h);
    const root = h.get().tasks.find((t) => h.get().tasks.some((d) => d.dependencies.includes(t.id)));
    const affected = h.workflow.affectedTaskIds(h.get().tasks, [root.id]);
    const untouched = h.get().outputs.filter((o) => !affected.includes(o.taskId));
    h.get().requestRevision(h.get().outputs.find((o) => o.taskId === root.id).id);
    await h.get().submitFeedback('Use stable IDs and include keyboard navigation');
    assert.deepEqual(h.get().feedbackItems[0].affectedTasks, affected);
    assert.equal(h.get().feedbackItems[0].revisionStatus, 'applied');
    for (const id of affected) {
      const output = h.get().outputs.find((o) => o.taskId === id);
      assert(output.summary.includes('Use stable IDs'));
      assert.equal(output.approved, 'pending');
      assert(calls.some((c) => c.taskId === id && c.previousOutput && c.feedback));
    }
    for (const output of untouched) assert.equal(h.get().outputs.find((o) => o.id === output.id), output);
    assert.equal(h.get().canNavigate('final'), false);
    // Failure keeps the old deliverable for reference, and retry reuses feedback.
    failId = root.id;
    h.get().selectRevisionTasks([root.id]);
    await h.get().submitFeedback('Add error states');
    assert.equal(h.get().tasks.find((t) => t.id === root.id).state, 'failed');
    assert.equal(h.get().feedbackItems[0].revisionStatus, 'open');
    failId = '';
    await h.get().retryTask(root.id);
    await h.get().approveTaskPlan();
    assert.equal(h.get().feedbackItems[0].revisionStatus, 'applied');
    assert(h.get().outputs.find((o) => o.taskId === root.id).summary.includes('Add error states'));
    // Review failure cannot be represented as a successful AI review.
    reviewFails = true;
    await h.get().approveTaskPlan();
    assert.equal(h.get().reviews.length, 0);
    assert.match(h.get().workflowNotice, /Review unavailable/);
    assert.equal(h.get().canNavigate('final'), false);
    const output = h.get().outputs[0];
    h.get().approveOutput(output.id);
    assert.equal(h.get().outputs[0].approved, output.approved);
    reviewFails = false;
    await h.get().approveTaskPlan();
    assert.equal(h.get().reviews.length, h.get().outputs.length);
  } finally { global.fetch = oldFetch; }
});

test('AI demo keyword uses words and does not match availability', () => {
  const h = harness();
  assert(!h.mock.generateQuestions('A calendar showing availability').some((q) => q.prompt.includes('AI API')));
  assert(h.mock.generateQuestions('An AI study assistant').some((q) => q.prompt.includes('AI API')));
});

test('unresolved conflicts block approval and export until a clean review replaces them', async () => {
  const h = harness(); await executed(h);
  const output = h.get().outputs[0], review = h.get().reviews.find((r) => r.outputId === output.id);
  review.result = 'conflict'; review.conflicts = ['API/schema mismatch'];
  approveAll(h);
  assert.equal(h.get().outputs.find((o) => o.id === output.id).approved, 'pending');
  h.get().skipFeedback(); assert.notEqual(h.get().currentStep, 'final');
  assert.throws(() => h.exporter.planMarkdown(h.get()), /approval/);
  review.result = 'pass'; review.conflicts = [];
  h.get().approveOutput(output.id); h.get().approveOutputs(); h.get().skipFeedback();
  assert.equal(h.get().currentStep, 'final');
});

test('production access requires valid signed cookie and explicit consent', async () => {
  const h = harness(); const old = process.env.LIVE_ACCESS_CODE;
  process.env.LIVE_ACCESS_CODE = 'test-only-private-code';
  const access = (body) => new Request('https://localhost/api/live-access', { method: 'POST', body: JSON.stringify(body) });
  try {
    assert.equal((await h.route.POST(new Request('https://localhost/api/manager', { method: 'POST', body: '{}' }))).status, 401);
    assert.equal((await h.specialistRoute.POST(specialistRequest({}))).status, 401);
    assert.equal((await h.accessRoute.POST(access({ code: 'test-only-private-code', consent: false }))).status, 400);
    assert.equal((await h.accessRoute.POST(access({ code: 'wrong', consent: true }))).status, 401);
    const unlocked = await h.accessRoute.POST(access({ code: 'test-only-private-code', consent: true }));
    assert.equal(unlocked.status, 200);
    const cookie = unlocked.headers.get('set-cookie');
    assert(cookie.includes('HttpOnly') && cookie.includes('Secure') && cookie.includes('SameSite=Strict'));
    assert(!cookie.includes('test-only-private-code'));
    const status = await h.accessRoute.GET(new Request('https://localhost/api/live-access', { headers: { cookie: cookie.split(';')[0] } }));
    assert.equal((await status.json()).authenticated, true);
    const tampered = await h.accessRoute.GET(new Request('https://localhost/api/live-access', { headers: { cookie: cookie.replace(/\d/, '0').split(';')[0] } }));
    assert.equal((await tampered.json()).authenticated, false);
  } finally { if (old === undefined) delete process.env.LIVE_ACCESS_CODE; else process.env.LIVE_ACCESS_CODE = old; }
});

async function restoreState(raw, mode = 'demo') {
  const oldWindow = global.window, oldStorage = global.localStorage;
  const data = new Map([['projectpilot-v2', typeof raw === 'string' ? raw : JSON.stringify({ version: 2, state: raw, mode })]]);
  global.window = { setTimeout, clearTimeout };
  global.localStorage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  try {
    const h = harness(); h.get(); h.effects()[0](); await new Promise((resolve) => setTimeout(resolve, 10));
    return { h, data };
  } finally { if (oldWindow === undefined) delete global.window; else global.window = oldWindow; if (oldStorage === undefined) delete global.localStorage; else global.localStorage = oldStorage; }
}

test('invalid JSON, old formats and malformed saved collections keep recovery data and a usable session', async () => {
  for (const raw of ['{not valid JSON', JSON.stringify({ version: 1, state: {} }), JSON.stringify({ version: 2, state: { ...harness().get(), outputs: [null] } })]) {
    const { h, data } = await restoreState(raw);
    assert.equal(h.get().hydrated, true);
    assert.equal(h.get().project.id, '');
    assert.equal(data.get('projectpilot-recovery'), raw);
    h.get().startDemoProject(); assert(h.get().requirements.length > 0);
  }
});

test('delayed manager timeout preserves draft through restore and permits a successful retry', async () => {
  const { h } = await restoreState(harness().get(), 'live');
  const oldFetch = global.fetch, oldTimeout = AbortSignal.timeout, key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
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
  } finally { global.fetch = oldFetch; AbortSignal.timeout = oldTimeout; if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key; }
});

test('export retains edited text, dependency order, approval and rewritten feedback including special characters', async () => {
  const h = harness(); planned(h);
  const special = 'Store *course* and [minutes] with <validation> and `stable IDs`';
  h.get().editRequirement(h.get().requirements[0].id, special);
  h.get().toggleRequirement(h.get().requirements[0].id, 'approved'); h.get().approveRequirements();
  const first = h.get().tasks[0];
  assert.equal(h.get().editTask(first.id, { ...first, title: 'Store [sessions] safely', description: 'Use stable IDs and validate positive minutes' }), null);
  await h.get().approveTaskPlan(); approveAll(h);
  const output = h.get().outputs[0]; h.get().requestRevision(output.id);
  await h.get().submitFeedback('Add empty state and invalid minutes checks'); approveAll(h);
  h.get().approveOutputs(); h.get().skipFeedback();
  const md = h.exporter.planMarkdown(h.get());
  assert(md.includes(special));
  assert(md.includes('Store [sessions] safely'));
  assert(md.includes('Human approval: Approved'));
  assert(md.includes('Add empty state and invalid minutes checks (applied;'));
  assert(!md.includes('Revision requested:'));
  let previous = -1;
  for (const task of h.get().tasks) { const at = md.indexOf(`Task ID: ${task.id}`); assert(at > previous); for (const dep of task.dependencies) assert(md.indexOf(`Task ID: ${dep}`) < at); previous = at; }
  assert(md.includes(h.get().outputs.find((o) => o.taskId === output.taskId).summary));
});
