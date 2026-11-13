/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness for the TypeScript modules. */
// The workflow suite is split by area: tests/workflow-flow, workflow-export-metrics, workflow-live-routes,
// workflow-persistence, and the core-* files. All share tests/helpers/workflow-harness.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/workflow-harness.cjs');

test('the shared harness loads the real store and starts with an empty session', () => {
  const h = harness();
  const state = h.get();
  assert.equal(state.project.id, '');
  assert.deepEqual(state.events, []);
  assert.equal(state.usage.requests, 0);
});
