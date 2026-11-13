/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// Run with: node --test tests/workflow-export-metrics.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, planned, executed, approveAll } = require('./helpers/workflow-harness.cjs');

test('export rejects unapproved state, includes approved data and labels estimates', async () => {
  const h = harness(); await executed(h);
  // Before approval the exporter writes a labelled draft instead of a final plan.
  assert.match(h.exporter.planMarkdown(h.get()), /Draft export/);
  approveAll(h); h.get().approveOutputs(); h.get().skipFeedback();
  const markdown = h.exporter.planMarkdown(h.get());
  for (const label of ['Approved requirements', 'Ordered task plan', 'Approved agent outputs', 'Testing / acceptance information', 'Documentation information', 'Planning time (measured)', 'User usefulness rating: Not rated', 'Acceptance:']) assert(markdown.includes(label));
  assert(!markdown.includes('Estimated planning time saved'));
  assert(markdown.includes('TASK-01 · ' + h.get().tasks[0].title));
  assert(!markdown.includes(h.get().tasks[0].id), 'exports never print raw task ids');
  assert(markdown.includes(h.get().outputs[0].summary));
  h.get().setUsefulness(8);
  assert(h.exporter.planMarkdown(h.get()).includes('User usefulness rating: 8/10'));
});

test('metrics are measured or counted, never estimated; usefulness stays unrated until the user rates', async () => {
  const h = harness(); await executed(h);
  const before = h.get().metrics;
  assert.equal(before.usefulnessScore, null);
  assert.equal('planningTimeSavedMinutes' in before, false);
  assert.equal(typeof before.planningElapsedMinutes, 'number');
  assert.equal(before.taskCompletionRate, 100);
  const twoMinutesAgo = Date.now() - 2 * 60000;
  const measured = h.metrics.computeMetrics({ ...h.get(), startedAt: twoMinutesAgo, usefulnessScore: null });
  assert(measured.planningElapsedMinutes >= 2 && measured.planningElapsedMinutes < 2.2);
  const frozen = h.metrics.computeMetrics({ ...h.get(), startedAt: twoMinutesAgo, completedAt: twoMinutesAgo + 30000, usefulnessScore: 9 });
  assert.equal(frozen.planningElapsedMinutes, 0.5);
  assert.equal(frozen.usefulnessScore, 9);
  h.get().setUsefulness(42); assert.equal(h.get().metrics.usefulnessScore, null);
  h.get().setUsefulness(6); assert.equal(h.get().metrics.usefulnessScore, 6);
  approveAll(h); h.get().approveOutputs(); h.get().skipFeedback();
  assert.equal(typeof h.get().completedAt, 'number');
  h.get().reset(); assert.equal(h.get().metrics.usefulnessScore, null);
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
  for (const task of h.get().tasks) { const at = md.indexOf(`### ${h.workflow.taskLabel(task)}`); assert(at > previous); for (const dep of task.dependencies) assert(md.indexOf(`### ${h.workflow.taskLabel(h.get().tasks.find((t) => t.id === dep))}`) < at); previous = at; }
  assert(md.includes(h.get().outputs.find((o) => o.taskId === output.taskId).summary));
});
