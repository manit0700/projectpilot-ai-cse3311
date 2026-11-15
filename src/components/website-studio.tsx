"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { documentHtml, starter, studioMode, type SiteFiles } from "@/lib/studio";
import { agentPlan, handoffKey, tidyBrief, validHandoff, type StudioHandoff } from "@/lib/studio-handoff";
import { planChanged, readSavedPlan, sendFindingsToPlanning } from "@/lib/studio-sync";
import { LIVE_CONSENT_KEY } from "./live-access";
import { AgentCards, importedTask, LiveResponse, ModePill } from "./studio-agents";
import { StudioControls } from "./studio-controls";
import {
  downloadText, emptyWorkspace, persistWorkspace, readRecovery, restoreWorkspace, type Version, type Workspace,
} from "./studio-storage";
import { Button, buttonStyles, mutedStyles, Panel, useWide } from "./studio-ui";
import { useStudioRun } from "./studio-use-run";
import { StudioWorkspace } from "./studio-workspace";

// "paused" means a damaged save was found: autosave stays off until the user chooses to start fresh.
type Persistence = "loading" | "ready" | "paused";
const recoveryNotice = "A previous save could not be read; a recovery copy was kept. Autosave is paused so the " +
  "damaged save is not overwritten. Keep working, download the recovery copy, or start fresh.";

