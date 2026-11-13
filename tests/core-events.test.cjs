/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// Evaluation log, usage accounting, metrics, labels and manual editing actions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, planned, executed, approveAll, notes, restoreState } = require('./helpers/workflow-harness.cjs');

const types = (h) => h.get().events.map((e) => e.type);
const count = (h, type) => h.get().events.filter((e) => e.type === type).length;

test('every human and agent decision writes one event with mode, timing and no invented model data in Demo', async () => {
  const h = harness();
  h.get().startDemoProject();
  assert.equal(types(h)[0], 'project_started');
  assert.equal(count(h, 'answer_drafted'), 5);
  assert(h.get().events.every((e) => e.mode === 'demo' && typeof e.id === 'string' && e.msSinceStart >= 0));
  const q = h.get().questions[1];
  h.get().updateAnswer(q.id, 'A'.repeat(14)); h.get().updateAnswer(q.id, 'A'.repeat(20));
  const edits = h.get().events.filter((e) => e.type === 'answer_edited');
  assert.equal(edits.length, 1, 'keystrokes on one answer collapse into one row');
  assert.equal(edits[0].before, q.answer);
  assert.equal(edits[0].after, 'A'.repeat(20));
  h.get().submitAnswers();
  assert.equal(count(h, 'requirement_drafted'), 8);
  const [first, second] = h.get().requirements;
  h.get().toggleRequirement(first.id, 'approved'); h.get().toggleRequirement(second.id, 'rejected');
  assert.equal(count(h, 'requirement_approved'), 1);
  assert.equal(count(h, 'requirement_rejected'), 1);
  for (const r of h.get().requirements) h.get().toggleRequirement(r.id, 'approved');
  h.get().editRequirement(first.id, 'First edit of the requirement');
  h.get().editRequirement(first.id, 'Second edit of the requirement');
  const reqEdits = h.get().events.filter((e) => e.type === 'requirement_edited');
  assert.equal(reqEdits.length, 2);
  assert.equal(reqEdits[0].before, first.text);
  assert.equal(reqEdits[1].before, first.text, 'the AI original survives repeated edits');
  assert.equal(reqEdits[1].after, 'Second edit of the requirement');
  h.get().toggleRequirement(first.id, 'approved'); h.get().approveRequirements();
  const task = h.get().tasks[0];
  assert.equal(h.get().editTask(task.id, { ...task, title: 'Renamed data model' }), null);
  assert.equal(count(h, 'task_edited'), 1);
  await h.get().approveTaskPlan();
  assert.equal(count(h, 'plan_approved'), 1);
  assert.equal(count(h, 'output_generated'), 7);
  assert.equal(count(h, 'review_completed'), 1);
  assert(h.get().events.filter((e) => e.type === 'output_generated').every((e) => e.provider === undefined && e.model === undefined && e.promptTokens === undefined));
  assert.deepEqual(h.get().usage, { requests: 0, promptTokens: 0, completionTokens: 0, totalLatencyMs: 0, models: [] });
  const output = h.get().outputs[0];
  h.get().approveOutput(output.id);
  assert.equal(count(h, 'output_approved'), 1);
  const edited = h.get().outputs[1];
  assert.equal(h.get().editOutputSummary(edited.id, 'Rewritten by a person with more detail'), null);
  const afterEdit = h.get().outputs.find((o) => o.id === edited.id);
  assert.equal(afterEdit.humanEdited, true);
  assert.equal(afterEdit.approved, 'pending');
  const outputEdit = h.get().events.find((e) => e.type === 'output_edited');
  assert.equal(outputEdit.before, edited.summary);
  assert.equal(outputEdit.after, 'Rewritten by a person with more detail');
  h.get().requestRevision(edited.id);
  assert.equal(count(h, 'output_rejected'), 1);
  h.get().approveOutputs();
  await h.get().submitFeedback('Clarify acceptance criteria');
  assert.equal(count(h, 'revision_requested'), 1);
  assert.equal(count(h, 'feedback_submitted'), 1);
  approveAll(h); h.get().approveOutputs(); h.get().skipFeedback();
  assert.equal(count(h, 'plan_finalized'), 1);
  h.get().setUsefulness(8); h.get().setUsefulness(42);
  assert.equal(count(h, 'usage_rated'), 1);
  assert.equal(h.get().events.at(-1).detail, '8/10');
});

