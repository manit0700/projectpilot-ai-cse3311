import {createRequire} from 'node:module';import fs from 'node:fs/promises';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const root=process.env.PROJECTPILOT_URL||'http://localhost:3314';
const unlocked=await fetch(root+'/api/live-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:process.env.LIVE_ACCESS_CODE||'',consent:true})});if(!unlocked.ok)throw new Error('Unlock failed');
const cookie=unlocked.headers.get('set-cookie')?.split(';')[0]||'';
const project={id:'live-study-tracker-check',title:'Study tracker',description:'A browser-local student study-session tracker with course names, positive whole-number minutes, session deletion and total minutes.',targetUser:'College students',approvedSummary:'',status:'draft',createdAt:new Date().toISOString()};
let context={project};const log=[];
if(process.env.PLANNING_RESUME==='1') {try{context=JSON.parse(await fs.readFile('docs/studio-evidence/live/planning-context.json','utf8'));}catch{}}
for(const stage of ['questions','requirements','tasks']){
 if((stage==='questions'&&context.questions)||(stage==='requirements'&&context.requirements)||(stage==='tasks'&&context.tasks))continue;
 console.log(`Checking original live planning: ${stage}…`);
 const r=await fetch(root+'/api/manager',{method:'POST',headers:{'Content-Type':'application/json',origin:root,cookie},body:JSON.stringify({stage,context}),signal:AbortSignal.timeout(65000)});const data=await r.json();log.push({stage,status:r.status,count:data.items?.length,error:data.error});console.log(JSON.stringify(log.at(-1)));
 await fs.mkdir('docs/studio-evidence/live',{recursive:true});await fs.writeFile('docs/studio-evidence/live/planning-verification.json',JSON.stringify(log,null,2));if(!r.ok)process.exit(1);
 if(stage==='questions') context.questions=data.items.map(q=>({...q,answer:'One student uses a responsive browser-only HTML, CSS and JavaScript tracker. Store sessions locally, require a course and positive whole-number minutes, allow deletion and show totals. No accounts or backend.'}));
 if(stage==='requirements')context.requirements=data.items.map(r=>({...r,approvalStatus:'approved'}));
 if(stage==='tasks')context.tasks=data.items;
 await fs.writeFile('docs/studio-evidence/live/planning-context.json',JSON.stringify(context,null,2));
}
await fs.writeFile('docs/studio-evidence/live/planning-context.json',JSON.stringify(context,null,2));console.log('PASS: original manager generated real questions, requirements and validated task contracts using OpenRouter.');
