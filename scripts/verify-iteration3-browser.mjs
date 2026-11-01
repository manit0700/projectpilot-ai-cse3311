import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(process.env.PROJECTPILOT_URL || 'http://localhost:3313');
  await page.getByRole('button', { name: 'Run guided workflow' }).click();
  await page.getByRole('heading', { name: 'Requirements summary' }).waitFor();
  const approvals = page.getByRole('button', { name: 'Approve', exact: true });
  for (let i = 0; i < await approvals.count(); i++) await approvals.nth(i).click();
  await page.getByRole('button', { name: /Approve requirements/ }).click();
  await page.getByRole('button', { name: 'Approve plan & run agents' }).click();
  await page.getByRole('heading', { name: 'Review outputs', exact: true }).waitFor({ timeout: 60000 });
  assert((await page.getByText(/Demo checks complete/).textContent()).includes('Human approval'));
  assert.equal(await page.getByText('Review complete — no conflicts found.', { exact: true }).count(), 0);
  const outputApprovals = page.getByRole('button', { name: 'Approve output', exact: true });
  for (let i = 0; i < await outputApprovals.count(); i++) await outputApprovals.nth(i).click();
  await page.getByRole('button', { name: 'Continue to feedback' }).click();
  await page.getByRole('button', { name: 'Skip revisions & finalize approved plan' }).click();
  await page.getByRole('heading', { name: 'Final project plan', exact: true }).waitFor();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  const download = await downloadEvent;
  assert(download.suggestedFilename().endsWith('.md'));
  await page.reload();
  await page.getByRole('heading', { name: 'Final project plan', exact: true }).waitFor();
  await fs.mkdir('docs/iteration3-evidence', { recursive: true });
  await page.screenshot({ path: 'docs/iteration3-evidence/final-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/iteration3-evidence/final-mobile.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // Exercise the Live-mode UI with deterministic service responses. The separate
  // live smoke script verifies real provider calls without browser automation.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/specialist', async (route) => {
    const body = route.request().postDataJSON();
    const result = body.stage === 'review'
      ? { reviews: body.context.outputs.map((o) => ({ outputId: o.id, result: 'flagged', missingItems: ['Run generated tests'], conflicts: [], suggestions: [] })) }
      : { output: { id: `browser-${body.taskId}`, taskId: body.taskId, summary: `Updated implementation: ${body.feedback}`, assumptions: [], blockers: [], confidence: 0.8, nextSteps: ['Human testing'], retryCount: 0 } };
    await route.fulfill({ json: result });
  });
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('projectpilot-v2'));
    saved.mode = 'live'; saved.state.currentStep = 'review'; saved.state.project.status = 'review_pending';
    localStorage.setItem('projectpilot-v2', JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole('heading', { name: 'Review outputs', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Request revision', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continue to feedback' }).click();
  await page.getByRole('textbox', { name: 'Feedback for the Manager Agent' }).fill('Add visible retry error states');
  await page.getByRole('button', { name: 'Apply feedback', exact: true }).click();
  await page.getByRole('heading', { name: 'Review outputs', exact: true }).waitFor();
  assert(await page.getByText('Updated implementation: Add visible retry error states', { exact: true }).count() > 0);
  assert(await page.getByText(/AI review complete/).count() > 0);
  await page.screenshot({ path: 'docs/iteration3-evidence/live-revision-desktop.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: browser demo, approvals, export, refresh restore, mobile overflow, Live-mode revision UI (mock service), no uncaught errors');
} finally { await browser.close(); }