test('failed tasks write run_failed with the error text; stopping is recorded in Demo too', async () => {
  const h = harness(); planned(h);
  const db = h.get().tasks.find((t) => t.ownerAgent === 'database');
  h.failures.add(db.id);
  await h.get().approveTaskPlan();
  const failed = h.get().events.filter((e) => e.type === 'run_failed');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].entityId, db.id);
  assert.match(failed[0].detail, /Injected test failure/);
});

test('event text is truncated to 2,000 characters and the log keeps only the newest 2,000 events', () => {
  const h = harness();
  h.get().startDemoProject(); h.get().submitAnswers();
  const events = h.load('session-events.ts');
  const long = 'x'.repeat(5000);
  let state = events.logEvents(h.get(), false, { type: 'answer_edited', before: long, after: long, detail: long });
  const last = state.events.at(-1);
  assert.equal(last.before.length, 2000);
  assert.equal(last.after.length, 2000);
  assert(last.detail.length <= 500);
  for (let i = 0; i < 2100; i++) state = events.logEvents(state, false, { type: 'usage_rated', detail: String(i) });
  assert.equal(state.events.length, 2000);
  assert.equal(state.events.at(-1).detail, '2099');
  assert.equal(h.get().events.length < 2000, true, 'logging is pure and never mutates the old state');
  const edit = events.logEvents({ ...h.get(), startedAt: Date.now() - 5000 }, true, { type: 'run_failed' }).events.at(-1);
  assert(edit.msSinceStart >= 5000 && edit.msSinceStart < 6000);
  assert.equal(edit.mode, 'live');
});

test('usage and event metadata come only from route meta; malformed meta is ignored', () => {
  const h = harness();
  const events = h.load('session-events.ts');
  const empty = h.workflow.EMPTY_USAGE;
  assert.equal(events.addUsage(empty, undefined), empty);
  assert.equal(events.addUsage(empty, { latencyMs: 'fast', promptTokens: -3 }), empty);
  const once = events.addUsage(empty, { provider: 'openrouter', model: 'm1', latencyMs: 400, promptTokens: 10, completionTokens: 5 });
  const twice = events.addUsage(once, { provider: 'openrouter', model: 'm1', latencyMs: 100, promptTokens: 1 });
  assert.deepEqual(twice, { requests: 2, promptTokens: 11, completionTokens: 5, totalLatencyMs: 500, models: ['openrouter/m1'] });
  const batch = events.logModelEvents(h.get(), true, [{ type: 'output_generated' }, { type: 'output_generated' }], { provider: 'p', model: 'm', promptTokens: 7 });
  assert.equal(batch.events[0].promptTokens, 7);
  assert.equal(batch.events[1].promptTokens, undefined, 'a call is counted once, on its first event');
  assert.equal(batch.usage.requests, 1);
});

test('saves from before the event log (v2 and v3) migrate to empty events and zero usage; saved events survive', async () => {
  const source = harness(); await executed(source);
  const legacy = { ...source.get() };
  delete legacy.events; delete legacy.usage;
  for (const version of [2, 3]) {
    const { h } = await restoreState(legacy, 'demo', version);
    assert.equal(h.get().project.id, legacy.project.id);
    assert.deepEqual(h.get().events, []);
    assert.deepEqual(h.get().usage, h.workflow.EMPTY_USAGE);
  }
  const withEvents = { ...source.get(), events: [...source.get().events, { nonsense: true }], usage: { requests: 2, promptTokens: 9, completionTokens: 1, totalLatencyMs: 30, models: ['a/b'] } };
  const { h } = await restoreState(withEvents, 'demo', 3);
  assert.equal(h.get().events.length, source.get().events.length, 'malformed events are dropped, valid ones kept');
  assert.equal(h.get().usage.promptTokens, 9);
  assert.equal(h.persistence.SAVE_VERSION, 3);
});

