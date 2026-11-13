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
const unlocked = await fetch(root + '/api/live-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: process.env.LIVE_ACCESS_CODE || '', consent: true }) });
assert(unlocked.ok, 'Could not unlock local live access');
const cookie = unlocked.headers.get('set-cookie')?.split(';')[0] || '';
const brief = 'Build a compact student study-session tracker. One page with a course-name field, a positive whole-number minutes field, an Add session button, a list, delete buttons, total study minutes and an empty state. Keep the implementation under 120 lines per file, with no external assets or libraries. Accessible labels and responsive layout.';
let files = { html: '<main></main>', css: '', js: '' };
let plan = '';
const log = [];
let feedback = '';
if (process.env.STUDIO_REVISE === '1') {
 files = JSON.parse(await fs.readFile('docs/studio-evidence/live/files.json','utf8'));
 await fs.writeFile('docs/studio-evidence/live/files-before-revision.json',JSON.stringify(files,null,2));
 plan = await fs.readFile('docs/studio-evidence/live/plan.txt','utf8');
 feedback = await fs.readFile('docs/studio-evidence/live/review.txt','utf8');
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
    await fs.mkdir('docs/studio-evidence/live',{recursive:true});
    await fs.writeFile(`docs/studio-evidence/live/${stage}-stream.txt`,transcript);
    console.log(JSON.stringify({stage,streamedCharacters:characters}));
  } else body = await response.json();
  if(!body) body={error:'Stream ended without a result'};
  const record = { stage, status: response.status, seconds: Math.round((Date.now() - started) / 1000), model: body.model, upstreamStatus: body.upstreamStatus, error: body.error };
  log.push(record); console.log(JSON.stringify(record));
  await fs.mkdir('docs/studio-evidence/live', { recursive: true });
  await fs.writeFile('docs/studio-evidence/live/verification.json', JSON.stringify({ date: new Date().toISOString(), log }, null, 2));
  if (!response.ok || body.error) process.exit(1);
  if (stage === 'plan') { plan = body.text; await fs.writeFile('docs/studio-evidence/live/plan.txt', plan); }
  if (stage === 'build') { files = body.files; await fs.writeFile('docs/studio-evidence/live/files.json', JSON.stringify(files, null, 2)); }
  if (stage === 'review') await fs.writeFile('docs/studio-evidence/live/review.txt', body.text);
}
console.log('PASS: real free-model website pipeline requests. Generated code still needs browser verification.');
