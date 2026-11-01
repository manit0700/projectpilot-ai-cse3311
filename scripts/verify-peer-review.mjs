import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.PROJECTPILOT_URL || 'http://localhost:3314';
const results = [];
for (const [name, engine, options] of [['Chrome', chromium, { channel: 'chrome' }], ['WebKit', webkit, {}]]) {
  const browser = await engine.launch({ headless: true, ...options });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  let tabs = 0;
  async function focus(locator) {
    await locator.waitFor();
    for (let i = 0; i < 250; i++) {
      if (await locator.evaluate((el) => el === document.activeElement)) {
        const box = await locator.boundingBox();
        assert(box && box.height > 0);
        assert(await locator.evaluate((el) => getComputedStyle(el).outlineStyle !== 'none' || getComputedStyle(el).boxShadow !== 'none'), 'Keyboard focus must be visible');
        return;
      }
      await page.keyboard.press('Tab'); tabs++;
    }
    throw Error('Keyboard cannot reach ' + await locator.getAttribute('aria-label'));
  }
  async function activate(locator) { await focus(locator); await page.keyboard.press('Enter'); }
  async function type(locator, value) { await focus(locator); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(value); }
  try {
    await page.goto(base);
    await type(page.getByRole('textbox', { name: 'Project idea', exact: true }), 'A calendar showing study availability and saved sessions');
    await type(page.getByRole('textbox', { name: 'Target user', exact: true }), 'Individual students');
    await activate(page.getByRole('button', { name: 'Start clarifying questions', exact: true }));
    await page.getByRole('heading', { name: 'Clarifying questions', exact: true }).waitFor();
    assert.equal(await page.getByText('Should the project use a live AI API or prepared responses first?', { exact: true }).count(), 0);
    assert(await page.getByText(/It does not affect agent decisions/).isVisible());
    const areas = page.locator('main textarea');
    for (let i = 0; i < await areas.count(); i++) await type(areas.nth(i), 'Use a small single-user study tracker with stable IDs and local storage.');
    await activate(page.getByRole('button', { name: 'Generate requirements', exact: true }));
    await page.getByRole('heading', { name: 'Requirements summary', exact: true }).waitFor();
    await activate(page.getByRole('button', { name: 'Edit', exact: true }).first());
    await type(page.getByRole('textbox', { name: 'Requirement text' }), 'Save *course* and [minutes] with validation and stable IDs');
    await activate(page.getByRole('button', { name: 'Save requirement', exact: true }));
    const approvals = page.getByRole('button', { name: 'Approve', exact: true });
    for (let i = 0; i < await approvals.count(); i++) await activate(approvals.nth(i));
    await activate(page.getByRole('button', { name: /Approve requirements/ }));
    await activate(page.getByRole('button', { name: 'Edit task', exact: true }).first());
    await type(page.getByRole('textbox', { name: 'Task title', exact: true }), 'Store [sessions] with stable IDs');
    await activate(page.getByRole('button', { name: 'Save task', exact: true }));
    await activate(page.getByRole('button', { name: 'Previous step', exact: true }));
    await activate(page.getByRole('button', { name: 'Continue to task plan', exact: true }));
    await activate(page.getByRole('button', { name: 'Approve plan & run agents', exact: true }));
    await page.getByRole('heading', { name: 'Review outputs', exact: true }).waitFor({ timeout: 60000 });
    await activate(page.getByRole('button', { name: 'Previous step', exact: true }));
    await page.getByRole('heading', { name: 'Agent assignment board', exact: true }).waitFor();
    await activate(page.getByRole('button', { name: 'Open review', exact: true }));
    const outputs = page.getByRole('button', { name: 'Approve output', exact: true });
    for (let i = 1; i < await outputs.count(); i++) await activate(outputs.nth(i));
    await activate(page.getByRole('button', { name: 'Request revision', exact: true }).first());
    await activate(page.getByRole('button', { name: 'Continue to feedback', exact: true }));
    await type(page.getByRole('textbox', { name: 'Feedback for the Manager Agent' }), 'Add error states for missing course and invalid minutes');
    await activate(page.getByRole('button', { name: 'Apply feedback', exact: true }));
    await page.getByRole('heading', { name: 'Review outputs', exact: true }).waitFor();
    for (let i = 0; i < await outputs.count(); i++) await activate(outputs.nth(i));
    await activate(page.getByRole('button', { name: 'Continue to feedback', exact: true }));
    await activate(page.getByRole('button', { name: 'Skip revisions & finalize approved plan', exact: true }));
    await page.getByRole('heading', { name: 'Final project plan', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Final project plan', exact: true }).waitFor();
    const downloading = page.waitForEvent('download');
    await activate(page.getByRole('button', { name: 'Download Markdown', exact: true }));
    const download = await downloading;
    const path = await download.path(), content = await fs.readFile(path, 'utf8');
    assert(content.includes('Save *course* and [minutes]'));
    assert(content.includes('Store [sessions] with stable IDs'));
    assert(content.includes('Add error states for missing course and invalid minutes'));
    assert(content.includes('Human approval: Approved'));
    // Native reset confirmation must also be usable without mouse input.
    page.once('dialog', (dialog) => dialog.dismiss());
    await activate(page.getByRole('button', { name: 'Reset', exact: true }));
    assert(await page.getByRole('heading', { name: 'Final project plan', exact: true }).isVisible());
    await page.setViewportSize({ width: 320, height: 800 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    results.push({ browser: name, keyboardOnly: 'passed', planningEditingReviewRevisionExport: 'passed', resetCancel: 'passed', refreshRecovery: 'passed', width320: 'passed', tabPresses: tabs });
  } finally { await browser.close(); }
}
await fs.mkdir('docs/iteration3-evidence', { recursive: true });
await fs.writeFile('docs/iteration3-evidence/peer-review-browser-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
