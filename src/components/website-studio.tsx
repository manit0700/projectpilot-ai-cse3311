"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { handoffKey, validHandoff, type StudioHandoff } from '@/lib/studio-handoff';
import { sseData } from '@/lib/studio-stream';
import { LiveAccess } from './live-access';
import { documentHtml, starter, validFiles, type SiteFiles, type StudioMessage } from '@/lib/studio';
type Version = { name: string; files: SiteFiles };
const storageKey = 'projectpilot-website-studio-v1';
export function WebsiteStudio() {
  const [brief, setBrief] = useState('Build a portfolio website for a student software developer with projects, skills, and a contact section.');
  const [plan, setPlan] = useState('');
  const [files, setFiles] = useState<SiteFiles>(starter);
  const [preview, setPreview] = useState<SiteFiles>(starter);
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [tab, setTab] = useState<keyof SiteFiles>('html');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('Loading workspace…');
  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [rounds, setRounds] = useState(1);
  const [github, setGithub] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [copyFields, setCopyFields] = useState<{ index: number; tag: string; text: string }[]>([]);
  const [sourcePlan, setSourcePlan] = useState<StudioHandoff | null>(null);
  const [pendingPlan, setPendingPlan] = useState<StudioHandoff | null>(null);
  const [liveText, setLiveText] = useState('');
  const [liveModel, setLiveModel] = useState('');
  const [activity, setActivity] = useState<Record<string, { status: string; task: string }>>({
    plan: { status: 'Waiting', task: 'Read the confirmed idea and prepare the website design.' },
    build: { status: 'Waiting', task: 'Turn the approved plan into HTML, CSS, and JavaScript.' },
    review: { status: 'Waiting', task: 'Inspect the actual files and send findings to the developer.' }
  });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const restoreTimer = setTimeout(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (!validFiles(s.files) || typeof s.brief !== 'string' || typeof s.plan !== 'string' || !Array.isArray(s.messages) || !s.messages.every((m: StudioMessage) => typeof m?.role === 'string' && typeof m?.text === 'string') || !Array.isArray(s.versions) || !s.versions.every((v: Version) => typeof v?.name === 'string' && validFiles(v.files))) throw new Error('Invalid save');
        if (validHandoff(s.sourcePlan)) { setSourcePlan(s.sourcePlan); setActivity(a => ({...a,plan:{status:'Completed',task:'Idea, requirements, and task plan confirmed in the original workflow.'}})); }
        setBrief(s.brief); setPlan(s.plan); setFiles(s.files); setPreview(s.files); setMessages(s.messages); setVersions(s.versions);
      }
      setSaveStatus('Saved in this browser');
    } catch { setError('The saved workspace could not be restored. Downloaded files are unaffected.'); setSaveStatus('Could not restore saved workspace'); }
    try { const incoming = JSON.parse(sessionStorage.getItem(handoffKey) || 'null'); if (validHandoff(incoming)) setPendingPlan(incoming); } catch {}
    setReady(true);
    }, 0);
    fetch('/api/live-access').then(r => r.json()).then(s => setAccess(s.authenticated === true)).catch(() => {});
    return () => { clearTimeout(restoreTimer); abort.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let status = 'Saved in this browser';
    try { localStorage.setItem(storageKey, JSON.stringify({ brief, plan, files, messages, versions, sourcePlan })); }
    catch { status = 'Browser storage is full. Download your website to keep changes.'; }
    const timer = setTimeout(() => setSaveStatus(status), 0);
    return () => clearTimeout(timer);
  }, [ready, brief, plan, files, messages, versions, sourcePlan]);
  function say(role: string, text: string, model?: string) { setMessages(m => [...m, { role, text, model }]); }
  function checkpoint(next: SiteFiles, name: string) {
    setCopyFields([]);
    setVersions(v => [...v.slice(-7), { name, files: next }]); setFiles(next); setPreview(next);
  }
  function acceptPlan() {
    if (!pendingPlan) return;
    setVersions(v => [...v.slice(-7), { name: 'Before importing confirmed idea', files }]);
    setActivity(a => ({...a,plan:{status:'Completed',task:'Idea, requirements, and task plan confirmed in the original workflow.'}}));
    setSourcePlan(pendingPlan); setBrief(pendingPlan.brief); setPlan(pendingPlan.plan);
    setFiles(starter); setPreview(starter); setCopyFields([]); setError('');
    setMessages([{ role: 'Planning → Website team', text: `You confirmed ${pendingPlan.title} in the original planning workflow. The approved requirements, task contracts, dependencies, and constraints have been carried into this workspace.` }]);
    setPendingPlan(null); sessionStorage.removeItem(handoffKey);
  }
  async function call(stage: string, site: SiteFiles, approvedPlan: string, note: string, signal: AbortSignal) {
    setLiveText(''); setLiveModel('Selecting a free model…');
    const task = stage === 'plan' ? 'Preparing the website design from your confirmed idea.' : stage === 'build' ? note ? 'Rewriting the website using your feedback and reviewer findings.' : 'Writing the HTML, CSS, and JavaScript from the approved plan.' : 'Checking the generated source against the approved requirements.';
    setActivity(a => ({ ...a, [stage]: { status: 'Working live', task } }));
    const response = await fetch('/api/studio', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, brief, plan: approvedPlan, files: site, feedback: note, live: true }) });
    let result;
    if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
      let output = '';
      for await (const data of sseData(response.body)) {
        const event = JSON.parse(data);
        if (event.model) setLiveModel(event.model);
        if (event.type === 'delta') { output += event.text; setLiveText(output); }
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'result') result = event.result;
      }
      if (!result) throw new Error('The live response ended before the agent finished. Retry this step.');
    } else result = await response.json();
    if (!response.ok) { if (response.status === 401) setAccess(false); throw new Error(result.error || 'Agent request failed.'); }
    setActivity(a => ({ ...a, [stage]: { status: 'Completed', task: stage === 'plan' ? 'Design ready for your approval.' : stage === 'build' ? 'Website files sent to the reviewer.' : 'Source review delivered. Browser testing still needed.' } }));
    return result;
  }
  async function run(kind: 'plan' | 'build' | 'revise' | 'review') {
    if (!sourcePlan) { setError('Confirm your idea in the original planning workflow first.'); return; }
    const controller = new AbortController(); abort.current = controller;
    setBusy(kind === 'plan' ? 'Manager is planning…' : kind === 'review' ? 'Reviewer is inspecting the source…' : 'Developer is building…'); setError('');
    try {
      if (kind === 'review') {
        const result = await call('review', files, plan, feedback, controller.signal);
        say('Reviewer → You', result.text, result.model);
      } else if (kind === 'plan') {
        const result = await call('plan', files, sourcePlan?.plan || '', '', controller.signal);
        setPlan(result.text); say('Manager → Developer', result.text, result.model);
      } else {
        setVersions(v => [...v.slice(-7), { name: 'Before agent changes', files }]);
        const note = kind === 'revise' ? feedback : '';
        if (note) say('You → Team', note);
        let site = files;
        let review = note;
        for (let i = 0; i <= rounds; i++) {
          setBusy(i ? `Developer is addressing review ${i}…` : 'Developer is building…');
          const result = await call('build', site, plan, review, controller.signal);
          if (!validFiles(result.files)) throw new Error('Agent returned invalid files.');
          site = result.files; checkpoint(site, i ? `Revision ${i}` : 'First build');
          say('Developer → Reviewer', i ? 'Updated the website using the review findings. Source is ready for another review.' : 'Created the website files. Please inspect the implementation against the approved plan.', result.model);
          setBusy('Reviewer is inspecting the source…');
          const checked = await call('review', site, plan, note, controller.signal);
          review = checked.text; say('Reviewer → Developer', review, checked.model);
        }
        say('Manager → You', 'The bounded build and source-review cycle is complete. Preview the site, test its interactions, and edit the files or request another revision. The agents have not executed browser tests.');
        setFeedback('');
      }
    } catch (e) { setActivity(a => Object.fromEntries(Object.entries(a).map(([key, value]) => [key, value.status === 'Working live' ? { ...value, status: controller.signal.aborted ? 'Stopped' : 'Needs retry' } : value]))); setError(controller.signal.aborted ? 'Stopped. Completed files and messages are preserved.' : e instanceof Error ? e.message : 'Request failed.'); }
    finally { setBusy(''); abort.current = null; }
  }
  async function githubAction(action: 'connect' | 'import' | 'publish') {
    const controller = new AbortController(); abort.current = controller;
    setBusy('Connecting to GitHub MCP…'); setError(''); setPrUrl('');
    try {
      const response = await fetch('/api/studio/github', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(action === 'publish' ? { files, confirm: true } : {}) }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) setAccess(false); throw new Error(result.error || 'GitHub request failed.'); }
      setGithub(result.repository);
      if (action === 'import') { if (!validFiles(result.files)) throw new Error('Invalid imported website.'); setVersions(v => [...v.slice(-7), { name: 'Before GitHub import', files }]); checkpoint(result.files, 'Imported from GitHub'); say('GitHub MCP → Team', 'Imported projectpilot-site/index.html from ' + result.repository + '. This source is now available to the developer for revision.'); }
      if (action === 'publish') { setPrUrl(result.url); say('GitHub MCP → You', 'Created a draft pull request in ' + result.repository + ' on branch ' + result.branch + '. Review it on GitHub before merging.'); }
    } catch (e) { setError(controller.signal.aborted ? 'Stopped waiting for GitHub. Check the repository for partially completed operations before retrying.' : e instanceof Error ? e.message : 'GitHub request failed.'); }
    finally { setBusy(''); abort.current = null; }
  }
  function showCopyEditor() {
    const doc = new DOMParser().parseFromString(files.html, 'text/html');
    setCopyFields([...doc.body.querySelectorAll('h1,h2,h3,p,a,button,label')].map((el, index) => ({ index, tag: el.tagName.toLowerCase(), text: el.textContent || '', simple: el.children.length === 0 })).filter(f => f.simple && f.text.trim()).slice(0, 40));
  }
  function editCopy(index: number, text: string) {
    const doc = new DOMParser().parseFromString(files.html, 'text/html');
    const element = doc.body.querySelectorAll('h1,h2,h3,p,a,button,label')[index];
    if (!element) return;
    element.textContent = text;
    setCopyFields(fields => fields.map(f => f.index === index ? { ...f, text } : f));
    setFiles(f => ({ ...f, html: /<!doctype|<html/i.test(f.html) ? '<!doctype html>' + doc.documentElement.outerHTML : doc.body.innerHTML }));
  }
  function download() {
    const url = URL.createObjectURL(new Blob([documentHtml(files, false)], { type: 'text/html' }));
    const a = document.createElement('a'); a.href = url; a.download = 'projectpilot-website.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="studio">
    <header className="studio-header"><Link href="/">ProjectPilot AI / Planning</Link><span className="studio-badge">WEBSITE STUDIO · FREE MODELS</span><span role="status">{saveStatus}</span></header>
    <main className="studio-main">
      <div className="studio-title"><div><p className="studio-eyebrow">FROM IDEA TO SOMETHING YOU CAN OPEN</p><h1>Build it. Make it yours.</h1><p>Your agents plan, build, and review. You stay in control of every line.</p></div><button className="studio-button" onClick={download} disabled={!ready}>Download website</button></div>
      <nav className="studio-flow" aria-label="Project stages"><Link href="/">1. Confirm idea & requirements</Link><span aria-current="step">2. Build with live agents</span><span>3. Edit, test & export</span></nav>
      {pendingPlan && <section className="studio-panel studio-incoming" aria-label="Confirmed idea handoff"><h2>Continue with {pendingPlan.title}</h2><p>Your original planning requirements and task plan are ready. Importing starts a new website draft and keeps your current files in saved versions.</p><button className="studio-button" disabled={!!busy} onClick={acceptPlan}>Import confirmed idea</button><button className="studio-button studio-secondary" disabled={!!busy} onClick={() => { setPendingPlan(null); sessionStorage.removeItem(handoffKey); }}>Keep current workspace</button></section>}
      {!sourcePlan && !pendingPlan && <section className="studio-panel studio-incoming"><h2>First, confirm what we are building.</h2><p>Start with the original ProjectPilot screens: idea, clarifying questions, approved requirements, and task breakdown. Then choose Confirm idea & open Website Studio.</p><Link href="/" className="studio-button">Start with idea confirmation</Link></section>}
      {sourcePlan && <p className="studio-muted">Confirmed project: <strong>{sourcePlan.title}</strong> · Requirements and task plan carried over from ProjectPilot. <Link href="/">Return to planning</Link></p>}
      <section className="studio-agents" aria-label="Live agent activity" aria-live="polite">{([['plan', 'Manager / Designer'], ['build', 'Developer'], ['review', 'Reviewer']] as const).map(([id, name]) => <article className="studio-panel" key={id} data-working={activity[id].status === 'Working live'}><h2>{name}</h2><strong className="studio-agent-status">{activity[id].status}</strong><p>{activity[id].task}</p></article>)}</section>
      <details className="studio-panel studio-live" open={!!busy || undefined}><summary>Live response · {liveModel || 'No model running'}</summary><p className="studio-muted">Actual model output appears here as it arrives. Agents run in dependency order: manager → developer → reviewer → developer revisions. Only public response text is shown; source review does not run browser tests.</p><pre aria-label="Live agent response">{liveText || 'Waiting for an agent request. No prepared responses are used for live builds.'}</pre></details>
      {error && <p role="alert" className="studio-error">{error}</p>}
      {sourcePlan && files.html !== starter.html && <button className="studio-button" disabled={!!busy || !access || !sourcePlan || !plan.trim()} onClick={() => run('review')}>{activity.review.status === 'Needs retry' ? 'Retry source review' : 'Review current website'}</button>}
      <div className="studio-grid">
        <section className="studio-panel studio-controls" aria-label="Build controls">
          <h2>01 / Your direction</h2>
          <label>What are we making?<textarea value={brief} readOnly={!!sourcePlan} disabled={!!busy} maxLength={12000} onChange={e => { setBrief(e.target.value); setPlan(''); }} rows={5} /></label>
          {!access && <details><summary>Unlock OpenRouter agents</summary><LiveAccess provider="openrouter" onUnlocked={() => setAccess(true)} /></details>}
          <p className="studio-muted">Static HTML, CSS, and JavaScript. Free models only. No automatic paid fallback.</p>
          <button className="studio-button" disabled={!ready || !!busy || !access || !sourcePlan || brief.trim().length < 10} onClick={() => run('plan')}>Create a plan</button>
          {plan && <><label>Review and edit the plan<textarea value={plan} maxLength={18000} disabled={!!busy} rows={8} onChange={e => setPlan(e.target.value)} /></label><label>Automatic review rounds<select disabled={!!busy} value={rounds} onChange={e => setRounds(Number(e.target.value))}><option value={0}>Review only · 2 requests</option><option value={1}>1 revision · 4 requests</option><option value={2}>2 revisions · 6 requests</option></select></label><button className="studio-button" disabled={!!busy || !access || !sourcePlan || !plan.trim()} onClick={() => run('build')}>Approve plan & build</button></>}
          {busy && <div role="status" aria-live="polite"><p>{busy}</p><button className="studio-button studio-secondary" onClick={() => abort.current?.abort()}>Stop agents</button></div>}
          <details><summary>GitHub through MCP</summary><p className="studio-muted">Connect to the server-configured repository. Import a previously published site or submit your current files as a draft pull request. Your default branch stays unchanged.</p><div className="studio-tabs"><button className="studio-button studio-secondary" disabled={!!busy || !access} onClick={() => githubAction('connect')}>Connect GitHub</button><button className="studio-button studio-secondary" disabled={!!busy || !access || !github} onClick={() => githubAction('import')}>Import website</button><button className="studio-button" disabled={!!busy || !access || !github} onClick={() => githubAction('publish')}>Create draft pull request</button></div>{github && <p className="studio-muted">Repository: {github}</p>}{prUrl && <a href={prUrl} target="_blank" rel="noreferrer">Open draft pull request</a>}</details>
          <h2>02 / The conversation</h2>
          <div className="studio-conversation" role="log" aria-label="Agent handoffs" aria-live="polite">{messages.length ? messages.map((m, i) => <article key={i}><strong>{m.role}</strong>{m.model && <small>{m.model}</small>}<p>{m.text}</p></article>) : <p className="studio-muted">Agent decisions and review findings will appear here. The starter preview is local sample content.</p>}</div>
          <label>Ask for a change<textarea value={feedback} disabled={!!busy} maxLength={18000} rows={3} onChange={e => setFeedback(e.target.value)} placeholder="Make the header smaller and add a working project filter…" /></label>
          <button className="studio-button" disabled={!!busy || !access || !sourcePlan || !plan.trim() || !feedback.trim()} onClick={() => run('revise')}>Revise with agents</button>
        </section>
        <section className="studio-panel studio-workspace" aria-label="Website editor and preview">
          <div className="studio-toolbar"><h2>03 / Your website</h2><div><button className="studio-button studio-secondary" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? 'Desktop preview' : 'Mobile preview'}</button><button className="studio-button" disabled={!!busy} onClick={() => setPreview(files)}>Apply edits</button></div></div>
          <div className={`studio-preview ${mobile ? 'studio-mobile' : ''}`}><iframe title="Generated website preview" sandbox="allow-scripts" srcDoc={documentHtml(preview)} referrerPolicy="no-referrer" /></div>
          <p className="studio-muted">Preview blocks network requests, forms, and access to ProjectPilot data. Download to test the website independently.</p>
          <details><summary onClick={() => { if (!busy) showCopyEditor(); }}>Edit page text without code</summary><p className="studio-muted">Change headings, paragraphs, links, and button labels. Apply edits to update the preview. Use the code editor for layout, styles, links, and behavior.</p><div className="studio-copy">{copyFields.length ? copyFields.map(field => <label key={field.index}>{field.tag.toUpperCase()} text<input disabled={!!busy} value={field.text} maxLength={4000} onChange={e => editCopy(field.index, e.target.value)} /></label>) : <p className="studio-muted">No simple text fields found. You can edit all markup below.</p>}</div></details>
          <div className="studio-tabs" role="group" aria-label="File selection">{(['html', 'css', 'js'] as const).map(k => <button className="studio-button studio-secondary" key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k === 'html' ? 'index.html' : k === 'css' ? 'styles.css' : 'script.js'}</button>)}</div>
          <label className="studio-code-label">Edit {tab.toUpperCase()}<textarea className="studio-code" spellCheck={false} aria-label={`Edit ${tab.toUpperCase()}`} disabled={!!busy} value={files[tab]} onChange={e => { setCopyFields([]); setFiles(f => ({ ...f, [tab]: e.target.value })); }} /></label>
          <div className="studio-toolbar"><p className="studio-muted">Edits save automatically. Apply edits refreshes the preview.</p><button className="studio-button studio-secondary" disabled={!!busy} onClick={() => setVersions(v => [...v.slice(-7), { name: 'Manual checkpoint', files }])}>Save version</button></div>
          {versions.length > 0 && <label>Restore a saved version<select disabled={!!busy} value="" onChange={e => { const selected = versions[Number(e.target.value)]; if (selected) { setVersions(v => [...v.slice(-7), { name: 'Before restore', files }]); setCopyFields([]); setFiles(selected.files); setPreview(selected.files); } }}><option value="">Choose a version…</option>{versions.map((v, i) => <option value={i} key={i}>{i + 1}. {v.name}</option>)}</select></label>}
        </section>
      </div>
    </main>
  </div>;
}
