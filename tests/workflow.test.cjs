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
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      const resolved = ['.ts', '.tsx'].map((ext) => base + ext).find(fs.existsSync);
      const exports = load(resolved);
      if (name !== './mock-ai') return exports;
      return { ...exports, runAgentWithRetry: async (task) => {
        calls.push(task.id);
        if (failures.has(task.id)) throw new Error('Injected test failure');
        return { id: `out-${task.id}-${calls.length}`, taskId: task.id, summary: `Mock output for ${task.title}`, assumptions: [], blockers: [], confidence: 0.9, nextSteps: [], retryCount: 0, approved: 'pending' };
      } };
    };
    new Function('require', 'module', 'exports', source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const root = path.resolve(__dirname, '../src/lib');
  const { ProjectStoreProvider } = load(path.join(root, 'store.tsx'));
  const get = () => { cursor = 0; return ProjectStoreProvider({ children: null }).props.value; };
  return { get, failures, calls, workflow: load(path.join(root, 'workflow.ts')), exporter: load(path.join(root, 'plan-export.ts')) };
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
