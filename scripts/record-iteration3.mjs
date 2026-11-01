import { chromium } from 'playwright';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.env.PROJECTPILOT_RECORDING_DIR || path.resolve('docs/iteration3-recording');
await Promise.all(['assets','output','build/video'].map(dir=>fs.mkdir(path.join(root,dir),{recursive:true})));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:root+'/build/video',size:{width:1440,height:1000}}});
const page=await context.newPage(); const started=Date.now(); const events=[],responses=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
page.on('response',async response=>{if(response.url().includes('/api/')) {try{responses.push({url:response.url(),status:response.status(),data:await response.json()});}catch{}}});
async function caption(text){events.push({seconds:(Date.now()-started)/1000,text});await page.evaluate(text=>{let el=document.getElementById('recording-caption');if(!el){el=document.createElement('div');el.id='recording-caption';el.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#102b32;color:white;padding:18px 32px;font:22px/1.4 Arial;box-shadow:0 -2px 12px #0003;pointer-events:none';document.body.appendChild(el);}el.textContent=text;},text);}
async function shot(name){await page.evaluate(()=>{const el=document.getElementById('recording-caption');if(el)el.style.visibility='hidden';});await page.screenshot({path:`${root}/assets/${name}.png`});await page.evaluate(()=>{const el=document.getElementById('recording-caption');if(el)el.style.visibility='visible';});}
async function heading(name){await page.getByRole('heading',{name,exact:true}).waitFor({timeout:180000});}
try{
 await page.goto('https://projectpilot-ai-cse3311.vercel.app',{waitUntil:'networkidle'});
 await page.getByRole('combobox',{name:'Agent mode'}).selectOption('live');
 await page.getByRole('heading',{name:'Live API access and data sharing',exact:true}).waitFor();
 await caption('Live API requires private reviewer access and consent before sending project context to OpenAI.');
 await pause(6000);await shot('00-live-consent');
 await page.getByRole('textbox',{name:'Live access code'}).fill(process.env.LIVE_ACCESS_CODE || '');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Unlock Live API',exact:true}).click();
 await page.getByRole('heading',{name:'New project',exact:true}).waitFor();
 await caption('Iteration 3 live demo: the deployed app uses real OpenAI API responses.');await pause(4500);await shot('01-hosted-app');
 await page.getByRole('textbox',{name:'Project idea',exact:true}).fill('A small browser study-session tracker for one student. Users add a course and study minutes, list sessions, delete a session, and see total minutes. Use local browser storage with no login or server database. Keep this demo compact with four short specialist tasks for frontend, database/storage, testing and documentation. Deliver a concise design or code sample per task, at most 250 words each.');
 await page.getByRole('textbox',{name:'Target user',exact:true}).fill('One CSE student tracking study sessions');
 await caption('The example is a small study tracker. Its scope fits a student web project.');await pause(4500);
 await page.getByRole('button',{name:'Start clarifying questions',exact:true}).click();await heading('Clarifying questions');await shot('02-questions');
 await caption('The live manager asks questions before drafting requirements.');await pause(3500);
 const answers=page.locator('main textarea');
 for(let i=0;i<await answers.count();i++){await answers.nth(i).fill('Single student, desktop and mobile browser. Vanilla HTML/CSS/JavaScript. Store sessions locally with a stable ID, course and positive integer minutes. Show total, add/delete, validation and empty state. No login, sync, deployment, or repository import. Keep four short specialist tasks and outputs under 250 words.');}
 await page.getByRole('button',{name:/Generate requirements/}).click();await heading('Requirements summary');await shot('03-requirements');
 await caption('Every requirement needs human approval before the manager creates the task plan.');await pause(5000);
 const approvals=page.getByRole('button',{name:'Approve',exact:true});for(let i=0;i<await approvals.count();i++){await approvals.nth(i).click();await pause(350);}
 await page.getByRole('button',{name:/Approve requirements/}).click();await heading('Task breakdown');await shot('04-task-plan');
 await caption('Tasks have specialist roles, expected outputs and dependencies. Approval starts execution.');await pause(6500);
 await page.getByRole('button',{name:'Approve plan & run agents',exact:true}).click();
 await caption('Live specialists run in dependency order and receive completed prerequisite deliverables.');await pause(3500);await shot('05-agent-board');
 // Wait for real service calls. If a task fails, use the product's real manual retry.
 for(let round=0;round<5;round++){
  const arrived=await page.getByRole('heading',{name:'Review outputs',exact:true}).isVisible();if(arrived)break;
  const retries=page.getByRole('button',{name:'Retry task',exact:true});
  if(await retries.count()){await caption('A live call failed. Retry task preserves completed work and retries only the failed task.');await shot('05b-retry');await retries.first().click();}
  const ready=page.getByRole('button',{name:'Run remaining ready tasks',exact:true});if(await ready.isVisible().catch(()=>false))await ready.click();
  await page.getByRole('heading',{name:'Review outputs',exact:true}).waitFor({timeout:160000}).catch(()=>{});
 }
 await heading('Review outputs');
 const missing=page.getByText(/Review is incomplete/);if(await missing.isVisible().catch(()=>false)){await page.getByRole('button',{name:'Retry review'}).click();await pause(35000);}
 await caption('The AI review shows findings. It cannot approve its own work or claim generated tests ran.');await shot('06-live-review');await pause(6500);
 await page.evaluate(()=>window.scrollBy(0,500));await pause(4500);await shot('07-specialist-output');
 // Select documentation (usually last) to demonstrate a compact targeted revision.
 const outputApprovals=page.getByRole('button',{name:'Approve output',exact:true});const n=await outputApprovals.count();
 for(let i=0;i<n-1;i++){if(await outputApprovals.nth(i).isEnabled())await outputApprovals.nth(i).click();}
 const initialState=await page.evaluate(()=>JSON.parse(localStorage.getItem('projectpilot-v2')).state);
 for(let i=0;i<initialState.outputs.length;i++){if(initialState.reviews.some(r=>r.outputId===initialState.outputs[i].id && r.conflicts.length))await page.getByRole('button',{name:'Request revision',exact:true}).nth(i).click();}
 await page.getByRole('button',{name:'Request revision',exact:true}).last().click();
 await page.getByRole('button',{name:'Continue to feedback',exact:true}).click();await heading('Feedback / revision');
 await page.getByRole('textbox',{name:'Feedback for the Manager Agent'}).fill('Revise this deliverable to explicitly cover invalid study minutes, an empty sessions list, and checking that deleted sessions no longer count toward the total. Keep the revised output under 250 words.');
 await caption('Feedback sends the previous deliverable and requested change back to the selected specialist.');await shot('08-feedback');await pause(5500);
 await page.getByRole('button',{name:'Apply feedback',exact:true}).click();await heading('Review outputs');
 await caption('The live revision produces a new deliverable. Affected outputs need fresh human approval.');await pause(5000);
 await page.getByRole('button',{name:'Approve output',exact:true}).last().scrollIntoViewIfNeeded();await shot('09-revised-output');await pause(5000);
 for(let round=0;round<3;round++){
   const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('projectpilot-v2')).state);
   const conflicts=state.reviews.filter(r=>r.result==='conflict'||r.conflicts.length);
   if(!conflicts.length)break;
   await caption('Unresolved conflicts block approval. We request a real revision and review again.');
   await shot('09b-conflict-gate');await pause(5000);
   for(const review of conflicts){const i=state.outputs.findIndex(o=>o.id===review.outputId);await page.getByRole('button',{name:'Request revision',exact:true}).nth(i).click();}
   await page.getByRole('button',{name:'Continue to feedback',exact:true}).click();
   await page.getByRole('textbox',{name:'Feedback for the Manager Agent'}).fill('Resolve these actual cross-output conflicts. Match the approved requirements and existing prerequisite code. Do not introduce new features or interfaces. Rewrite the selected deliverable fully: '+conflicts.flatMap(r=>r.conflicts).join('; '));
   await page.getByRole('button',{name:'Apply feedback',exact:true}).click();await heading('Review outputs');
 }
 const all=page.getByRole('button',{name:'Approve output',exact:true});for(let i=0;i<await all.count();i++)await all.nth(i).click();
 await page.getByRole('button',{name:'Continue to feedback',exact:true}).click();await page.getByRole('button',{name:'Skip revisions & finalize approved plan',exact:true}).click();await heading('Final project plan');
 await caption('The final package includes approved deliverables and revision history. Download keeps a separate copy.');await shot('10-final');await pause(6000);
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download Markdown',exact:true}).click();await(await downloaded).saveAs(root+'/output/Iteration3_Demo_Approved_Output.md');
 await caption('Next iteration: assemble actual project files, run builds and tests, and provide a working preview.');await pause(6500);
 await fs.writeFile(root+'/build/live-demo-evidence.json',JSON.stringify({events,responses},null,2));
 console.log('RECORDING COMPLETE: '+responses.length+' actual hosted API responses');
}catch(error){await page.screenshot({path:root+'/build/recording-error.png'});await fs.writeFile(root+'/build/live-demo-evidence.json',JSON.stringify({events,responses,error:String(error)},null,2));throw error;}
finally{const video=page.video();await context.close();await video.saveAs(root+'/build/iteration3-live-final.webm');await browser.close();}
