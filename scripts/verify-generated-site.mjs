import {createRequire} from 'node:module';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const req=createRequire(import.meta.url),ts=req('typescript'),m={exports:{}};
new Function('module','exports',ts.transpileModule(await fs.readFile('src/lib/studio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports);
const files=JSON.parse(await fs.readFile('docs/studio-evidence/live/files.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent(m.exports.documentHtml(files,true));
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
 await fs.writeFile('docs/studio-evidence/live/website.html',m.exports.documentHtml(files,false));await page.screenshot({path:'docs/studio-evidence/live/generated-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'docs/studio-evidence/live/generated-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 await fs.writeFile('docs/studio-evidence/live/browser-verification.json',JSON.stringify({date:new Date().toISOString(),passed:['add sessions','sum minutes','delete session','reject fractional minutes','reject whitespace-only course','render HTML-like input as text','empty state','mobile overflow','no uncaught browser errors']},null,2));console.log('PASS: real AI-generated revised site: add, total, delete, invalid input, HTML-like text, empty state, mobile overflow and browser errors.');
}finally{await browser.close();}
