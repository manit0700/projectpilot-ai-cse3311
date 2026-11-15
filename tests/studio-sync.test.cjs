/* eslint-disable @typescript-eslint/no-require-imports -- Node tests transpile the real TypeScript modules. */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const req = name => name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts')
    : name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts'))) : require(name);
  new Function('require', 'module', 'exports', output)(req, mod, mod.exports);
  return mod.exports;
}
const { readSavedPlan, planChanged, sendFindingsToPlanning } = load('src/lib/studio-sync.ts');
const { initialState } = load('src/lib/store-initial.ts');
const { serializeState, restoreSavedState, STORAGE_KEY } = load('src/lib/store-persistence.ts');

const store = new Map();
global.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
beforeEach(() => store.clear());

const task = (over) => ({ id: 't1', projectId: 'p1', title: 'Build the page', description: 'Create the page layout with real copy.', ownerAgent: 'frontend', dependencies: [], expectedOutput: 'Working HTML/CSS/JS', constraints: 'No external services', state: 'pending', order: 1, ...over });
function planningState(requirementText = 'Reject invalid minutes.') {
  const base = initialState();
  return {
    ...base,
    project: { ...base.project, id: 'p1', title: 'Study tracker', description: 'Track study sessions by course.', targetUser: 'Students', approvedSummary: 'A small study website', status: 'tasks_ready' },
    requirements: [{ id: 'r1', projectId: 'p1', text: requirementText, priority: 'must', approvalStatus: 'approved' }],
    tasks: [task()],
    currentStep: 'tasks',
  };
}
const save = (state, mode = 'demo') => localStorage.setItem(STORAGE_KEY, serializeState(state, mode));

test('Studio reads the saved planning project without any hand-off', () => {
  assert.equal(readSavedPlan(), null);
  save(planningState());
  const plan = readSavedPlan();
  assert.equal(plan.projectId, 'p1');
  assert(plan.plan.includes('Reject invalid minutes.'));
  assert(plan.plan.includes('Build the page'));
});

test('an unreadable or unapproved planning save gives no plan instead of throwing', () => {
  localStorage.setItem(STORAGE_KEY, '{not json');
  assert.equal(readSavedPlan(), null);
  const unapproved = planningState();
  unapproved.requirements = [{ ...unapproved.requirements[0], approvalStatus: 'pending' }];
  save(unapproved);
  assert.equal(readSavedPlan(), null);
});

test('planChanged ignores the id and time of each build and notices real plan edits', () => {
  save(planningState());
  const first = readSavedPlan();
  const again = readSavedPlan();
  assert.notEqual(first.id, again.id);
  assert.equal(planChanged(first, again), false);
  save(planningState('Reject invalid minutes and blank course names.'));
  assert.equal(planChanged(first, readSavedPlan()), true);
});

test('review findings are saved to the planning project as open feedback', () => {
  save(planningState(), 'live');
  assert.equal(sendFindingsToPlanning('  The contact form has no label.  ', 'p1'), null);
  const { state, mode } = restoreSavedState(localStorage.getItem(STORAGE_KEY), initialState());
  assert.equal(mode, 'live');
  assert.equal(state.feedbackItems.length, 1);
  assert.equal(state.feedbackItems[0].revisionStatus, 'open');
  assert.equal(state.feedbackItems[0].projectId, 'p1');
  assert(state.feedbackItems[0].userRequest.includes('The contact form has no label.'));
  assert.equal(state.requirements.length, 1, 'the rest of the project is untouched');
});

test('findings are refused when empty, for an older plan, or with no planning project', () => {
  assert.match(sendFindingsToPlanning('x', 'p1'), /planning project/i);
  save(planningState());
  assert.match(sendFindingsToPlanning('   ', 'p1'), /no review findings/i);
  assert.match(sendFindingsToPlanning('x', 'other-project'), /re-sync/i);
  assert.equal(restoreSavedState(localStorage.getItem(STORAGE_KEY), initialState()).state.feedbackItems.length, 0);
});

const { parsePlan, planSite, planDesignText, demoResult } = load('src/lib/studio-demo.ts');
const PLAN = 'Summary\n\nAPPROVED REQUIREMENTS\n\n- Reject invalid minutes.\n- Show a <b>total</b>.\n\nUSER-CONFIRMED TASK PLAN\n\n1. Build the page (frontend)\nCreate it.\nExpected: x\nConstraints: y\nDependencies: None\n\n2. Write docs (documentation)\nDocs.\nExpected: x\nConstraints: y\nDependencies: 1\n\nWebsite scope: static.';

test('demo website is built from the plan and changes when the plan changes', () => {
  const parsed = parsePlan(PLAN);
  assert.deepEqual(parsed.requirements, ['Reject invalid minutes.', 'Show a <b>total</b>.']);
  assert.deepEqual(parsed.tasks.map(t => [t.order, t.title, t.owner]), [['1', 'Build the page', 'frontend'], ['2', 'Write docs', 'documentation']]);
  const site = demoResult('build', 'Study tracker', PLAN).files;
  assert.match(site.html, /Study tracker/);
  assert.match(site.html, /Build the page/);
  assert.doesNotMatch(site.html, /<b>total<\/b>/, 'plan text is escaped');
  const changed = demoResult('build', 'Study tracker', PLAN.replace('Build the page', 'Build the calendar')).files;
  assert.notEqual(changed.html, site.html);
  assert.match(planDesignText('Study tracker', PLAN), /Reject invalid minutes/);
});

test('demo falls back to the prepared example only without a readable plan', () => {
  assert.match(demoResult('build', 'X', null).files.html, /Study Session Tracker/);
  assert.match(demoResult('build', 'X', 'no sections here').files.html, /Study Session Tracker/);
  assert.equal(planSite('X', PLAN).js.length > 0, true);
});
