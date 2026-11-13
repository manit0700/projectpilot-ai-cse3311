// Browser check of a real AI-generated Website Studio site. No AI provider is contacted.
// Input: the committed fixture tests/fixtures/studio-generated-site.json (override with
// GENERATED_SITE_FIXTURE, e.g. artifacts/live/files.json after verify-studio-live.mjs).
// PLAYWRIGHT_CHANNEL=chrome opts into installed Chrome; bundled Chromium is the default.
// Output: artifacts/generated-site/{website.html,generated-desktop.png,generated-mobile.png,browser-verification.json}.
import {createRequire} from 'node:module';import fs from 'node:fs/promises';import fsSync from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const req=createRequire(import.meta.url),ts=req('typescript'),cache=new Map();
// Transpiles the real TypeScript module and resolves its "@/" and relative imports the same way.
function load(filename){
 if(cache.has(filename))return cache.get(filename).exports;
 const m={exports:{}};cache.set(filename,m);
 const source=ts.transpileModule(fsSync.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=name=>name.startsWith('@/')?load(path.resolve('src',name.slice(2)+'.ts')):name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts')):req(name);
 new Function('require','module','exports',source)(localRequire,m,m.exports);
 return m.exports;
}
const {documentHtml}=load(path.resolve('src/lib/studio.ts'));
const fixture=process.env.GENERATED_SITE_FIXTURE||'tests/fixtures/studio-generated-site.json';
const outDir=`${process.env.PROJECTPILOT_ARTIFACTS_DIR||'artifacts'}/generated-site`;
await fs.mkdir(outDir,{recursive:true});
const files=JSON.parse(await fs.readFile(fixture,'utf8'));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent(documentHtml(files,true));
 const course=page.getByLabel('Course name',{exact:true}),minutes=page.getByLabel('Study minutes',{exact:true}),add=page.getByRole('button',{name:'Add session',exact:true});
 async function insert(name,value){await course.fill(name);await minutes.fill(value);await add.click();}
 await insert('CSE 3311','45');assert.equal(await page.locator('#total-display').textContent(),'Total study minutes: 45');
 await insert('Algorithms','15');assert.equal(await page.locator('#total-display').textContent(),'Total study minutes: 60');
 await page.getByRole('button',{name:'Remove CSE 3311 study session',exact:true}).click();assert.equal(await page.locator('#total-display').textContent(),'Total study minutes: 15');
 await insert('Invalid fraction','1.5');assert.equal(await page.locator('.session-row').count(),1);
 await insert('   ','5');assert.equal(await page.locator('.session-row').count(),1);
 const hostile='<img src=x onerror=alert(1)>';await insert(hostile,'5');assert.equal(await page.locator('#session-list img').count(),0);await page.getByText(hostile,{exact:true}).waitFor();
 await page.getByRole('button',{name:'Remove '+hostile+' study session',exact:true}).click();await page.getByRole('button',{name:'Remove Algorithms study session',exact:true}).click();await page.getByText('No study sessions recorded.',{exact:true}).waitFor();
 await insert('CSE 3311','45');await insert('Algorithms','15');
 await fs.writeFile(`${outDir}/website.html`,documentHtml(files,false));await page.screenshot({path:`${outDir}/generated-desktop.png`,fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${outDir}/generated-mobile.png`,fullPage:true});assert.deepEqual(errors,[]);
 await fs.writeFile(`${outDir}/browser-verification.json`,JSON.stringify({date:new Date().toISOString(),fixture,passed:['add sessions','sum minutes','delete session','reject fractional minutes','reject whitespace-only course','render HTML-like input as text','empty state','mobile overflow','no uncaught browser errors']},null,2));console.log('PASS: real AI-generated revised site: add, total, delete, invalid input, HTML-like text, empty state, mobile overflow and browser errors.');
}finally{await browser.close();}
