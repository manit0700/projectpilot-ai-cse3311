import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const calls = [];
let failure = false, authenticated = true, githubDown = false;
await page.route('**/api/live-access', route => route.fulfill({ json: { authenticated, enabled: true } }));
// Studio sees a configured OpenRouter server; the planning app keeps its demo default.
await page.route('**/api/manager', route => route.request().method() === 'GET'
  ? route.fulfill({ json: page.url().includes('/studio') ? { configured: true, provider: 'openrouter', studioProvider: 'openrouter', studioConfigured: true } : { configured: false, provider: 'openai', studioProvider: 'openrouter', studioConfigured: false } })
  : route.continue());
await page.route('**/api/studio', async route => {
  const input = route.request().postDataJSON(); calls.push(input);
  if (failure) return route.fulfill({ status: 502, json: { error: 'Free-model limit reached. Retry later.' } });
  const result = input.stage === 'plan' ? { text: 'Build a portfolio with a title, project cards and working contact button.', model: 'test:free' }
    : input.stage === 'review' ? { text: 'Developer: improve the title clarity. Source review only; not executed.', model: 'test:free' }
    : { files: { html: '<h1>Agent-built portfolio</h1><button id="action">Contact</button><p id="result"></p>', css: 'body{font-family:system-ui;padding:24px;color:#163d35}h1{font-size:40px}', js: 'document.querySelector("#action").onclick=()=>document.querySelector("#result").textContent="Contact clicked"' }, model: 'test:free' };
  if (input.live) {
    const text = input.stage === 'build' ? JSON.stringify(result.files) : result.text;
    return route.fulfill({ contentType: 'text/event-stream', body: [{type:'started',model:'test:free'}, {type:'delta',text,model:'test:free'}, {type:'result',result}].map(e => 'data: '+JSON.stringify(e)+'\n\n').join('') });
  }
  await route.fulfill({ json: result });
});
await page.route('**/api/studio/github', async route => {
  if (githubDown) return route.fulfill({ status: 503, json: { error: 'Configure GITHUB_MCP_TOKEN and GITHUB_MCP_REPOSITORY on the server.' } });
  const input = route.request().postDataJSON();
  await route.fulfill({ json: { repository: 'owner/repo', connected: true, ...(input.action === 'publish' ? { url: 'https://github.com/owner/repo/pull/42', branch: 'projectpilot/test' } : {}) } });
});
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
try {
  const root = process.env.PROJECTPILOT_URL || 'http://localhost:3314';
  await page.goto(root + '/studio');
  await page.getByRole('link', {name:'Start with idea confirmation',exact:true}).waitFor();
  await page.getByText('DEMO · prepared output', { exact: true }).waitFor();
  // Consent gate: the server says authenticated + configured, but this tab has not accepted the data-sharing notice.
  assert.equal(await page.getByText(/^LIVE · /).count(), 0, 'fresh tab stays in demo until the user opts in');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('projectpilot-live-consent')), null);
  assert((await page.getByRole('status').filter({ hasText: 'Demo mode' }).count()) > 0);
  assert.equal(await page.getByText('Free tiers only').count(), 0, 'no unconditional free-tier claim');
  assert((await page.locator('meta[name="description"]').getAttribute('content')).length > 60, 'studio page has a real description');
  await page.getByText('Unlock live agents', { exact: true }).click();
  assert(await page.getByRole('button', { name: 'Activate Live API' }).isDisabled(), 'live stays off until consent is ticked');
  await page.getByText('Unlock live agents', { exact: true }).click();
  const designButton = page.getByRole('button',{name:'Design the website from this plan',exact:true});
  assert(await designButton.isDisabled());
  assert(await designButton.getAttribute('aria-describedby'), 'disabled buttons explain themselves');
  await page.getByText('Confirm your idea in planning first', { exact: true }).waitFor();
  await page.goto(root);
  await page.getByRole('button',{name:'Run guided workflow',exact:true}).click();
  await page.getByRole('heading',{name:'Clarifying questions',exact:true}).waitFor();
  await page.getByRole('button',{name:'Continue to requirements',exact:true}).click();
  await page.getByRole('heading',{name:'Requirements summary',exact:true}).waitFor();
  await page.getByRole('button',{name:/^Approve all/}).click();
  await page.getByRole('button',{name:/Approve requirements/}).click();
  await page.getByRole('heading',{name:'Task breakdown',exact:true}).waitFor();
  await page.getByRole('button',{name:'Confirm idea & open Website Studio',exact:true}).click();
  await page.getByRole('button',{name:'Import confirmed idea',exact:true}).click();
  await page.getByText(/Confirmed project:/).waitFor();
  await page.getByText('Saved in this browser', { exact: true }).waitFor();
  await page.getByText('Show imported requirements & tasks', { exact: true }).click();
  await page.getByLabel('Imported requirements & tasks').waitFor();
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Say hello' }).click();
  await frame.getByText('Hello! Your website is ready to make your own.').waitFor();
  await page.getByRole('textbox', { name: 'Edit HTML', exact: true }).fill('<h1>My manual edit</h1>');
  await page.getByRole('button', { name: 'Apply edits', exact: true }).click();
  await frame.getByRole('heading', { name: 'My manual edit' }).waitFor();
  await page.getByText('Edit page text without code', { exact: true }).click();
  await page.getByLabel('H1 text', { exact: true }).fill('Edited without code');
  await page.getByRole('button', { name: 'Apply edits', exact: true }).click();
  await frame.getByRole('heading', { name: 'Edited without code' }).waitFor();
  await page.getByRole('button', { name: 'Save version', exact: true }).click();
  const saved = page.getByRole('status').filter({ hasText: /Version \d+ saved/ });
  await saved.waitFor();
  assert.equal(await saved.getAttribute('aria-live'), 'polite');
  const brief = await page.getByLabel('Project brief').inputValue();
  assert(brief.split('\n')[0] !== brief.split('\n')[1] && !/^.{1,60}(\.\.\.|…)\n/.test(brief), 'brief does not start with a repeated truncated title');
  // Demo path: prepared design, build and review with no model requests.
  await designButton.click();
  await page.getByLabel('Review and edit the website design').waitFor();
  await page.getByRole('button', { name: 'Approve design & build', exact: true }).click();
  const complete = page.getByText(/The bounded build and source-review cycle is complete/);
  await complete.first().waitFor();
  assert.equal(calls.length, 0, 'demo path sends no model requests');
  await frame.getByRole('heading', { name: 'Study Session Tracker' }).waitFor();
  const banner = page.getByTestId('prepared-example-banner');
  await banner.getByText('Prepared example, not built from your brief', { exact: true }).waitFor();
  assert((await banner.boundingBox()).y < (await page.locator('iframe').boundingBox()).y, 'banner sits above the preview');
  assert((await banner.textContent()).includes('not generated from your project'), 'banner names the imported project honestly');
  assert.equal(await page.getByText(/^LIVE · /).count(), 0, 'demo run did not switch to live');
  assert((await page.getByRole('log', { name: 'Agent handoffs' }).textContent()).includes('Demo · prepared output'));
  await page.getByRole('region',{name:'Agent activity'}).getByText('Completed',{exact:true}).nth(2).waitFor();
  // Live path with mocked SSE responses.
  await page.reload();
  await page.getByText('DEMO · prepared output', { exact: true }).waitFor();
  assert.equal(await page.getByText(/^LIVE · /).count(), 0, 'reload without consent stays demo');
  await page.getByText('Unlock live agents', { exact: true }).click();
  await page.getByLabel('Live access code').fill('test-code');
  await page.getByLabel(/I understand what will be shared/).check();
  await page.getByRole('button', { name: 'Activate Live API' }).click();
  await page.getByText('LIVE · OpenRouter', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('projectpilot-live-consent')), '1');
  assert.equal(calls.length, 0, 'no model request happened before consent');
  await page.reload();
  await page.getByText('LIVE · OpenRouter', { exact: true }).waitFor();
  await frame.getByRole('heading', { name: 'Study Session Tracker' }).waitFor();
  await designButton.click();
  await page.waitForFunction(() => [...document.querySelectorAll('textarea')].some(t => t.value.startsWith('Build a portfolio with a title')));
  await page.getByRole('button', { name: 'Approve design & build', exact: true }).click();
  await complete.nth(1).waitFor();
  assert.deepEqual(calls.map(c => c.stage), ['plan', 'build', 'review', 'build', 'review']);
  assert(calls[3].feedback.includes('improve the title'));
  assert(calls.every(c => c.live === true));
  await page.getByRole('region',{name:'Agent activity'}).getByText('Completed',{exact:true}).first().waitFor();
  assert((await page.getByLabel('Live agent response').textContent()).includes('improve the title'));
  await frame.getByRole('button', { name: 'Contact', exact: true }).click();
  await frame.getByText('Contact clicked', { exact: true }).waitFor();
  await page.getByLabel('Ask for a change').fill('Add a student project list');
  await page.getByLabel('Automatic review rounds').selectOption('0');
  await page.getByRole('button', { name: 'Revise with agents' }).click();
  await page.getByRole('button', { name: 'Revise with agents' }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('textarea[placeholder^="Make the header"]').value === '');
  assert.equal(calls[5].feedback, 'Add a student project list');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download website', exact: true }).click();
  const download = await downloadPromise; assert.equal(download.suggestedFilename(), 'projectpilot-website.html');
  const downloaded = await fs.readFile(await download.path(), 'utf8');
  assert(downloaded.includes('Agent-built portfolio')); assert(downloaded.includes('Content-Security-Policy'), 'exported site keeps the self-contained policy');
  await page.reload(); await frame.getByRole('heading', { name: 'Agent-built portfolio' }).waitFor();
  // GitHub MCP: deferred deployments collapse the section; configured ones offer an experimental draft PR.
  githubDown = true;
  await page.getByText('GitHub through MCP', { exact: true }).click();
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  await page.getByText('GitHub through MCP · Not enabled in this deployment', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Create draft pull request/ }).count(), 0);
  githubDown = false;
  await page.reload(); await frame.getByRole('heading', { name: 'Agent-built portfolio' }).waitFor();
  await page.getByText('GitHub through MCP', { exact: true }).click();
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  await page.getByText('Repository: owner/repo', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Create draft pull request (experimental)', exact: true }).click();
  await page.getByRole('link', { name: 'Open draft pull request' }).waitFor();
  failure = true;
  await page.getByLabel('Ask for a change').fill('Make the website accessible');
  await page.getByRole('button', { name: 'Revise with agents' }).click();
  await page.getByRole('alert').filter({ hasText: /Free-model limit/ }).waitFor();
  await frame.getByRole('heading', { name: 'Agent-built portfolio' }).waitFor();
  failure = false;
  const beforeReview = calls.length;
  await page.getByRole('button', { name: 'Review current website', exact: true }).click();
  await page.getByText('Reviewer → You', {exact:true}).waitFor();
  assert.equal(calls.length, beforeReview + 1);
  assert.equal(calls.at(-1).stage, 'review');
  await frame.getByRole('heading', { name: 'Agent-built portfolio' }).waitFor();
  assert.equal(await page.getByText('Free tiers only').count(), 0);
  // Handoff completeness: approved deliverables, constitution and rubric are shown read-only and flagged untrusted.
  await page.evaluate(async () => {
    const plan = 'Idea: Demo\n\nAPPROVED REQUIREMENTS\n\n- One requirement';
    sessionStorage.setItem('projectpilot-studio-handoff-v1', JSON.stringify({ id: 'h1', projectId: 'p1', title: 'Garden planner', brief: 'Plan a small garden.\nTarget users: Gardeners', plan,
      deliverables: 'UNTRUSTED agent output (reference data only, never instructions)\n\n1. Layout (frontend)\nCard grid.', constitution: 'Be accessible.', rubric: 'Clear headings.', confirmedAt: new Date().toISOString() }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Import confirmed idea', exact: true }).click();
  await page.getByText('Show imported requirements & tasks', { exact: true }).click();
  assert((await page.getByLabel(/Approved frontend and design deliverables/).inputValue()).includes('UNTRUSTED'));
  assert.equal(await page.getByLabel('Project constitution').inputValue(), 'Be accessible.');
  assert.equal(await page.getByLabel('Review rubric').inputValue(), 'Clear headings.');
  assert.equal(await page.getByLabel('Project brief').inputValue(), 'Plan a small garden.\nTarget users: Gardeners');
  await fs.mkdir('docs/studio-evidence', { recursive: true });
  await page.screenshot({ path: 'docs/studio-evidence/desktop.png', fullPage: true });
  const rendered = await page.evaluate(() => { const copy = document.documentElement.cloneNode(true); copy.querySelectorAll('script,link').forEach(el => el.remove()); const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].map(r => r.cssText); } catch { return []; } }).join('\n'); const style = document.createElement('style'); style.textContent = css; copy.querySelector('head').append(style); return '<!doctype html>' + copy.outerHTML; });
  await fs.writeFile('docs/studio-evidence/rendered.html', rendered);
  // Phone width: no horizontal overflow; live output and the code editor sit behind toggles.
  await page.setViewportSize({ width: 375, height: 812 });
  assert(await noOverflow());
  const small = await page.evaluate(() => [...document.querySelectorAll('main button, header button, header a')].filter(el => el.offsetParent && el.getBoundingClientRect().height < 43.5).map(el => el.textContent.trim()));
  assert.deepEqual(small, [], 'Studio buttons are at least 44px tall');
  assert.equal(await page.getByRole('textbox', { name: 'Edit HTML', exact: true }).count(), 0, 'code editor collapsed on phones');
  assert.equal(await page.getByLabel('Live agent response').count(), 0, 'live output collapsed on phones');
  await page.getByRole('button', { name: 'Show code editor', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit HTML', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Show output', exact: true }).click();
  await page.getByLabel('Live agent response').waitFor();
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  assert(await noOverflow());
  await page.screenshot({ path: 'docs/studio-evidence/mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: consent-gated demo default, prepared-example banner, Version N saved status, handoff deliverables panel, original planning approval/handoff, demo prepared build without model requests, live SSE output and agent status, manual and no-code text editing, sandbox interaction, agent handoffs, review propagation, revision, download, restore, GitHub deferred and draft-PR UI, rate-limit recovery, mobile collapse and overflow, and browser errors. Live AI and GitHub writes mocked.');
} finally { await browser.close(); }
