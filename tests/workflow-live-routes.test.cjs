/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// Run with: node --test tests/workflow-live-routes.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, approveAll, setProviderEnv, withProviderEnv, OPENAI_TEST_ENV, specialistPayload, specialistRequest, deliverable, modelResponse, restoredLiveHarness } = require('./helpers/workflow-harness.cjs');

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

test('live API integration parses structured output and returns sanitized errors', () => withProviderEnv({}, async () => {
  const h = harness();
  const originalFetch = global.fetch;
  const request = () => new Request('http://localhost/api/manager', { method: 'POST', body: JSON.stringify({ stage: 'questions', context: { project: { id: 'p', description: 'Study planner' } } }) });
  try {
    assert.equal((await h.route.POST(request())).status, 503);
    setProviderEnv(OPENAI_TEST_ENV);
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
  }
}));

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

test('specialist retries invalid output once, keeps credentials server-side and normalizes approval', () => withProviderEnv({}, async () => {
  const h = harness(), body = specialistPayload(h);
  const oldFetch = global.fetch;
  try {
    assert.equal((await h.specialistRoute.POST(specialistRequest(body))).status, 503);
    setProviderEnv(OPENAI_TEST_ENV);
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
  } finally { global.fetch = oldFetch; }
}));

test('review validation requires exactly one review per output and cannot hide conflicts under pass', () => {
  const h = harness();
  const output = h.specialistSchema.normalizeSpecialist(deliverable(), 't1');
  const row = { outputId: output.id, result: 'pass', missingItems: [], conflicts: ['Schema mismatch'], suggestions: [] };
  assert.equal(h.specialistSchema.normalizeReviews({ reviews: [row] }, [output])[0].result, 'conflict');
  assert.throws(() => h.specialistSchema.normalizeReviews({ reviews: [] }, [output]));
  assert.throws(() => h.specialistSchema.normalizeReviews({ reviews: [{ ...row, outputId: 'invented' }] }, [output]));
  assert.throws(() => h.specialistSchema.normalizeReviews({ reviews: [row, row] }, [output, { ...output, id: 'other' }]));
});

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

test('production access requires valid signed cookie and explicit consent', async () => {
  const h = harness(); const old = process.env.LIVE_ACCESS_CODE;
  process.env.LIVE_ACCESS_CODE = 'test-only-private-code';
  // Browsers always send Origin on POST; the route refuses requests without it.
  const access = (body) => new Request('https://localhost/api/live-access', { method: 'POST', headers: { origin: 'https://localhost' }, body: JSON.stringify(body) });
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
