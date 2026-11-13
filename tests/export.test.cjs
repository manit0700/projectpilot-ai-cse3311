/* eslint-disable @typescript-eslint/no-require-imports -- Node tests transpile the real TypeScript exporters. */
// Run with: node --test tests/export.test.cjs
// Pure exporters only: no browser, no network, no model calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(ROOT, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} };
  cache.set(filename, mod);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const req = (name) => {
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.relative(ROOT, path.resolve(path.dirname(filename), name + '.ts')));
    return require(name);
  };
  new Function('require', 'module', 'exports', output)(req, mod, mod.exports);
  return mod.exports;
}
const lib = (name) => load(`src/lib/${name}.ts`);
const common = lib('export-common'), plan = lib('plan-export'), zip = lib('zip'), spec = lib('export-spec'), code = lib('export-code');
const disclosure = lib('export-disclosure'), issues = lib('export-issues'), backup = lib('export-backup'), html = lib('export-html');
const catalog = lib('export-catalog'), md = lib('export-markdown');

const fixture = () => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/export-project.json'), 'utf8'));
const NOW = new Date('2026-11-13T09:30:00.000Z');
const OPTS = { mode: 'live', now: NOW };
const text = (value) => (typeof value === 'string' ? value : Buffer.from(value).toString('utf8'));
// Every internal id in the fixture; none may appear in human-readable exports.
const idsOf = (s) => [s.project.id, ...s.requirements.map((r) => r.id), ...s.tasks.map((t) => t.id), ...s.outputs.map((o) => o.id), ...s.reviews.map((r) => r.id)];
const assertNoIds = (s, label, value) => { for (const id of idsOf(s)) assert(!value.includes(id), `${label} leaks internal id ${id}`); };

