// Opt-in smoke test: invokes the configured server's live API (billable requests).
// Reads only the private reviewer code for server access; never prints secrets.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const base = process.env.PROJECTPILOT_URL || 'http://localhost:3313';
const project = { id: 'iteration3-self-check', title: 'ProjectPilot AI retry improvement', description: 'Improve ProjectPilot AI, a Next.js single-user student project planner. Specify a specialist retry button that preserves completed tasks and requires human approval for regenerated output.', targetUser: 'CSE 3311 student reviewers', approvedSummary: '', status: 'agents_running', createdAt: new Date().toISOString() };
const task = { id: 'retry-design', projectId: project.id, title: 'Design specialist retry states', description: 'Create a concise UI contract for failed specialist tasks in our ProjectPilot AI class project.', ownerAgent: 'frontend', dependencies: [], expectedOutput: 'A compact screen layout and state transitions for idle, running, failed and retry success; include keyboard behavior. No full application.', constraints: 'Keep the deliverable under 400 words.', state: 'in_progress', order: 1 };
const access = await fetch(`${base}/api/live-access`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: base }, body: JSON.stringify({ code: process.env.LIVE_ACCESS_CODE || '', consent: true }) });
assert.equal(access.status, 200, 'Live access failed. Configure LIVE_ACCESS_CODE locally to match the server.');
const cookie = access.headers.get('set-cookie')?.split(';')[0] || '';
const context = { project, requirements: [{ id: 'r1', projectId: project.id, text: 'Retry a failed specialist without losing unrelated successful outputs; regenerated outputs require approval.', priority: 'must', approvalStatus: 'approved' }], planApproved: true, tasks: [task], outputs: [] };
async function call(body) {
  const response = await fetch(`${base}/api/specialist`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: base, cookie }, body: JSON.stringify(body), signal: AbortSignal.timeout(65000) });
  const result = await response.json();
  assert.equal(response.status, 200, result.error || 'Request failed');
  return result;
}
const first = (await call({ stage: 'execute', taskId: task.id, context })).output;
assert(first.summary.length > 20);
assert.equal(first.approved, 'pending');
context.tasks[0].state = 'completed'; context.outputs = [first];
const review = await call({ stage: 'review', context });
assert.equal(review.reviews.length, 1);
assert.equal(review.reviews[0].outputId, first.id);
const revised = (await call({ stage: 'execute', taskId: task.id, context, previousOutput: first, feedback: 'Add a visible error message and explicitly describe focus returning to the Retry task button on failure.' })).output;
assert.notEqual(first.summary, revised.summary);
assert.equal(revised.approved, 'pending');
console.log(JSON.stringify({ liveSpecialist: 'passed', liveReview: 'passed', liveRevision: 'passed', project: project.title, initialCharacters: first.summary.length, revisedCharacters: revised.summary.length, reviewResult: review.reviews[0].result }, null, 2));
