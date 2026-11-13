/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// Run with: node --test tests/workflow-flow.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, planned, executed, approveAll, notes } = require('./helpers/workflow-harness.cjs');

test('normal input flow enforces requirements; editing preserves IDs and resets only edited approval', () => {
  const h = harness();
  h.get().startProject('A campus study group planner', 'Students');
  for (const q of h.get().questions) h.get().updateAnswer(q.id, '');
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

test('guided demo stops on Clarify with sample answers; one submit drafts requirements and logs the decisions', () => {
  const h = harness();
  h.get().startDemoProject();
  assert.equal(h.get().currentStep, 'questions');
  assert.equal(h.get().requirements.length, 0);
  assert.equal(h.get().questions.length, 5);
  assert(h.get().questions.every((q) => q.answer.length >= 12));
  assert(notes(h).some((m) => m === 'Asked 5 clarifying questions about users, scope, stack, auth, data source'));
  h.get().submitAnswers();
  assert.equal(h.get().currentStep, 'requirements');
  assert(notes(h).some((m) => /^Drafted 8 requirements from your answers/.test(m)));
  for (const r of h.get().requirements) h.get().toggleRequirement(r.id, 'approved');
  h.get().approveRequirements();
  const [db, api] = h.get().tasks;
  assert(notes(h).some((m) => m === `Ordered TASK-0${api.order} · ${api.title} after TASK-0${db.order} · ${db.title} because it depends on entity list with key fields and relationships`));
});

test('execution logs dispatch, shared context and review decisions and stays on the board until the user opens review', async () => {
  const h = harness(); await executed(h);
  assert.equal(h.get().currentStep, 'board');
  assert.equal(h.get().project.status, 'review_pending');
  const log = notes(h);
  assert(log.some((m) => /^Dispatched Database Agent: TASK-01 · Define data model, expected output entity list with key fields and relationships, 0 prerequisites$/.test(m)));
  assert(log.some((m) => m === 'Backend Agent received TASK-01 · Define data model output as shared context'));
  assert(log.some((m) => /^Database Agent completed TASK-01 · Define data model \(confidence 90%\)$/.test(m)));
  assert(log.some((m) => m === 'Review Agent passed 7 of 7 outputs; each output still needs your approval'));
  assert.equal(h.get().canNavigate('review'), true);
  h.get().goTo('review');
  assert.equal(h.get().currentStep, 'review');
  const second = h.get().outputs[1];
  h.get().requestRevision(second.id); h.get().approveOutputs();
  await h.get().submitFeedback('Clarify acceptance criteria');
  assert(notes(h).some((m) => m === `Feedback affects ${h.workflow.describeTaskIds([second.taskId], h.get().tasks)}`));
  assert(h.get().outputs[1].summary.startsWith('Revised API contract'));
  assert(h.get().outputs[1].summary.endsWith('Revision applied: Clarify acceptance criteria'));
});

test('mock specialists are deterministic: the testing agent times out once and retries, deliverables are structured', async () => {
  const h = harness(); planned(h);
  const { tasks, project } = h.get();
  const testing = tasks.find((t) => t.ownerAgent === 'testing'), database = tasks.find((t) => t.ownerAgent === 'database');
  const retries = [];
  const first = await h.mock.runAgentWithRetry(testing, project, { stepMs: 0, onRetry: (attempt) => retries.push(attempt) });
  const second = await h.mock.runAgentWithRetry(testing, project, { stepMs: 0 });
  assert.deepEqual(retries, [1]);
  assert.equal(first.retryCount, 1);
  assert.equal(first.confidence, second.confidence);
  assert.equal(first.confidence, 0.72);
  assert.deepEqual(first.blockers, ['Needs clearer acceptance criteria from user']);
  const db = await h.mock.runAgentWithRetry(database, project, { stepMs: 0, onRetry: () => retries.push('unexpected') });
  assert.deepEqual(retries, [1]);
  assert.equal(db.retryCount, 0);
  assert.equal(db.confidence, 0.9);
  for (const task of tasks) {
    const output = await h.mock.runAgentWithRetry(task, project, { stepMs: 0 });
    const lines = output.summary.split('\n');
    assert(lines.length >= 4 && lines.length <= 6, `${task.title} has ${lines.length} lines`);
    assert(!output.nextSteps.some((step) => /manager aggregation|Submit to Review Agent/i.test(step)));
  }
  const outputs = await Promise.all(tasks.map((t) => h.mock.runAgentWithRetry(t, project, { stepMs: 0 })));
  const { reviews } = h.mock.reviewOutputs(outputs, tasks);
  assert(reviews.every((r) => r.conflicts.length === 0));
  assert.equal(reviews.find((r) => r.outputId === outputs.find((o) => o.taskId === testing.id).id).result, 'flagged');
  const revised = h.mock.reviseAgentOutput(database, outputs[0], 'Add an index on projectId');
  assert(revised.summary.startsWith('Revised data model'));
  assert(!revised.summary.includes('UI/API plan updated'));
  assert(revised.summary.includes(outputs[0].summary));
  assert.equal(h.mock.DEMO_STEP_MS, 1500);
  for (const removed of ['runAllReadyAgents', 'applyFeedback', 'orderedReadyTasks', 'computeMetrics', 'topologicalOrder', 'buildApprovedSummary']) assert.equal(h.mock[removed], undefined);
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
  assert.match(h.exporter.planMarkdown(h.get()), /Draft export/, 'export stays a labelled draft while the conflict is open');
  review.result = 'pass'; review.conflicts = [];
  h.get().approveOutput(output.id); h.get().approveOutputs(); h.get().skipFeedback();
  assert.equal(h.get().currentStep, 'final');
});

test('demo drafts answers from the idea and user; edits are kept and never overwritten by a redraft', () => {
  const h = harness();
  h.get().startProject('A campus study group planner for finals week', 'Biology majors');
  const first = h.get().questions;
  assert(first.length >= 4 && first.every((q) => q.suggested && q.answer.trim().length >= 12));
  assert(first[0].answer.includes('Biology majors'), 'user answer is derived from the target user');
  assert(h.get().managerNotes.some((n) => /Drafted \d+ suggested answers/.test(n.message)));
  h.get().updateAnswer(first[1].id, 'My own answer about the matching feature');
  assert.equal(h.get().questions[1].suggested, false);
  h.get().suggestAnswers();
  const after = h.get().questions;
  assert.equal(after[1].answer, 'My own answer about the matching feature');
  assert(after.filter((q, i) => i !== 1).every((q) => q.suggested));
  h.get().submitAnswers();
  assert.equal(h.get().currentStep, 'requirements');
  h.get().suggestAnswers();
  assert(h.get().questions.every((q) => q.answer.length > 0), 'no change once requirements exist');
});
