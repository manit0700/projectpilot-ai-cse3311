// Keyboard-only browser smoke test in Demo mode. No AI provider is contacted.
// Target: PROJECTPILOT_URL (default http://localhost:3314). Set PLAYWRIGHT_CHANNEL=chrome
// to use an installed Chrome; by default Playwright's bundled Chromium and WebKit run.
// Results and optional slow-keyboard evidence are written under artifacts/ (git-ignored).
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.PROJECTPILOT_URL || 'http://localhost:3314';
const artifacts = process.env.PROJECTPILOT_ARTIFACTS_DIR || 'artifacts';
const channel = process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {};
const results = [];
const slow = process.env.SLOW_KEYBOARD === '1';
const evidenceDir = process.env.KEYBOARD_EVIDENCE_DIR || `${artifacts}/slow-keyboard`;
if (slow) await fs.mkdir(evidenceDir, { recursive: true });

// PROJECTPILOT_ENGINES=chromium limits the run to the Chromium-family browser (WebKit may not be installed).
const only = (process.env.PROJECTPILOT_ENGINES || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
for (const [name, engine, options] of [[channel.channel ? 'Chrome' : 'Chromium', chromium, channel], ['WebKit', webkit, {}]].filter(([n]) => !only.length || only.includes(n.toLowerCase()) || (only.includes('chromium') && n !== 'WebKit'))) {
  const browser = await engine.launch({ headless: true, ...options });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
    ...(slow ? { recordVideo: { dir: `${evidenceDir}/raw`, size: { width: 1440, height: 1000 } } } : {}),
  });
  const page = await context.newPage();
  const started = Date.now(), events = [];
  const note = (text) => { events.push({ seconds: (Date.now() - started) / 1000, text }); console.log(`${name}: ${text}`); };
  let corrections = 0, typedCharacters = 0, focusChecks = 0;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  let tabs = 0;
  async function focus(locator) {
    await locator.waitFor();
    for (let i = 0; i < 250; i++) {
      if (await locator.evaluate((el) => el === document.activeElement)) {
        const box = await locator.boundingBox();
        assert(box && box.height > 0);
        assert(await locator.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
          const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
          const top = document.elementFromPoint(x, y);
          return r.bottom > 0 && r.top < innerHeight && (top === el || el.contains(top));
        }), 'Focused control must be visible and not obscured');
        focusChecks++;

        assert(await locator.evaluate((el) => getComputedStyle(el).outlineStyle !== 'none' || getComputedStyle(el).boxShadow !== 'none'), 'Keyboard focus must be visible');
        return;
      }
      await page.keyboard.press('Tab'); tabs++;
      if (slow) await wait(55);
    }
    throw Error('Keyboard cannot reach ' + await locator.getAttribute('aria-label'));
  }
  async function activate(locator) { await focus(locator); if (slow) await wait(350); await page.keyboard.press('Enter'); }
  async function type(locator, value) {
    await focus(locator); await page.keyboard.press('ControlOrMeta+A');
    if (!slow) { await page.keyboard.insertText(value); return; }
    note(`Typing and correcting: ${await locator.getAttribute('aria-label') || await locator.getAttribute('name') || 'form field'}`);
    async function characters(text) {
      for (const character of text) {
        const delay = [160, 240, 180, 300, 220, 150][typedCharacters % 6];
        await page.keyboard.type(character, { delay }); typedCharacters++;
        if (character === ' ' && typedCharacters % 3 === 0) await wait(250);
      }
    }
    const word = value.match(/[A-Za-z]{5,}/);
    if (word) {
      const start = word.index, correct = word[0];
      const typo = correct.slice(0, 2) + correct[3] + correct[2] + correct.slice(4);
      await characters(value.slice(0, start)); await characters(typo); await wait(900);
      note(`Correcting a deliberate spelling mistake with Backspace`);
      for (let i = 0; i < typo.length; i++) { await page.keyboard.press('Backspace'); await wait(110); }
      await characters(correct); corrections++; await characters(value.slice(start + correct.length));
    } else await characters(value);
    assert.equal(await locator.inputValue(), value, 'Only corrected text may be submitted');
    await wait(500);
  }
  try {
    await page.goto(base);
    if (slow) { note('Automated keyboard test in Demo mode. Slow typing and deliberate corrections, not a student session.'); await wait(2000); }
    await type(page.getByRole('textbox', { name: 'Project idea', exact: true }), 'A calendar showing study availability and saved sessions');
    await type(page.getByRole('textbox', { name: 'Target user', exact: true }), 'Individual students');
    await activate(page.getByRole('button', { name: 'Start clarifying questions', exact: true }));
    await page.getByRole('heading', { name: 'Clarifying questions', exact: true }).waitFor();
    assert.equal(await page.getByText('Should the project use a live AI API or prepared responses first?', { exact: true }).count(), 0);
    assert(await page.getByText(/It does not affect agent decisions/).isVisible());
    const areas = page.locator('main textarea');
    for (let i = 0; i < await areas.count(); i++) await type(areas.nth(i), 'Use a small single-user study tracker with stable IDs and local storage.');
    await activate(page.getByRole('button', { name: 'Continue to requirements', exact: true }));
    await page.getByRole('heading', { name: 'Requirements summary', exact: true }).waitFor();
    await activate(page.getByRole('button', { name: /^Edit requirement/ }).first());
    await type(page.getByRole('textbox', { name: 'Requirement text' }), 'Save *course* and [minutes] with validation and stable IDs');
    await activate(page.getByRole('button', { name: 'Save requirement', exact: true }));
    if (slow) note('Requirements: edit, correct and approve using Tab and Enter');
    const approvals = page.getByRole('button', { name: /^Approve requirement \d+/ });
    for (let i = 0; i < await approvals.count(); i++) await activate(approvals.nth(i));
    await activate(page.getByRole('button', { name: /Approve requirements/ }));
    await activate(page.getByRole('button', { name: /^Edit task/ }).first());
    await type(page.getByRole('textbox', { name: 'Task title', exact: true }), 'Store [sessions] with stable IDs');
    await activate(page.getByRole('button', { name: 'Save task', exact: true }));
    await activate(page.getByRole('button', { name: 'Previous step', exact: true }));
    await activate(page.getByRole('button', { name: 'Continue to task plan', exact: true }));
    await activate(page.getByRole('button', { name: 'Approve plan & run agents', exact: true }));
    // The run stays on the board; the user opens review explicitly.
    await page.getByRole('heading', { name: 'Agent assignment board', exact: true }).waitFor({ timeout: 60000 });
    await activate(page.getByRole('button', { name: /Review collected outputs/ }));
    await page.getByRole('heading', { name: 'Review outputs', exact: true }).waitFor({ timeout: 60000 });
    if (slow) note('Review: inspect results, approve individual outputs and request a revision');
    const outputs = page.getByRole('button', { name: /^Approve output/ });
    for (let i = 1; i < await outputs.count(); i++) await activate(outputs.nth(i));
    await activate(page.getByRole('button', { name: /^Request revision/ }).first());
    await activate(page.getByRole('button', { name: 'Continue to feedback', exact: true }));
    await type(page.getByRole('textbox', { name: 'Feedback for the Manager Agent' }), 'Add error states for missing course and invalid minutes');
    await activate(page.getByRole('button', { name: 'Apply feedback', exact: true }));
    await page.getByRole('heading', { name: 'Review outputs', exact: true }).waitFor();
    for (let i = 0; i < await outputs.count(); i++) await activate(outputs.nth(i));
    await activate(page.getByRole('button', { name: 'Continue to feedback', exact: true }));
    await activate(page.getByRole('button', { name: /^Finalize approved plan/ }));
    await page.getByRole('heading', { name: 'Final project plan', exact: true }).waitFor();
    if (slow) note('Refresh recovery: corrected requirements, task edits and revisions must survive');
    await page.reload();
    await page.getByRole('heading', { name: 'Final project plan', exact: true }).waitFor();
    if (slow) note('Export: verify corrected text and revision content in the actual downloaded Markdown');
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
    if (slow) { note('PASS: corrected text, approvals, revision, export, reset cancellation and narrow layout'); await wait(3000); }
    results.push({ browser: name, keyboardOnly: 'passed', planningEditingReviewRevisionExport: 'passed', resetCancel: 'passed', refreshRecovery: 'passed', width320: 'passed', tabPresses: tabs, ...(slow ? { testType: 'automated slow keyboard simulation', spellingCorrections: corrections, typedCharacters, focusVisibilityChecks: focusChecks, durationSeconds: (Date.now() - started) / 1000 } : {}) });
  } catch (error) {
    if (slow) { note(`FAILED: ${error.message}`); await page.screenshot({ path: `${evidenceDir}/${name.toLowerCase()}-failure.png` }); }
    throw error;
  } finally {
    const video = page.video();
    await context.close();
    if (slow && video) {
      await video.saveAs(`${evidenceDir}/${name.toLowerCase()}-keyboard.webm`);
      await fs.writeFile(`${evidenceDir}/${name.toLowerCase()}-events.json`, JSON.stringify({ browser: name, testType: 'automated slow keyboard simulation', events }, null, 2));
    }
    await browser.close();
  }
}
await fs.mkdir(artifacts, { recursive: true });
await fs.writeFile(slow ? `${evidenceDir}/results.json` : `${artifacts}/peer-review-browser-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