test('metrics count review findings in the issue rate and revision rounds from events and feedback', async () => {
  const h = harness(); await executed(h);
  // The real Demo specialists give the Testing output a blocker and low confidence, so the Review Agent flags it.
  const { tasks, project } = h.get();
  const realOutputs = [];
  for (const task of tasks) realOutputs.push(await h.mock.runAgentWithRetry(task, project, { stepMs: 0 }));
  const { reviews } = h.mock.reviewOutputs(realOutputs, tasks);
  assert(reviews.some((r) => r.result === 'flagged'));
  const measured = h.metrics.computeMetrics({ ...h.get(), outputs: realOutputs, reviews, usefulnessScore: null });
  assert.equal(measured.conflictRate, Number(((1 / realOutputs.length) * 100).toFixed(1)));
  assert.equal(h.get().metrics.conflictRate, 0, 'clean harness outputs have no findings');
  const calc = h.metrics;
  const base = { requirements: [], tasks: [], feedbackItems: [], startedAt: Date.now(), usefulnessScore: null };
  const out = (over) => ({ id: 'o', taskId: 't', summary: 's', assumptions: [], blockers: [], confidence: 0.9, nextSteps: [], retryCount: 0, approved: 'pending', ...over });
  const pass = { id: 'r', outputId: 'o', result: 'pass', missingItems: [], conflicts: [], suggestions: [] };
  assert.equal(calc.computeMetrics({ ...base, reviews: [pass], outputs: [out({})] }).conflictRate, 0);
  assert.equal(calc.computeMetrics({ ...base, reviews: [pass], outputs: [out({ blockers: ['b'] })] }).conflictRate, 100);
  assert.equal(calc.computeMetrics({ ...base, reviews: [pass], outputs: [out({ confidence: 0.79 })] }).conflictRate, 100);
  assert.equal(calc.computeMetrics({ ...base, reviews: [{ ...pass, missingItems: ['x'] }], outputs: [out({})] }).conflictRate, 100);
  assert.equal(calc.computeMetrics({ ...base, reviews: [{ ...pass, result: 'flagged' }], outputs: [out({})] }).conflictRate, 100);
  assert.equal(calc.computeMetrics({ ...base, reviews: [pass], outputs: [out({}), out({ id: 'p', blockers: ['b'] })] }).conflictRate, 50);
  assert.equal(calc.revisionRounds([], [], []), 0);
  assert.equal(calc.revisionRounds([], [{ type: 'revision_requested' }, { type: 'feedback_submitted' }], []), 1);
  assert.equal(calc.revisionRounds([], [{ type: 'feedback_submitted' }, { type: 'feedback_submitted' }], []), 2);
  assert.equal(calc.revisionRounds([{ revisionStatus: 'open' }, { revisionStatus: 'dismissed' }], [], []), 1);
  assert.equal(calc.revisionRounds([], [], [out({ approved: 'rejected' })]), 1, 'a requested revision counts even if feedback was skipped');
  h.get().requestRevision(h.get().outputs[1].id); h.get().approveOutputs();
  assert.equal(h.get().metrics.numberOfRevisions, 1);
  await h.get().submitFeedback('Clarify acceptance criteria');
  assert.equal(h.get().metrics.numberOfRevisions, 1);
});

test('manager log notes and handoffs print TASK-03 · Title, never raw ids; describeTaskIds hides unknown ids', async () => {
  const h = harness(); await executed(h);
  const tasks = h.get().tasks;
  assert.equal(h.workflow.taskLabel(tasks[2]), `TASK-03 · ${tasks[2].title}`);
  assert.equal(h.workflow.describeTaskIds([tasks[2].id, 'task-missing', tasks[0].id], tasks), `TASK-03 · ${tasks[2].title}; TASK-01 · ${tasks[0].title}`);
  assert.equal(h.workflow.describeTaskIds([], tasks), '');
  const log = notes(h);
  assert(log.length > 5);
  assert(!log.some((m) => /task-[a-z0-9]{7}/.test(m)), 'no raw task ids in the manager log');
  assert(log.some((m) => m.includes(`TASK-0${tasks[1].order} · ${tasks[1].title}`)));
});

test('prefilled demo answers are marked as suggestions so the Clarify banner is truthful', () => {
  const h = harness();
  const fixtures = h.load('demo-fixtures.ts');
  const questions = h.mock.generateQuestions('An AI study assistant');
  assert(fixtures.prefillDemoAnswers(questions).every((q) => q.suggested === true && q.answer.length >= 12));
  h.get().startDemoProject();
  assert(h.get().questions.every((q) => q.suggested === true));
  h.get().updateAnswer(h.get().questions[0].id, 'My own answer to this question');
  assert.equal(h.get().questions[0].suggested, false);
});