// ---- independent ZIP reader (parses our output back: central directory, local headers, CRC) ----
function bitwiseCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
function readZip(bytes) {
  const buf = Buffer.from(bytes);
  const eocd = buf.length - 22;
  assert.equal(buf.readUInt32LE(eocd), 0x06054b50, 'end of central directory signature');
  const count = buf.readUInt16LE(eocd + 10), size = buf.readUInt32LE(eocd + 12), start = buf.readUInt32LE(eocd + 16);
  assert.equal(start + size, eocd, 'central directory ends where EOCD begins');
  const files = new Map();
  let at = start;
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50, 'central header signature');
    const flags = buf.readUInt16LE(at + 8), method = buf.readUInt16LE(at + 10), crc = buf.readUInt32LE(at + 16);
    const csize = buf.readUInt32LE(at + 20), usize = buf.readUInt32LE(at + 24), nlen = buf.readUInt16LE(at + 28), elen = buf.readUInt16LE(at + 30), clen = buf.readUInt16LE(at + 32), offset = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nlen).toString('utf8');
    assert.equal(method, 0, 'STORE method'); assert.equal(flags & 0x0800, 0x0800, 'UTF-8 flag'); assert.equal(csize, usize);
    assert.equal(buf.readUInt32LE(offset), 0x04034b50, 'local header signature');
    assert.equal(buf.readUInt32LE(offset + 14), crc, 'local CRC matches central CRC');
    assert.equal(buf.readUInt32LE(offset + 22), usize, 'local size matches');
    const dataStart = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
    const data = buf.subarray(dataStart, dataStart + usize);
    assert.equal(bitwiseCrc(data), crc, `CRC-32 of ${name}`);
    assert.equal(buf.subarray(offset + 30, offset + 30 + buf.readUInt16LE(offset + 26)).toString('utf8'), name, 'local name matches central name');
    files.set(name, data);
    at += 46 + nlen + elen + clen;
  }
  assert.equal(at, eocd);
  return files;
}
function parseCsv(source) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) { if (c === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---- slug, title, ids ----
test('title is the first clause (max 60 chars) and the filename slug is short and readable', () => {
  const s = fixture();
  assert.equal(common.shortTitle(s.project), 'A study-session tracker');
  assert.equal(common.planSlug(s), 'study-session-tracker');
  assert.equal(plan.planFilename(s), 'study-session-tracker-plan.md');
  const long = { description: 'An extraordinarily long single clause describing a planning workspace for many different students without any punctuation at all' };
  assert(common.shortTitle(long).length <= 61);
  assert.equal(common.slugify('The Café & Bar: v2!'), 'cafe-bar-v2');
  assert.equal(common.slugify('   '), 'projectpilot');
  assert.equal(common.slugify('../../etc/passwd'), 'etc-passwd');
  assert(common.slugify('word '.repeat(40)).length <= 48);
  assert.equal(common.shortTitle({ title: '', description: '' }), 'Untitled project');
});

// ---- Markdown ----
test('markdown: short H1, provenance, task labels, acceptance criteria, no raw ids, no role descriptions as assumptions', () => {
  const s = fixture();
  const markdown = plan.planMarkdown(s, OPTS);
  assert(markdown.startsWith('# A study-session tracker\n'));
  assert(!markdown.includes('(draft:'));
  for (const line of ['Mode: Live', 'openrouter/example/free-model', 'Exported: 2026-11-13', 'Planning time (measured): 7.5 minutes']) assert(markdown.includes(line), line);
  assert(markdown.includes('### TASK-03 · Build session form and list'));
  assert(markdown.includes('Depends on: TASK-02 · Build session storage API'));
  assert(markdown.includes('- Constraints: No frameworks; keyboard accessible'));
  assert(markdown.includes('Acceptance: Given a course and 45 minutes, When I save, Then the session appears in the list.'));
  assert(markdown.includes('Depends on the model from TASK-01.'), 'ids inside free text are replaced');
  assert(!/Task ID/.test(markdown));
  assertNoIds(s, 'markdown', markdown);
  assert(!markdown.includes('Data model, storage, and query design'), 'role description is not an assumption');
  assert(markdown.includes('Assumptions: Target user is University students; The project prioritizes planning over production deployment'));
  assert(markdown.includes('Edited by a human: Yes'));
  assert(markdown.includes('(applied; tasks: TASK-03, TASK-04)'));
  for (const label of ['Approved requirements', 'Ordered task plan', 'Approved agent outputs', 'Testing / acceptance information', 'Documentation information', 'User usefulness rating: Not rated']) assert(markdown.includes(label), label);
});
test('markdown: demo mode says no AI model was called; missing model is "not recorded" in live mode', () => {
  const s = fixture(); s.events = []; s.usage = { requests: 0, promptTokens: 0, completionTokens: 0, totalLatencyMs: 0, models: [] };
  assert(plan.planMarkdown(s, { mode: 'demo', now: NOW }).includes('Mode: Demo prepared responses'));
  assert(plan.planMarkdown(s, { mode: 'demo', now: NOW }).includes('no AI model was called'));
  assert(plan.planMarkdown(s, { mode: 'live', now: NOW }).includes('AI provider / model: not recorded'));
});
test('markdown: partial export at any step never throws and is marked as a draft', () => {
  const s = fixture();
  s.project.status = 'tasks_pending'; s.planApproved = false; s.currentStep = 'tasks'; s.outputs = []; s.reviews = []; s.completedAt = null;
  s.tasks.forEach((t) => { t.state = 'queued'; }); s.requirements[4].approvalStatus = 'pending';
  const markdown = plan.planMarkdown(s, OPTS);
  assert(markdown.includes('(draft: step 4 of 8)'));
  assert(markdown.includes('## Requirements'));
  assert(markdown.includes('(pending)'));
  const empty = { ...fixture(), project: { id: '', title: '', description: '', targetUser: '', approvedSummary: '', status: 'draft', createdAt: '' }, questions: [], requirements: [], tasks: [], outputs: [], reviews: [], feedbackItems: [], events: [], currentStep: 'idea', planApproved: false };
  assert(plan.planMarkdown(empty, OPTS).includes('(draft: step 1 of 8)'));
  for (const status of ['clarifying', 'requirements_pending', 'agents_running', 'review_pending', 'feedback_pending', 'revising']) {
    const t = { ...fixture(), planApproved: false }; t.project.status = status;
    assert(/\(draft: step [1-8] of 8\)/.test(plan.planMarkdown(t, OPTS)), status);
  }
  const unapproved = fixture(); unapproved.outputs[0].approved = 'pending';
  assert(plan.planMarkdown(unapproved, OPTS).includes('(draft: step'));
});

// ---- ZIP writer ----
test('zip: CRC-32 test vector and a full round trip through an independent parser', () => {
  assert.equal(zip.crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(zip.crc32(new Uint8Array(0)), 0);
  const binary = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
  const bytes = zip.createZip([{ name: 'a.txt', data: 'hello' }, { name: 'dir/sub/ünï-日本.md', data: '# héllo\n' }, { name: 'bin.dat', data: binary }, { name: 'empty.txt', data: '' }]);
  const files = readZip(bytes);
  assert.deepEqual([...files.keys()], ['a.txt', 'dir/sub/ünï-日本.md', 'bin.dat', 'empty.txt']);
  assert.equal(files.get('a.txt').toString(), 'hello');
  assert.equal(files.get('dir/sub/ünï-日本.md').toString('utf8'), '# héllo\n');
  assert.deepEqual([...files.get('bin.dat')], [...binary]);
  assert.equal(files.get('empty.txt').length, 0);
  assert.equal(readZip(zip.createZip([])).size, 0);
});
test('zip: unsafe or duplicate names are refused', () => {
  for (const name of ['../evil.txt', 'a/../../b', '', '/', 'C:']) assert.throws(() => zip.createZip([{ name, data: 'x' }]), /Unsafe/, name);
  assert.equal(zip.safeZipName('/abs/path\\x.txt'), 'abs/path/x.txt');
  assert.throws(() => zip.createZip([{ name: 'a', data: '1' }, { name: './a', data: '2' }]), /Duplicate/);
});
test('zip: the archive is a valid zip for the system unzip when it is available', (t) => {
  const probe = spawnSync('unzip', ['-v']);
  if (probe.error || probe.status !== 0) { t.skip('unzip not installed'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-zip-'));
  const file = path.join(dir, 'x.zip');
  fs.writeFileSync(file, zip.createZip([{ name: 'a/b.txt', data: 'hi' }]));
  const result = spawnSync('unzip', ['-t', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- Spec bundle ----
test('spec bundle: every file, identical AGENTS.md and CLAUDE.md, ordered tasks, acceptance, rubric, constitution', () => {
  const s = fixture();
  const files = readZip(spec.specBundleZip(s, OPTS));
  assert.deepEqual([...files.keys()].sort(), ['AGENTS.md', 'CLAUDE.md', 'README.md', 'design.md', 'plan.json', 'requirements.md', 'tasks.md']);
  const read = (n) => files.get(n).toString('utf8');
  assert.equal(read('AGENTS.md'), read('CLAUDE.md'));
  assert(read('requirements.md').includes('## REQ-01 · Log a study session with course, minutes and notes.'));
  assert(read('requirements.md').includes('- Priority: MUST'));
  assert(read('requirements.md').includes('- [ ] Given 0 minutes, When I save, Then I see a validation message.'));
  assert(read('requirements.md').includes('Acceptance criteria: not written yet'), 'requirement without criteria says so');
  const tasks = read('tasks.md');
  let previous = -1;
  for (const label of ['TASK-01', 'TASK-02', 'TASK-03', 'TASK-04', 'TASK-05', 'TASK-06']) { const at = tasks.indexOf(`## ${label} ·`); assert(at > previous, label); previous = at; }
  assert(tasks.includes('- Depends on: TASK-03 · Build session form and list; TASK-04 · Add weekly totals view'));
  assert(tasks.includes('- Expected output: Checklist mapped to requirements'));
  assert(tasks.includes('- Constraints: No frameworks; keyboard accessible'));
  const design = read('design.md');
  assert(design.indexOf('## Database design') < design.indexOf('## Backend design') && design.indexOf('## Backend design') < design.indexOf('## Frontend design'));
  assert(design.includes('### TASK-04 · Add weekly totals view [human-edited]'));
  assert(!design.includes('### TASK-03 · Build session form and list [human-edited]'));
  const agents = read('AGENTS.md');
  for (const part of ['## Project brief', '## Project rules (constitution)', 'Keep it simple', '## Stack and constraints', 'Plain HTML, CSS and JavaScript', '## Conventions', '## How to work', 'tasks.md', '## Definition of done', 'REQ-01: Given a course', 'Grading rubric:', 'Working prototype']) assert(agents.includes(part), part);
  for (const name of ['README.md', 'requirements.md', 'tasks.md', 'design.md', 'AGENTS.md']) assertNoIds(s, name, read(name));
  assert.equal(JSON.parse(read('plan.json')).app, 'projectpilot');
});
test('spec bundle works on a draft plan', () => {
  const s = fixture(); s.project.status = 'tasks_pending'; s.outputs = []; s.reviews = []; s.planApproved = false; delete s.project.rubric; delete s.project.constitution;
  const files = readZip(spec.specBundleZip(s, OPTS));
  assert(files.get('tasks.md').toString().includes('(draft: step 4 of 8)'));
  assert(!files.get('AGENTS.md').toString().includes('constitution'));
  assert(files.get('design.md').toString().includes('No database deliverable yet.'));
});

// ---- Code files ----
test('code files: filename hints in fences, headings and first-line comments become files in folders', () => {
  const s = fixture();
  const files = code.extractCodeFiles(s);
  assert.deepEqual(files.map((f) => f.path), ['public/index.html', 'public/styles.css', 'src/app.js']);
  assert(files.find((f) => f.path === 'src/app.js').content.includes('weekly'), 'a later task replaces an earlier file with the same path');
  assert(!files.find((f) => f.path === 'public/styles.css').content.includes('file:'), 'the file: hint line is not part of the file');
  const archive = readZip(code.codeFilesZip(s, NOW));
  assert.deepEqual([...archive.keys()].sort(), ['FILES.md', 'public/index.html', 'public/styles.css', 'src/app.js']);
  assert(archive.get('FILES.md').toString().includes('  index.html'), 'folder structure listed');
  assert.throws(() => code.codeFilesZip({ ...s, outputs: [] }, NOW), /No code files/);
});
test('code files: hostile or ambiguous names are not written', () => {
  const s = fixture();
  s.outputs[0].summary = ['```ts filename=../../etc/passwd', 'x', '```', '```ts filename=/abs/evil.ts', 'x', '```', '```ts filename=C:\\evil.ts', 'x', '```', '### Next.js', '```js', 'y', '```', '```ts filename=ok/fine.ts', 'z', '```'].join('\n');
  s.outputs[2].summary = 'no code here'; s.outputs[3].summary = 'none';
  assert.deepEqual(code.extractCodeFiles(s).map((f) => f.path), ['ok/fine.ts']);
});
test('markdown parser: blocks, filename hints, inline tokens', () => {
  const blocks = md.parseMarkdownBlocks('# Title\n\nSome **bold** and `code`.\nSecond line.\n\n- a\n- b\n\n1. one\n2. two\n\n```ts filename="src/x.ts"\nconst a = 1;\n```\n\n### lib/y.py\n```\nprint(1)\n```\n');
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'paragraph', 'list', 'list', 'code', 'heading', 'code']);
  assert.equal(blocks[1].text, 'Some **bold** and `code`.\nSecond line.');
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[4].filename, 'src/x.ts'); assert.equal(blocks[4].lang, 'ts');
  assert.equal(blocks[6].filename, 'lib/y.py');
  assert.deepEqual(md.parseInline('a **b** `c` d'), [{ type: 'text', text: 'a ' }, { type: 'bold', text: 'b' }, { type: 'text', text: ' ' }, { type: 'code', text: 'c' }, { type: 'text', text: ' d' }]);
  assert.equal(md.parseMarkdownBlocks('```js\nunterminated')[0].code, 'unterminated');
});

// ---- AI-use disclosure ----
test('disclosure: statement, decision table, models, usage and timeline come from recorded events', () => {
  const s = fixture();
  const doc = disclosure.aiDisclosureMarkdown(s, OPTS);
  assert(doc.startsWith('# AI-use disclosure: A study-session tracker'));
  assert(doc.includes('> This plan was drafted with AI assistance (openrouter/example/free-model). The author reviewed and approved 14 of 14 items and edited 3.'));
  assert(doc.includes('| Clarifying answers drafted by AI | 3 | 2 | 1 | 0 | 0 |'));
  assert(doc.includes('| Agent outputs generated by AI | 6 | 5 | 1 | 0 | 0 |'));
  assert(doc.includes('| Requirements drafted by AI | 5 | 4 | 1 | 0 | 0 |'));
  assert(doc.includes('| openrouter/example/free-model | answer drafted, requirement drafted, output generated, review completed |'));
  assert(doc.includes('- Model requests: 14') && doc.includes('- Prompt tokens: 12000') && doc.includes('- Completion tokens: 5000') && doc.includes('- Total model time: 42.0 s'));
  assert(doc.includes('- TASK-04 · Add weekly totals view'));
  assert(/\| 2026-11-12 10:03:20Z \| AI \(openrouter\/example\/free-model\) \| output generated \| TASK-01 output \|/.test(doc) || doc.includes('| AI (openrouter/example/free-model) | output generated | TASK-01 output |'));
  assert(doc.includes('| Author | output approved | TASK-06 output |'));
  assertNoIds(s, 'disclosure', doc);
});
test('disclosure: rejected and undecided drafts are counted; missing data says "not recorded", never invented', () => {
  const s = fixture();
  s.events.push({ id: 'e-x', at: '2026-11-12T11:00:00.000Z', msSinceStart: 1, type: 'output_rejected', entityId: s.outputs[0].id, mode: 'live' });
  s.events = s.events.filter((e) => !(e.type === 'requirement_approved' && e.entityId === s.requirements[0].id));
  const doc = disclosure.aiDisclosureMarkdown(s, OPTS);
  assert(doc.includes('| Agent outputs generated by AI | 6 | 4 | 1 | 1 | 0 |'));
  assert(doc.includes('| Requirements drafted by AI | 5 | 3 | 1 | 0 | 1 |'));
  const bare = fixture(); bare.events = []; bare.usage = undefined; for (const o of bare.outputs) delete o.humanEdited;
  const none = disclosure.aiDisclosureMarkdown(bare, { mode: 'live', now: NOW });
  assert(none.includes('edited not recorded.'));
  assert(none.includes('Decision history: not recorded.') && none.includes('Timeline: not recorded.') && none.includes('- Model requests: not recorded') && none.includes('Edits: not recorded.'));
  assert(none.includes('Provider and model: not recorded.'));
  assert(none.includes('comes from the final plan') || none.includes('come from the final plan'));
  const demo = fixture(); demo.events = []; demo.usage = { requests: 0, promptTokens: 0, completionTokens: 0, totalLatencyMs: 0, models: [] };
  const demoDoc = disclosure.aiDisclosureMarkdown(demo, { mode: 'demo', now: NOW });
  assert(demoDoc.includes('prepared demo responses; no AI model was called') && demoDoc.includes('- Model requests: 0 (demo mode)'));
});
test('disclosure: tables survive pipes and newlines in event notes', () => {
  const s = fixture(); s.events.push({ id: 'e-y', at: '2026-11-12T11:00:00.000Z', msSinceStart: 1, type: 'run_failed', mode: 'live', detail: 'bad | pipe\nnewline' });
  const doc = disclosure.aiDisclosureMarkdown(s, OPTS);
  assert(doc.includes('bad \\| pipe newline'));
});

// ---- GitHub issues ----
test('issues.csv: one row per task, labels by role, milestone, acceptance criteria, round-trips through a CSV parser', () => {
  const s = fixture();
  const rows = parseCsv(issues.issuesCsv(s));
  assert.deepEqual(rows[0], ['title', 'body', 'labels', 'milestone']);
  assert.equal(rows.length, 7);
  assert(rows.every((r) => r.length === 4));
  assert.equal(rows[1][0], 'TASK-01 · Define study session data model');
  assert.equal(rows[3][2], 'role:frontend,projectpilot');
  assert.equal(rows[3][3], 'A study-session tracker');
  for (const piece of ['**Expected output:** HTML, CSS and JavaScript files', '**Constraints:** No frameworks; keyboard accessible', '**Depends on:** TASK-02 · Build session storage API', '- [ ] REQ-01: Given a course and 45 minutes']) assert(rows[3][1].includes(piece), piece);
  assertNoIds(s, 'issues.csv', issues.issuesCsv(s));
});
test('csv: quoting, embedded quotes and newlines, formula neutralisation', () => {
  assert.equal(common.csvCell('plain'), 'plain');
  assert.equal(common.csvCell('a,b'), '"a,b"');
  assert.equal(common.csvCell('say "hi"\nthere'), '"say ""hi""\nthere"');
  for (const bad of ['=SUM(A1)', '+1', '-2+3', '@cmd', '\t=1', ' =1', '=HYPERLINK("http://x","y")']) assert(common.csvCell(bad).replace(/^"/, '').startsWith("'"), bad);
  assert.equal(common.csvCell('=1+1'), "'=1+1");
  assert.equal(common.csvCell(undefined), '');
  const s = fixture(); s.tasks[0].description = '=HYPERLINK("http://evil","click")'; s.tasks[1].title = 'Comma, "quote" and\nnewline';
  const rows = parseCsv(issues.issuesCsv(s));
  assert(rows[1][1].startsWith("'=HYPERLINK"));
  assert.equal(rows[2][0], 'TASK-02 · Comma, "quote" and\nnewline');
});
test('shell quoting: single quotes are escaped and nothing is evaluated', () => {
  assert.equal(common.shellQuote('plain'), "'plain'");
  assert.equal(common.shellQuote("it's"), "'it'\\''s'");
  assert.equal(common.shellQuote("'; rm -rf / #"), "''\\''; rm -rf / #'");
  assert.equal(common.shellQuote('a\0b\u0007c'), "'abc'");
  assert.equal(common.shellQuote('$(id) `id` ${HOME} \\n\n!'), "'$(id) `id` ${HOME} \\n\n!'");
});
test('create-issues.sh: runs under bash with a fake gh; hostile task text arrives as plain arguments and executes nothing', (t) => {
  if (spawnSync('bash', ['--version']).error) { t.skip('bash not available'); return; }
  const s = fixture(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-sh-'));
  const marker = path.join(dir, 'PWNED');
  const hostile = `x'; touch ${marker}; echo '`;
  s.tasks[0].title = hostile;
  s.tasks[1].description = `$(touch ${marker}) \`touch ${marker}\` "; touch ${marker}; "`;
  s.tasks[2].expectedOutput = `line1\n'quoted' && touch ${marker}`;
  const script = issues.createIssuesScript(s);
  assert(script.startsWith('#!/usr/bin/env bash\n'));
  assert(script.includes('set -euo pipefail'));
  fs.writeFileSync(path.join(dir, 'create-issues.sh'), script);
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin);
  const log = path.join(dir, 'gh.log');
  fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env bash\nprintf '%s\\0' "$@" >> '${log}'\nprintf '\\x01END\\x01' >> '${log}'\n`, { mode: 0o755 });
  const ran = spawnSync('bash', [path.join(dir, 'create-issues.sh'), 'owner/repo'], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, USE_MILESTONE: '1' }, encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  assert(!fs.existsSync(marker), 'no injected command ran');
  const calls = fs.readFileSync(log, 'utf8').split('\x01END\x01').filter(Boolean).map((c) => c.split('\0').slice(0, -1));
  const drafts = issues.issueDrafts(s);
  const labelCalls = calls.filter((c) => c[0] === 'label'), issueCalls = calls.filter((c) => c[0] === 'issue');
  assert.equal(issueCalls.length, 6);
  assert(labelCalls.some((c) => c[2] === 'role:frontend'));
  issueCalls.forEach((call, i) => {
    assert.deepEqual(call.slice(0, 3), ['issue', 'create', '--repo']);
    assert.equal(call[3], 'owner/repo');
    const field = (flag) => call[call.indexOf(flag) + 1];
    assert.equal(field('--title'), drafts[i].title);
    assert.equal(field('--body'), drafts[i].body);
    assert.equal(field('--label'), drafts[i].labels.join(','));
    assert.equal(field('--milestone'), drafts[i].milestone);
  });
  assert(issueCalls[0][issueCalls[0].indexOf('--title') + 1].includes(hostile));
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- plan.json and logs ----
test('plan.json: envelope, no actions or UI flags, and it parses back', () => {
  const s = { ...fixture(), reset: () => {}, managerMode: 'live', savedStatus: 'x', busy: false, hydrated: true };
  const json = JSON.parse(backup.planJson(s, OPTS));
  assert.deepEqual(Object.keys(json), ['app', 'version', 'exportedAt', 'mode', 'state']);
  assert.equal(json.app, 'projectpilot'); assert.equal(json.version, load('src/lib/store-persistence.ts').SAVE_VERSION); assert.equal(json.mode, 'live'); assert.equal(json.exportedAt, NOW.toISOString());
  for (const key of ['reset', 'managerMode', 'savedStatus', 'busy', 'hydrated']) assert(!(key in json.state), key);
  assert.deepEqual(json.state.tasks, fixture().tasks);
  const parsed = backup.parsePlanJson(backup.planJson(s, OPTS));
  assert.equal(parsed.ok, true); assert.equal(parsed.state.project.id, s.project.id);
  assert.equal(backup.planJson(s, { planJsonText: 'prebuilt' }), 'prebuilt');
  // The store's own importer accepts the file we write: backup and restore round-trip.
  const imported = load('src/lib/store-persistence.ts').parseImport(backup.planJson(s, OPTS), fixture());
  assert.equal(imported.state.project.id, s.project.id); assert.equal(imported.mode, 'live');
  assert.equal(imported.state.events.length, s.events.length); assert.equal(imported.state.outputs.length, s.outputs.length);
});
test('plan.json import validation rejects bad files with a readable reason', () => {
  for (const [source, pattern] of [['{nope', /not valid JSON/], ['[]', /not a ProjectPilot/], ['{"app":"other","version":1,"state":{}}', /not a ProjectPilot/], ['{"app":"projectpilot","version":9,"state":{}}', /newer version/], ['{"app":"projectpilot","version":1,"state":{}}', /not supported/], ['{"app":"projectpilot","version":3}', /no saved project/], ['{"app":"projectpilot","version":3,"state":{"project":{"id":"p"}}}', /missing the questions/]]) {
    const result = backup.parsePlanJson(source); assert.equal(result.ok, false, source); assert(pattern.test(result.error), `${source}: ${result.error}`);
  }
});
test('session log CSV and JSON are available with and without events', () => {
  const s = fixture();
  const csv = backup.sessionLogCsvFile(s);
  assert(csv.startsWith('at,msSinceStart,type,entityId,mode,provider,model'));
  assert.equal(csv.trim().split('\n').length >= 33, true);
  const json = JSON.parse(backup.sessionLogJsonFile(s, OPTS));
  assert.equal(json.events.length, s.events.length); assert.equal(json.app, 'projectpilot');
  const bare = { ...s, events: [], usage: undefined };
  assert.equal(backup.sessionLogCsvFile(bare).trim().split('\n').length, 1);
  assert.deepEqual(JSON.parse(backup.sessionLogJsonFile(bare, OPTS)).events, []);
  const noEvents = { ...s }; delete noEvents.events;
  assert.equal(JSON.parse(backup.sessionLogJsonFile(noEvents, OPTS)).events.length, 0);
});

// ---- Shareable HTML ----
test('shareable html: self-contained, CSP, no scripts or external requests, hostile text escaped', () => {
  const s = fixture();
  const hostile = '<script>alert(1)</script><img src=x onerror=alert(2)> "quoted" \'single\' & <a href="javascript:evil()">';
  s.project.description = hostile; s.project.targetUser = hostile; s.requirements[0].text = hostile; s.requirements[0].acceptance = [hostile];
  s.tasks[0].title = hostile; s.tasks[0].description = hostile; s.tasks[0].expectedOutput = hostile; s.tasks[0].constraints = hostile;
  s.outputs[0].summary = hostile; s.outputs[0].assumptions = [hostile]; s.outputs[0].blockers = [hostile];
  const page = html.shareableHtml(s, OPTS);
  assert(page.startsWith('<!doctype html>'));
  assert(page.includes('http-equiv="Content-Security-Policy"') && page.includes("default-src 'none'"));
  assert(page.includes('@media print'));
  assert(!/<script/i.test(page) && !/<img/i.test(page) && !/<iframe|<object|<embed|<link|<form|<base/i.test(page));
  for (const [tag] of page.replace(/<style>[^]*?<\/style>/, '').matchAll(/<[^>]*>/g)) assert(!/\s(?:href|src|srcset|style|on\w+)\s*=/i.test(tag), `attribute in ${tag}`);
  assert(!/https?:\/\//i.test(page), 'no external URLs');
  assert(page.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert(page.includes('&quot;quoted&quot;') && page.includes('&#39;single&#39;') && page.includes('&amp;'));
  const allowed = new Set(['html', 'head', 'meta', 'title', 'style', 'body', 'main', 'h1', 'h2', 'h3', 'p', 'ul', 'li', 'div', 'pre', 'span', 'strong']);
  for (const [, tag] of page.matchAll(/<\/?([a-z0-9]+)/gi)) assert(allowed.has(tag.toLowerCase()), `unexpected tag <${tag}>`);
  const withoutOwnMarkup = page.replace(/<style>[^]*?<\/style>/, '');
  assert(!/<[^>]*onerror/i.test(withoutOwnMarkup));
  assert.equal(common.escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  assertNoIds(fixture(), 'html', html.shareableHtml(fixture(), OPTS));
});
test('shareable html marks drafts and still renders at any step', () => {
  const s = fixture(); s.project.status = 'requirements_pending'; s.tasks = []; s.outputs = []; s.reviews = []; s.planApproved = false;
  const page = html.shareableHtml(s, OPTS);
  assert(page.includes('(draft: step 3 of 8)')); assert(page.includes('No tasks yet.'));
});

// ---- catalog and the whole set ----
test('catalog: every download builds on a complete plan, never prints raw ids, and has a safe filename', () => {
  const s = fixture();
  assert.equal(catalog.EXPORT_ITEMS.length, 10);
  const names = new Set();
  for (const item of catalog.EXPORT_ITEMS) {
    assert.equal(item.unavailable(s), null, item.id);
    const content = item.build(s, OPTS);
    assert(content.length > 0, item.id);
    const filename = item.filename(s);
    assert(/^[a-z0-9][a-z0-9.-]*$/.test(filename), filename); assert(!names.has(filename)); names.add(filename);
    assert(item.description.length > 20 && item.label.length > 0);
    if (!['plan-json', 'log-csv', 'log-json'].includes(item.id)) {
      if (item.mime.startsWith('application/zip')) { for (const [name, data] of readZip(content)) if (name !== 'plan.json') assertNoIds(s, `${item.id}:${name}`, data.toString('utf8')); }
      else assertNoIds(s, item.id, text(content));
    }
  }
  assert(names.has('study-session-tracker-plan.md') && names.has('study-session-tracker-spec.zip'));
});
test('catalog: before a project exists everything says why it is unavailable; log and backup work at any later step', () => {
  const empty = { ...fixture(), project: { id: '', title: '', description: '', targetUser: '', approvedSummary: '', status: 'draft', createdAt: '' }, questions: [], requirements: [], tasks: [], outputs: [], reviews: [], feedbackItems: [], events: [], currentStep: 'idea', planApproved: false };
  for (const item of catalog.EXPORT_ITEMS) assert.equal(typeof item.unavailable(empty), 'string', item.id);
  const early = { ...empty, project: { ...empty.project, id: 'p-1', description: 'A quiz app for students', status: 'clarifying' }, currentStep: 'questions' };
  for (const item of catalog.EXPORT_ITEMS) {
    const reason = item.unavailable(early);
    if (['markdown', 'disclosure', 'plan-json', 'log-csv', 'log-json', 'share'].includes(item.id)) { assert.equal(reason, null, item.id); assert(item.build(early, OPTS).length > 0, item.id); }
    else assert.equal(typeof reason, 'string', item.id);
  }
  assert.equal(catalog.EXPORT_ITEMS.find((i) => i.id === 'code').unavailable(fixture()), null);
  const noCode = fixture(); noCode.outputs.forEach((o) => { o.summary = 'plain text'; });
  assert.match(catalog.EXPORT_ITEMS.find((i) => i.id === 'code').unavailable(noCode), /No agent output names a code file/);
});

// ---- Final screen renderer ----
test('DeliverableView renders structure, code captions and copy buttons without injecting HTML', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { DeliverableView } = load('src/components/deliverable-view.tsx');
  const hostile = '<script>alert(1)</script>';
  const markup = renderToStaticMarkup(React.createElement(DeliverableView, { title: 'TASK-03 · UI', humanEdited: true, badge: 'Approved', text: `## Plan\n\nLine one\nLine two with **bold** and \`code\` ${hostile}\n\n- item a\n- item b\n\n\`\`\`ts filename=src/a.ts\nconst x = "<b>";\n\`\`\`\n` }));
  assert(markup.includes('Edited by you') && markup.includes('Approved'));
  assert(markup.includes('Copy all') && markup.includes('aria-label="Copy src/a.ts"'));
  assert(markup.includes('whitespace-pre-wrap') && markup.includes('<strong>bold</strong>') && markup.includes('<ul'));
  assert(markup.includes('<pre') && markup.includes('<code class="font-mono">const x = &quot;&lt;b&gt;&quot;;</code>') && markup.includes('src/a.ts'));
  assert(!markup.includes('<script') && markup.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('disclosure: clarifying answers are accepted, edited or undecided; never rejected; statement equals the table sums', () => {
  const ev = (type, entityId) => ({ id: `e-${type}-${entityId}`, at: '2026-11-12T10:00:00.000Z', msSinceStart: 1, type, entityId, mode: 'live', provider: 'p', model: 'm' });
  const answers = ['q-1', 'q-2', 'q-3', 'q-4', 'q-5'].map((q) => ev('answer_drafted', q));
  const row = (doc, name) => doc.split('\n').find((l) => l.startsWith(`| ${name}`));
  const build = (events) => { const s = fixture(); s.events = events; return disclosure.aiDisclosureMarkdown(s, OPTS); };
  // Untouched answers, requirements drafted: accepted unchanged.
  let doc = build([...answers, ev('requirement_drafted', 'r-1')]);
  assert.equal(row(doc, 'Clarifying answers'), '| Clarifying answers drafted by AI | 5 | 5 | 0 | 0 | 0 |');
  // One edited answer.
  doc = build([...answers, ev('answer_edited', 'q-3'), ev('requirement_drafted', 'r-1')]);
  assert.equal(row(doc, 'Clarifying answers'), '| Clarifying answers drafted by AI | 5 | 4 | 1 | 0 | 0 |');
  // No requirements drafted yet: the author has not moved on, so answers are undecided, not rejected.
  doc = build(answers);
  assert.equal(row(doc, 'Clarifying answers'), '| Clarifying answers drafted by AI | 5 | 0 | 0 | 0 | 5 |');
  // Statement totals are the table sums (answers + requirements + outputs).
  const s = fixture(); s.events = [...answers, ev('answer_edited', 'q-1'), ev('requirement_drafted', 'r-1'), ev('requirement_approved', 'r-1'), ev('requirement_drafted', 'r-2'), ev('requirement_rejected', 'r-2'), ev('output_generated', 'o-1')];
  const n = disclosure.disclosureNumbers(s);
  assert.deepEqual([n.approved, n.total, n.edited], [6, 8, 1]);
  assert(disclosure.disclosureStatement(s, OPTS).includes('approved 6 of 8 items and edited 1.'));
  const table = disclosure.aiDisclosureMarkdown(s, OPTS);
  assert(row(table, 'Requirements').endsWith('| 2 | 1 | 0 | 1 | 0 |'));
  assert(row(table, 'Agent outputs').endsWith('| 1 | 0 | 0 | 0 | 1 |'));
  // Without events nothing is invented: no table rows, no rejections.
  s.events = [];
  const none = disclosure.aiDisclosureMarkdown(s, OPTS);
  assert(none.includes('Decision history: not recorded.') && !/Rejected/.test(none));
  assert.equal(disclosure.decisionRows([]), null);
  // A drafted item with no decision event is undecided, never rejected.
  const stats = disclosure.draftStats([ev('output_generated', 'o-9')], { draft: 'output_generated', edit: 'output_edited', approve: 'output_approved', reject: 'output_rejected' });
  assert.deepEqual(stats, { drafts: 1, accepted: 0, edited: 0, rejected: 0, undecided: 1 });
});
