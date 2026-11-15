/* eslint-disable @typescript-eslint/no-require-imports -- Node tests transpile the real TypeScript module. */
// LIVE_ACCESS_OPEN is an explicit opt-in that runs Live without an access code. The default stays closed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative, env = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  const req = (name) => {
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', env);
    if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), env);
    return require(name);
  };
  new Function('require', 'module', 'exports', 'process', 'fetch', output)(req, mod, mod.exports, { env }, global.fetch);
  return mod.exports;
}
const LIVE = 'src/lib/live-access.ts';
const request = (cookie) => new Request('https://example.test/api/manager', { method: 'POST', headers: cookie ? { cookie } : {} });
const production = { NODE_ENV: 'production' };
const strongCode = 'a-long-private-access-code-123';

test('production fails closed with no code and no opt-in', async () => {
  const { hasLiveAccess, requireLiveAccess, unlockLive, liveAccessOpen } = load(LIVE, production);
  assert.equal(liveAccessOpen(), false);
  assert.equal(hasLiveAccess(request()), false);
  assert.equal(requireLiveAccess(request()).status, 503);
  assert.equal(unlockLive('x', true, request()).status, 503);
});
test('LIVE_ACCESS_OPEN=true opens production without a code, but consent is still required to unlock', async () => {
  const { hasLiveAccess, requireLiveAccess, unlockLive, liveAccessEnabled, liveAccessConfigured } = load(LIVE, { ...production, LIVE_ACCESS_OPEN: 'true' });
  assert.equal(hasLiveAccess(request()), true);
  assert.equal(requireLiveAccess(request()), null);
  assert.equal(liveAccessEnabled(), false, 'the UI shows a consent-only form');
  assert.equal(liveAccessConfigured(), false);
  assert.equal(unlockLive(undefined, false, request()).status, 400);
  const ok = unlockLive(undefined, true, request());
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { authenticated: true });
});
test('open mode ignores a stored code, and removing the flag restores the gate', async () => {
  const open = load(LIVE, { ...production, LIVE_ACCESS_OPEN: ' TRUE ', LIVE_ACCESS_CODE: strongCode });
  assert.equal(open.hasLiveAccess(request()), true);
  assert.equal(open.unlockLive('wrong', true, request()).status, 200, 'a wrong code is not checked while open');
  const closed = load(LIVE, { ...production, LIVE_ACCESS_CODE: strongCode });
  assert.equal(closed.hasLiveAccess(request()), false);
  assert.equal(closed.requireLiveAccess(request()).status, 401);
  assert.equal(closed.unlockLive('wrong', true, request()).status, 401);
  assert.equal(closed.unlockLive(strongCode, true, request()).status, 200);
  assert.equal(closed.liveAccessEnabled(), true);
});
test('only the exact value true opens the gate', async () => {
  for (const value of ['', 'false', '1', 'yes', 'on', 'truee']) {
    const { hasLiveAccess, liveAccessOpen } = load(LIVE, { ...production, LIVE_ACCESS_OPEN: value, LIVE_ACCESS_CODE: strongCode });
    assert.equal(liveAccessOpen(), false, `value '${value}'`);
    assert.equal(hasLiveAccess(request()), false);
  }
});
