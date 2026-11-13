// LIVE CHECK: consumes real OpenRouter quota (or OpenAI credit); manual only, never in CI.
// Runs the Website Studio plan, build and review stages against a running server at
// PROJECTPILOT_URL (default http://localhost:3314). LIVE_ACCESS_CODE comes from .env.local.
// Output: artifacts/live/{plan.txt,files.json,review.txt,*-stream.txt,verification.json} (git-ignored).
// STUDIO_REVISE=1 rebuilds from the previous run's files.json and review.txt in that directory.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const req = createRequire(import.meta.url);
const ts = req('typescript');
const streamModule = {exports:{}};
new Function('module','exports',ts.transpileModule(await fs.readFile('src/lib/studio-stream.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(streamModule,streamModule.exports);
const {sseData} = streamModule.exports;
const root = process.env.PROJECTPILOT_URL || 'http://localhost:3314';
const outDir = `${process.env.PROJECTPILOT_ARTIFACTS_DIR || 'artifacts'}/live`;
await fs.mkdir(outDir, { recursive: true });
const unlocked = await fetch(root + '/api/live-access', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: root }, body: JSON.stringify({ code: process.env.LIVE_ACCESS_CODE || '', consent: true }) });
assert(unlocked.ok, 'Could not unlock local live access');
const cookie = unlocked.headers.get('set-cookie')?.split(';')[0] || '';
const brief = 'Build a compact student study-session tracker. One page with a course-name field, a positive whole-number minutes field, an Add session button, a list, delete buttons, total study minutes and an empty state. Keep the implementation under 120 lines per file, with no external assets or libraries. Accessible labels and responsive layout.';
let files = { html: '<main></main>', css: '', js: '' };
let plan = '';
const log = [];
let feedback = '';
if (process.env.STUDIO_REVISE === '1') {
 files = JSON.parse(await fs.readFile(`${outDir}/files.json`,'utf8'));
 await fs.writeFile(`${outDir}/files-before-revision.json`,JSON.stringify(files,null,2));
 plan = await fs.readFile(`${outDir}/plan.txt`,'utf8');
 feedback = await fs.readFile(`${outDir}/review.txt`,'utf8');
 feedback += '\nFix the concrete findings. Use safe DOM textContent for user text; reject whitespace-only courses and fractional minutes with Number.isInteger(Number(value)); return separate body markup, CSS and JavaScript. Keep the implementation compact. Do not add localStorage because this preview has an opaque sandbox origin.';
}
for (const stage of process.env.STUDIO_REVISE === '1' ? ['build', 'review'] : ['plan', 'build', 'review']) {
  console.log(`Starting real ${stage} request (free-only)…`);
  const started = Date.now();
  const response = await fetch(root + '/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: root, cookie }, body: JSON.stringify({ stage, brief, plan, files, feedback, live: true }), signal: AbortSignal.timeout(65000) });
  let body;
  if(response.headers.get('content-type')?.includes('text/event-stream')) {
    let characters=0, transcript='';
    for await(const data of sseData(response.body)) {
      const event=JSON.parse(data);
      if(event.type==='delta') { characters+=event.text.length; transcript+=event.text; }
      if(event.type==='result') body=event.result;
      if(event.type==='error') body={error:event.error};
    }
    await fs.writeFile(`${outDir}/${stage}-stream.txt`,transcript);
    console.log(JSON.stringify({stage,streamedCharacters:characters}));
  } else body = await response.json();
  if(!body) body={error:'Stream ended without a result'};
  const record = { stage, status: response.status, seconds: Math.round((Date.now() - started) / 1000), model: body.model, upstreamStatus: body.upstreamStatus, error: body.error };
  log.push(record); console.log(JSON.stringify(record));
  await fs.writeFile(`${outDir}/verification.json`, JSON.stringify({ date: new Date().toISOString(), log }, null, 2));
  if (!response.ok || body.error) process.exit(1);
  if (stage === 'plan') { plan = body.text; await fs.writeFile(`${outDir}/plan.txt`, plan); }
  if (stage === 'build') { files = body.files; await fs.writeFile(`${outDir}/files.json`, JSON.stringify(files, null, 2)); }
  if (stage === 'review') await fs.writeFile(`${outDir}/review.txt`, body.text);
}
console.log('PASS: real free-model website pipeline requests. Generated code still needs browser verification (GENERATED_SITE_FIXTURE=artifacts/live/files.json node scripts/verify-generated-site.mjs).');