export function WebsiteStudio() {
  const [ws, setWs] = useState<Workspace>(emptyWorkspace);
  const [persistence, setPersistence] = useState<Persistence>("loading");
  const [saveStatus, setSaveStatus] = useState("Loading workspace…");
  const [preview, setPreview] = useState<SiteFiles>(starter);
  const [access, setAccess] = useState(false);
  // Demo is the default: a fresh tab has not accepted the data-sharing notice, whatever the server says about access.
  const [consent, setConsent] = useState(false);
  const [versionNote, setVersionNote] = useState("");
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "openrouter">("openrouter");
  const [pendingPlan, setPendingPlan] = useState<StudioHandoff | null>(null);
  // The saved planning project moved on since this draft was imported.
  const [planUpdate, setPlanUpdate] = useState<StudioHandoff | null>(null);
  const [syncNote, setSyncNote] = useState("");
  const [rounds, setRounds] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [liveOpen, setLiveOpen] = useState<boolean | null>(null);
  const wide = useWide();
  const live = studioMode({ access, configured, consent }) === "live";
  const ready = persistence !== "loading";

  const update = (patch: Partial<Workspace> | ((w: Workspace) => Partial<Workspace>)) =>
    setWs((w) => ({ ...w, ...(typeof patch === "function" ? patch(w) : patch) }));
  const say = (role: string, text: string, model?: string) =>
    update((w) => ({ messages: [...w.messages, { role, text, model }] }));
  const snapshot = (name: string) => update((w) => ({ versions: [...w.versions.slice(-7), { name, files: w.files }] }));
  const saveManualVersion = () => {
    snapshot("Manual checkpoint");
    setVersionNote(`Version ${Math.min(ws.versions.length + 1, 8)} saved`);
  };
  const checkpoint = (files: SiteFiles, name: string) => {
    update((w) => ({ versions: [...w.versions.slice(-7), { name, files }], files }));
    setPreview(files);
  };
  const agents = useStudioRun({
    live, provider, projectName: ws.sourcePlan?.title, onUnauthorized: () => setAccess(false), brief: ws.brief, design: ws.design,
    setDesign: (design) => update({ design }), sourcePlan: ws.sourcePlan ? agentPlan(ws.sourcePlan) : null, files: ws.files,
    rounds, feedback, setFeedback, say, checkpoint, snapshot,
  });
  // An imported plan completes the first stage until the designer actually runs.
  const activity = ws.sourcePlan && agents.activity.plan.status === "Waiting"
    ? { ...agents.activity, plan: { status: "Completed", task: importedTask } } : agents.activity;

  useEffect(() => {
    const timer = setTimeout(() => {
      const restored = restoreWorkspace();
      try { setConsent(sessionStorage.getItem(LIVE_CONSENT_KEY) === "1"); } catch { /* Storage unavailable: stay in demo. */ }
      if (restored.status === "restored") {
        const saved = restored.workspace;
        // Handoffs saved before the title was de-duplicated repeat it at the start of the brief.
        const brief = saved.sourcePlan && saved.brief === saved.sourcePlan.brief ? tidyBrief(saved.sourcePlan) : saved.brief;
        setWs({ ...saved, brief }); setPreview(saved.files);
      }
      if (restored.status === "failed") { setSaveStatus("Autosave paused"); setPersistence("paused"); }
      else { setSaveStatus("Saved in this browser"); setPersistence("ready"); }
      let incoming: StudioHandoff | null = null;
      try {
        const parsed = JSON.parse(sessionStorage.getItem(handoffKey) || "null");
        if (validHandoff(parsed)) incoming = parsed;
      } catch { /* Ignore unreadable handoff data. */ }
      // Read the saved planning project directly, so Studio works from any tab and without pressing the hand-off button.
      const saved = incoming ?? readSavedPlan();
      const current = restored.status === "restored" ? restored.workspace.sourcePlan : null;
      if (saved && (!current || current.projectId !== saved.projectId)) setPendingPlan(saved);
      else if (saved && current && planChanged(current, saved)) setPlanUpdate(saved);
    }, 0);
    fetch("/api/live-access").then((r) => r.json()).then((s) => setAccess(s.authenticated === true)).catch(() => {});
    fetch("/api/manager").then((r) => r.json())
      .then((c) => { setConfigured(c.studioConfigured === true); setProvider(c.studioProvider === "gemini" ? "gemini" : "openrouter"); }).catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  // Planning edits made in another tab arrive through the shared browser storage.
  useEffect(() => {
    const source = ws.sourcePlan;
    if (!source || persistence !== "ready") return;
    const check = () => {
      const saved = readSavedPlan();
      setPlanUpdate(saved && saved.projectId === source.projectId && planChanged(source, saved) ? saved : null);
    };
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => { window.removeEventListener("storage", check); window.removeEventListener("focus", check); };
  }, [ws.sourcePlan, persistence]);

  useEffect(() => {
    if (!versionNote) return;
    const timer = setTimeout(() => setVersionNote(""), 8000);
    return () => clearTimeout(timer);
  }, [versionNote]);

  useEffect(() => {
    if (persistence !== "ready") return;
    const saved = persistWorkspace(ws);
    const timer = setTimeout(() => setSaveStatus(saved ? "Saved in this browser"
      : "Browser storage is full. Download your website to keep changes."), 0);
    return () => clearTimeout(timer);
  }, [persistence, ws]);

  function acceptPlan() {
    if (!pendingPlan) return;
    const plan = pendingPlan;
    setWs((w) => ({
      brief: tidyBrief(plan), design: "", files: starter, sourcePlan: plan,
      versions: [...w.versions.slice(-7), { name: "Before importing confirmed idea", files: w.files }],
      messages: [{ role: "Planning → Website team", text: `You confirmed ${plan.title} in the original planning ` +
        "workflow. The approved requirements, task contracts, dependencies, and constraints have been carried into " +
        "this workspace. Next, ask the designer to turn them into a website design." }],
    }));
    setPreview(starter); agents.setError("");
    dismissPlan();
  }
  /** Swaps in the updated plan and keeps every website file. A brief the user edited by hand is left alone. */
  function resyncPlan() {
    if (!planUpdate || !ws.sourcePlan) return;
    const next = planUpdate, previous = ws.sourcePlan;
    setWs((w) => ({
      ...w,
      sourcePlan: next,
      brief: w.brief === tidyBrief(previous) ? tidyBrief(next) : w.brief,
      versions: [...w.versions.slice(-7), { name: "Before plan re-sync", files: w.files }],
      messages: [...w.messages, { role: "Planning → Website team", text: `The planning project changed. The updated requirements and task plan for ${next.title} replace the earlier ones. ` +
        "Your website files are unchanged. Ask the designer to revise the design, then rebuild." }],
    }));
    setPlanUpdate(null);
    setSyncNote("Plan re-synced. The website below is still the old build. Click Design the website from this plan, then approve to rebuild it.");
  }
  const lastReview = [...ws.messages].reverse().find((m) => m.role.startsWith("Reviewer") && m.text.trim());
  function sendReview() {
    if (!ws.sourcePlan || !lastReview) return;
    setSyncNote(sendFindingsToPlanning(lastReview.text, ws.sourcePlan.projectId) ?? "Review added to planning feedback. Open planning and go to the Feedback step to apply it.");
  }
  function downloadRecovery() {
    const raw = readRecovery();
    if (raw) downloadText("projectpilot-website-studio-recovery.txt", raw);
  }
  function dismissPlan() { setPendingPlan(null); sessionStorage.removeItem(handoffKey); }
  function restoreVersion(version: Version) {
    update((w) => ({ versions: [...w.versions.slice(-7), { name: "Before restore", files: w.files }], files: version.files }));
    setPreview(version.files);
  }
  // The output box stays closed until an agent has something to show, so the website preview sits higher on the page.
  const liveDefault = wide && (live || !!agents.busy || !!agents.liveText);
  const reviewReason = agents.busy ? "Agents are working. Wait for them or stop them."
    : !ws.design.trim() ? "Design the website from the imported plan first" : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_14%_8%,rgba(255,255,255,0.96),transparent_27%),linear-gradient(135deg,#f7f1ff_0%,#eee2ff_55%,#faf7ff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_14%_8%,rgba(91,33,182,0.18),transparent_27%),linear-gradient(135deg,#130d21_0%,#1d1230_55%,#0f0b18_100%)] dark:text-slate-50">
      <header className="border-b border-violet-800 bg-gradient-to-r from-[#2d1748] via-[#3c205f] to-[#291640] text-white shadow-[0_10px_32px_rgba(39,19,64,0.24)]">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-2xl font-bold tracking-tight text-white"><span aria-hidden="true" className="text-violet-300">➤</span>ProjectPilot AI</Link>
            <ModePill live={live} provider={provider} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20">← Planning</Link>
            <Button disabled={!ready} disabledReason="Loading workspace"
              className="border border-violet-300/40 bg-gradient-to-r from-violet-500 to-purple-500 shadow-[0_8px_22px_rgba(139,92,246,0.3)] hover:from-violet-400 hover:to-purple-400"
              onClick={() => downloadText("projectpilot-website.html", documentHtml(ws.files, false), "text/html")}>
              Download website ↓
            </Button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="mx-auto max-w-[100rem] px-4 pb-4 text-sm text-violet-100 sm:px-6">
          <span>{saveStatus}</span>
          {versionNote && <span> · <strong className="font-semibold text-white">{versionNote}</strong></span>}
          {" · "}{live ? `Live · ${provider === "gemini" ? "Gemini" : "OpenRouter"} · Generated code needs human testing.`
            : "Demo mode · Prepared output from a real earlier run."}
        </p>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-[100rem] min-w-0 space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 text-2xl text-white shadow-[0_10px_24px_rgba(109,40,217,0.24)]">⌘</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-600 dark:text-violet-300">AI website workspace</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-violet-950 dark:text-violet-100 sm:text-4xl">Website Studio</h1>
            <p className="mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-300">Turn your approved project plan into a website with your AI team.</p>
          </div>
        </div>
        {persistence === "paused" && (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <p>{recoveryNotice}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={downloadRecovery}>Download recovery copy</Button>
              <Button onClick={() => setPersistence("ready")}>Start fresh and resume autosave</Button>
            </div>
          </div>
        )}
        {pendingPlan && (
          <Panel aria-label="Confirmed idea handoff" className="grid gap-3 border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50/70 dark:border-violet-800 dark:from-violet-950/45 dark:to-purple-950/25">
            <h2 className="text-lg font-bold text-violet-950 dark:text-violet-100">Continue with {pendingPlan.title}</h2>
            <p className={mutedStyles}>
              Your original planning requirements and task plan are ready. Importing starts a new website draft and
              keeps your current files in saved versions.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!!agents.busy} disabledReason="Agents are working. Wait for them or stop them."
                onClick={acceptPlan}>Import confirmed idea</Button>
              <Button variant="secondary" disabled={!!agents.busy} disabledReason="Agents are working. Wait for them or stop them."
                onClick={dismissPlan}>Keep current workspace</Button>
            </div>
          </Panel>
        )}
        {planUpdate && ws.sourcePlan && (
          <Panel aria-label="Plan changed" className="grid gap-3 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
            <h2 className="text-lg font-bold text-amber-950 dark:text-amber-100">Plan changed since this draft</h2>
            <p className={mutedStyles}>
              Planning has updated requirements or tasks for {planUpdate.title}. Re-syncing replaces the plan the agents
              use. The website below only changes after you design and rebuild it. Your files and saved versions are kept.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!!agents.busy} disabledReason="Agents are working. Wait for them or stop them." onClick={resyncPlan}>Re-sync plan</Button>
              <Button variant="secondary" onClick={() => setPlanUpdate(null)}>Keep this draft&apos;s plan</Button>
            </div>
          </Panel>
        )}
        {!ws.sourcePlan && !pendingPlan && (
          <Panel className="grid gap-3 border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50/70 dark:border-violet-800 dark:from-violet-950/45 dark:to-purple-950/25">
            <h2 className="text-lg font-bold text-violet-950 dark:text-violet-100">First, confirm what we are building.</h2>
            <p className={mutedStyles}>
              Start with the original ProjectPilot screens: idea, clarifying questions, approved requirements, and
              task breakdown. Then choose Confirm idea & open Website Studio.
            </p>
            <Link href="/" className={`${buttonStyles.primary} justify-self-start`}>Start with idea confirmation</Link>
          </Panel>
        )}
        {syncNote && <p role="status" className={mutedStyles}>{syncNote}</p>}
        {ws.sourcePlan && lastReview && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={sendReview}>Send review to planning feedback</Button>
            <span className={mutedStyles}>Adds the latest reviewer findings to the planning project as feedback.</span>
          </div>
        )}
        {ws.sourcePlan && (
          <p className={mutedStyles}>
            Confirmed project: <strong className="text-violet-950 dark:text-violet-100">{ws.sourcePlan.title}</strong> · Requirements and
            task plan carried over from ProjectPilot. <Link href="/" className="font-semibold text-violet-700 underline underline-offset-2 dark:text-violet-300">Return to planning</Link>
          </p>
        )}
        <AgentCards activity={activity} />
        <LiveResponse open={liveOpen ?? liveDefault} onToggle={() => setLiveOpen(!(liveOpen ?? liveDefault))}
          model={agents.liveModel} text={agents.liveText} live={live} />
        {agents.error && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-relaxed text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
            {agents.error}
          </p>
        )}
        {ws.sourcePlan && ws.files.html !== starter.html && (
          <Button disabled={!!reviewReason} disabledReason={reviewReason} onClick={() => agents.run("review")}>
            {agents.activity.review.status === "Needs retry" ? "Retry source review" : "Review current website"}
          </Button>
        )}
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(19rem,34%)_minmax(0,66%)] xl:grid-cols-[minmax(21rem,31%)_minmax(0,69%)]">
          <StudioControls live={live} configured={configured} provider={provider} onUnlocked={() => { setAccess(true); setConsent(true); }} ready={ready}
            brief={ws.brief} setBrief={(brief) => update({ brief })} sourcePlan={ws.sourcePlan}
            design={ws.design} setDesign={(design) => update({ design })} rounds={rounds} setRounds={setRounds}
            busy={agents.busy} stop={agents.stop} run={agents.run} messages={ws.messages}
            feedback={feedback} setFeedback={setFeedback} github={agents.github} onGithub={agents.githubAction} />
          <StudioWorkspace files={ws.files} setFiles={(fn) => update((w) => ({ files: fn(w.files) }))}
            preview={preview} setPreview={setPreview} versions={ws.versions} busy={agents.busy} wide={wide}
            saveVersion={saveManualVersion} projectName={ws.sourcePlan?.title} restoreVersion={restoreVersion} />
        </div>
      </main>
    </div>
  );
}
