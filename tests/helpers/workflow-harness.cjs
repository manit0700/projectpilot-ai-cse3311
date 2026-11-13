/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// Shared loader for the tests/workflow-*.test.cjs and tests/core-*.test.cjs files.
// Uses the existing TypeScript compiler to load the real store modules under Node's test runner.
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
      if (name.startsWith('@/lib/')) return load(path.resolve(__dirname, '../../src/lib', name.slice(6) + '.ts'));
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      const resolved = ['.ts', '.tsx'].map((ext) => base + ext).find(fs.existsSync);
      const exports = load(resolved);
      if (name !== './mock-ai') return exports;
      // The store's demo pacing (1.5 s per specialist step) is replaced so the suite stays fast.
      return { ...exports, demoPause: async () => {}, runAgentWithRetry: async (task) => {
        calls.push(task.id);
        if (failures.has(task.id)) throw new Error('Injected test failure');
        return { id: `out-${task.id}-${calls.length}`, taskId: task.id, summary: `UI API testing deliverable for ${task.title}`, assumptions: [], blockers: [], confidence: 0.9, nextSteps: [], retryCount: 0, approved: 'pending' };
      } };
    };
    new Function('require', 'module', 'exports', source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const root = path.resolve(__dirname, '../../src/lib');
  const { ProjectStoreProvider } = load(path.join(root, 'store.tsx'));
  const get = () => { cursor = 0; effects = []; return ProjectStoreProvider({ children: null }).props.value; };
  return { get, effects: () => effects, failures, calls, load: (name) => load(path.join(root, name)), workflow: load(path.join(root, 'workflow.ts')), exporter: load(path.join(root, 'plan-export.ts')), manager: load(path.join(root, 'manager-schema.ts')), mock: load(path.join(root, 'mock-ai.ts')), metrics: load(path.join(root, 'metrics.ts')), persistence: load(path.join(root, 'store-persistence.ts')), accessRoute: load(path.resolve(root, '../app/api/live-access/route.ts')), specialistRoute: load(path.resolve(root, '../app/api/specialist/route.ts')), specialistSchema: load(path.join(root, 'specialist-schema.ts')), route: load(path.resolve(root, '../app/api/manager/route.ts')) };
}
// The guided demo stops on Clarify with answers pre-filled; one submit drafts requirements.
function planned(h) {
  h.get().startDemoProject();
  h.get().submitAnswers();
  for (const r of h.get().requirements) h.get().toggleRequirement(r.id, 'approved');
  h.get().approveRequirements();
}
async function executed(h) { planned(h); await h.get().approveTaskPlan(); }
function approveAll(h) { for (const o of h.get().outputs) h.get().approveOutput(o.id); }
const notes = (h) => h.get().managerNotes.map((n) => n.message);
// Route tests must not depend on the developer's shell: every provider variable is set or
// removed explicitly and restored afterwards.
const PROVIDER_VARS = ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AI_PROVIDER'];
function setProviderEnv(values) {
  for (const name of PROVIDER_VARS) { if (values[name] === undefined) delete process.env[name]; else process.env[name] = values[name]; }
}
async function withProviderEnv(values, run) {
  const saved = Object.fromEntries(PROVIDER_VARS.map((name) => [name, process.env[name]]));
  setProviderEnv(values);
  try { return await run(); } finally { setProviderEnv(saved); }
}
const OPENAI_TEST_ENV = { OPENAI_API_KEY: 'test-only', AI_PROVIDER: 'openai' };
function specialistPayload(h, overrides = {}) {
  planned(h);
  const s = h.get();
  return { stage: 'execute', taskId: s.tasks[0].id, context: { ...s, planApproved: true }, ...overrides };
}
const specialistRequest = (body, origin = 'http://localhost') => new Request('http://localhost/api/specialist', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });
const deliverable = (summary = 'Concrete deliverable with implementation') => ({ summary, assumptions: [], blockers: [], confidence: 0.8, nextSteps: ['Run the generated tests locally'] });
const modelResponse = (value) => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
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
async function restoreState(raw, mode = 'demo', version = 3) {
  const oldWindow = global.window, oldStorage = global.localStorage;
  const data = new Map([['projectpilot-v2', typeof raw === 'string' ? raw : JSON.stringify({ version, state: raw, mode })]]);
  global.window = { setTimeout, clearTimeout };
  global.localStorage = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  try {
    const h = harness(); h.get(); h.effects()[0](); await new Promise((resolve) => setTimeout(resolve, 10));
    return { h, data };
  } finally { if (oldWindow === undefined) delete global.window; else global.window = oldWindow; if (oldStorage === undefined) delete global.localStorage; else global.localStorage = oldStorage; }
}

module.exports = { harness, planned, executed, approveAll, notes, setProviderEnv, withProviderEnv, OPENAI_TEST_ENV, specialistPayload, specialistRequest, deliverable, modelResponse, restoredLiveHarness, restoreState };