test('demo requirements carry 1-3 deterministic Given/When/Then criteria; none exceeds 4', () => {
  const h = harness();
  h.get().startDemoProject(); h.get().submitAnswers();
  const first = h.get().requirements;
  assert(first.every((r) => Array.isArray(r.acceptance) && r.acceptance.length >= 1 && r.acceptance.length <= 3));
  assert(first.every((r) => r.acceptance.every((a) => /^Given .*When .*Then /.test(a))));
  assert(first.filter((r) => r.priority === 'must').every((r) => r.acceptance.length === 3));
  const again = harness(); again.get().startDemoProject(); again.get().submitAnswers();
  assert.deepEqual(again.get().requirements.map((r) => r.acceptance), first.map((r) => r.acceptance));
});

test('manual actions: add and delete requirements, add tasks, edit the idea, startProject options', async () => {
  const h = harness(); planned(h);
  const approved = h.get().requirements.length;
  assert.match(h.get().addRequirement('short'), /12 characters/);
  assert.equal(h.get().addRequirement('Export the final plan as a document'), null);
  assert.equal(h.get().requirements.length, approved + 1);
  const added = h.get().requirements.at(-1);
  assert.equal(added.approvalStatus, 'pending');
  assert.equal(added.priority, 'should');
  assert(added.acceptance.length >= 1);
  assert.equal(h.workflow.requirementsReady(h.get()), false);
  assert(h.get().tasks.every((t) => t.state === 'needs_revision'));
  assert.equal(h.get().events.filter((e) => e.type === 'requirement_edited' && e.detail === 'added').length, 1);
  h.get().deleteRequirement(added.id);
  assert.equal(h.get().requirements.length, approved);
  assert(h.get().events.some((e) => e.type === 'requirement_rejected' && e.detail === 'deleted' && e.entityId === added.id));
  for (const r of h.get().requirements) h.get().toggleRequirement(r.id, 'approved');
  h.get().approveRequirements();
  const [db] = h.get().tasks;
  const draft = { title: 'Add seed data', description: 'Create sample rows for the demo', ownerAgent: 'database', dependencies: [db.id] };
  assert.match(h.get().addTask({ ...draft, dependencies: ['missing'] }), /existing/);
  assert.match(h.get().addTask({ ...draft, ownerAgent: 'manager' }), /specialist/);
  assert.equal(h.get().addTask(draft), null);
  const newTask = h.get().tasks.find((t) => t.title === 'Add seed data');
  assert.equal(newTask.order, 8);
  assert.equal(newTask.state, 'queued');
  assert.equal(h.get().planApproved, false);
  assert(h.get().staleTaskIds.includes(newTask.id));
  assert(h.get().events.some((e) => e.type === 'task_edited' && e.detail === 'added'));
  await h.get().approveTaskPlan();
  assert.equal(h.get().tasks.length, 8);
  assert(h.get().tasks.every((t) => t.state === 'completed'));
  assert.match(h.get().editIdea('tiny', 'Students'), /12 characters/);
  assert.match(h.get().editIdea('A different idea for a study planner', 'x'), /3 characters/);
  assert.equal(h.get().editIdea('A different idea for a study planner', 'Night-shift nurses'), null);
  assert.equal(h.get().project.targetUser, 'Night-shift nurses');
  assert.equal(h.get().planApproved, false, 'editing the idea reopens the plan');
  assert(h.get().outputs.every((o) => o.approved === 'pending'));
  assert(h.get().events.some((e) => e.type === 'answer_edited' && e.detail === 'idea'));
  assert.equal(h.get().editOutputSummary('missing', 'Some replacement text here'), 'Output not found.');
  assert.match(h.get().editOutputSummary(h.get().outputs[0].id, 'short'), /12 and/);

  const fresh = harness();
  fresh.get().startProject('A campus study group planner', 'Students', { rubric: `  ${'r'.repeat(5000)}  `, constitution: '   ' });
  assert.equal(fresh.get().project.rubric.length, 4000);
  assert.equal(fresh.get().project.constitution, undefined);
  fresh.get().reset();
  const trimmed = harness();
  trimmed.get().startProject('A campus study group planner', 'Students', { rubric: '  Must cite sources  ', constitution: ' Be kind ' });
  assert.equal(trimmed.get().project.rubric, 'Must cite sources');
  assert.equal(trimmed.get().project.constitution, 'Be kind');
});

test('the unused sensitive-upload acknowledgement is gone from the store', () => {
  const h = harness();
  assert.equal(h.get().ackSensitiveUpload, undefined);
  assert.equal('sensitiveUploadAck' in h.get(), false);
});
