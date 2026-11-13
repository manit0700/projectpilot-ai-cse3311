"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { documentHtml, starter, studioMode, type SiteFiles } from "@/lib/studio";
import { agentPlan, handoffKey, tidyBrief, validHandoff, type StudioHandoff } from "@/lib/studio-handoff";
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
      try {
        const incoming = JSON.parse(sessionStorage.getItem(handoffKey) || "null");
        if (validHandoff(incoming)) setPendingPlan(incoming);
      } catch { /* Ignore unreadable handoff data. */ }
    }, 0);
    fetch("/api/live-access").then((r) => r.json()).then((s) => setAccess(s.authenticated === true)).catch(() => {});
    fetch("/api/manager").then((r) => r.json())
      .then((c) => { setConfigured(c.studioConfigured === true); setProvider(c.studioProvider === "gemini" ? "gemini" : "openrouter"); }).catch(() => {});
    return () => clearTimeout(timer);
  }, []);

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
  function downloadRecovery() {
    const raw = readRecovery();
    if (raw) downloadText("projectpilot-website-studio-recovery.txt", raw);
  }
  function dismissPlan() { setPendingPlan(null); sessionStorage.removeItem(handoffKey); }
  function restoreVersion(version: Version) {
    update((w) => ({ versions: [...w.versions.slice(-7), { name: "Before restore", files: w.files }], files: version.files }));
    setPreview(version.files);
  }
  const reviewReason = agents.busy ? "Agents are working. Wait for them or stop them."
    : !ws.design.trim() ? "Design the website from the imported plan first" : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pp-bg)] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="inline-flex min-h-11 items-center text-2xl font-semibold tracking-tight text-slate-900">ProjectPilot AI</Link>
            <ModePill live={live} provider={provider} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 font-medium">Planning</Link>
            <Button disabled={!ready} disabledReason="Loading workspace"
              onClick={() => downloadText("projectpilot-website.html", documentHtml(ws.files, false), "text/html")}>
              Download website
            </Button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="mx-auto max-w-7xl px-4 pb-4 text-sm text-slate-600 sm:px-6">
          <span>{saveStatus}</span>
          {versionNote && <span> · <strong className="font-semibold text-teal-800">{versionNote}</strong></span>}
          {" · "}{live ? `Live · ${provider === "gemini" ? "Gemini" : "OpenRouter"} · Generated code needs human testing.`
            : "Demo mode · Prepared output from a real earlier run."}
        </p>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-7xl min-w-0 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Website Studio</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            Turn your confirmed plan into a static website: agents design, build and review it while you edit,
            preview and export every line.
          </p>
        </div>
        {persistence === "paused" && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
            <p>{recoveryNotice}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={downloadRecovery}>Download recovery copy</Button>
              <Button onClick={() => setPersistence("ready")}>Start fresh and resume autosave</Button>
            </div>
          </div>
        )}
        {pendingPlan && (
          <Panel aria-label="Confirmed idea handoff" className="grid gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Continue with {pendingPlan.title}</h2>
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
        {!ws.sourcePlan && !pendingPlan && (
          <Panel className="grid gap-3">
            <h2 className="text-lg font-semibold text-slate-900">First, confirm what we are building.</h2>
            <p className={mutedStyles}>
              Start with the original ProjectPilot screens: idea, clarifying questions, approved requirements, and
              task breakdown. Then choose Confirm idea & open Website Studio.
            </p>
            <Link href="/" className={`${buttonStyles.primary} justify-self-start`}>Start with idea confirmation</Link>
          </Panel>
        )}
        {ws.sourcePlan && (
          <p className={mutedStyles}>
            Confirmed project: <strong className="text-slate-900">{ws.sourcePlan.title}</strong> · Requirements and
            task plan carried over from ProjectPilot. <Link href="/" className="underline">Return to planning</Link>
          </p>
        )}
        <AgentCards activity={activity} />
        <LiveResponse open={liveOpen ?? wide} onToggle={() => setLiveOpen(!(liveOpen ?? wide))}
          model={agents.liveModel} text={agents.liveText} live={live} />
        {agents.error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-relaxed text-rose-900">
            {agents.error}
          </p>
        )}
        {ws.sourcePlan && ws.files.html !== starter.html && (
          <Button disabled={!!reviewReason} disabledReason={reviewReason} onClick={() => agents.run("review")}>
            {agents.activity.review.status === "Needs retry" ? "Retry source review" : "Review current website"}
          </Button>
        )}
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[23rem_minmax(0,1fr)]">
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
