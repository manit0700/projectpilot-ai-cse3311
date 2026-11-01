// Browser recovery check against the unchanged manager handler's real 55s deadline.
// Only the upstream provider is stubbed. This makes no billable model request.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const ts = require('typescript');
const base = process.env.PROJECTPILOT_URL || 'https://projectpilot-ai-cse3311.vercel.app';
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} }; cache.set(filename, loadedModule);
  const source = ts.transpileModule(fsSync.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = (name) => name.startsWith('@/') ? load(path.resolve('src', name.slice(2) + '.ts')) : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : require(name);
  new Function('require', 'module', 'exports', source)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { POST } = load(path.resolve('src/app/api/manager/route.ts'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const originalFetch = globalThis.fetch, originalKey = process.env.OPENAI_API_KEY;
const brief = 'A study tracker that saves course names and positive study minutes locally';
let delayed = true, upstreamCalls = 0, abortObserved = false, started;
try {
  const access = await page.request.post(`${base}/api/live-access`, { data: { code: process.env.LIVE_ACCESS_CODE || '', consent: true } });
  assert.equal(access.status(), 200, 'Private reviewer access must be configured for the selected server');
  process.env.OPENAI_API_KEY = 'test-only-not-a-provider-key';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); upstreamCalls++;
    if (!delayed) return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ items: [{ prompt: 'Which study session fields should be stored?', why: 'Define the record format' }] }) }] }] });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(Response.json({ status: 'completed', output: [] })), 60000);
      const abort = () => { clearTimeout(timer); abortObserved = true; reject(new DOMException('Stub provider aborted at the production timeout', 'TimeoutError')); };
      if (options.signal.aborted) abort(); else options.signal.addEventListener('abort', abort, { once: true });
    });
  };
  await page.route('**/api/manager', async (route) => {
    const incoming = route.request();
    const response = await POST(new Request(incoming.url(), { method: 'POST', headers: await incoming.allHeaders(), body: incoming.postData() }));
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  await page.goto(base);
  await page.getByRole('combobox', { name: 'Agent mode' }).selectOption('live');
  await page.getByRole('textbox', { name: 'Project idea', exact: true }).fill(brief);
  await page.getByRole('textbox', { name: 'Target user', exact: true }).fill('Individual students');
  started = performance.now();
  await page.getByRole('button', { name: 'Start clarifying questions', exact: true }).click();
  console.log('Waiting for the actual 55-second handler deadline; no timeout scaling.');
  await page.getByText(/Manager timed out or returned an invalid plan/).waitFor({ timeout: 70000 });
  const elapsedSeconds = (performance.now() - started) / 1000;
  assert(abortObserved); assert(elapsedSeconds >= 54.5 && elapsedSeconds < 67);
  assert.equal(await page.getByRole('textbox', { name: 'Project idea', exact: true }).inputValue(), brief);
  assert(await page.getByRole('button', { name: 'Start clarifying questions', exact: true }).isEnabled());
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('projectpilot-v2')));
  assert.equal(saved.state.draftBrief.idea, brief);
  await fs.mkdir('docs/iteration3-evidence/full-timeout', { recursive: true });
  await page.screenshot({ path: 'docs/iteration3-evidence/full-timeout/error-preserved-input.png' });
  await page.reload();
  await page.getByRole('textbox', { name: 'Project idea', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Project idea', exact: true }).inputValue(), brief);
  delayed = false;
  await page.getByRole('button', { name: 'Start clarifying questions', exact: true }).click();
  await page.getByRole('heading', { name: 'Clarifying questions', exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Which study session fields should be stored?', exact: true }).waitFor();
  assert(await page.getByRole('textbox', { name: 'Which study session fields should be stored?', exact: true }).isVisible());
  assert.equal(upstreamCalls, 2);
  const result = { result: 'passed', testType: 'automated browser test with actual local manager handler and stub upstream', deadlineScaled: false, providerDelayMs: 60000, handlerDeadlineMs: 55000, observedSeconds: Number(elapsedSeconds.toFixed(2)), abortObserved, inputPreserved: true, refreshPreserved: true, retrySucceeded: true, billableRequests: 0, recordedAt: new Date().toISOString() };
  await fs.writeFile('docs/iteration3-evidence/full-timeout/results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  await browser.close();
}
