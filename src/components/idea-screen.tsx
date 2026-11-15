"use client";

import { useId, useState } from "react";
import { TemplateChips, type IdeaTemplate } from "@/components/idea-templates";
import { OnboardingStrip } from "@/components/onboarding";
import { ApprovalBar } from "@/components/shell";
import { useStoreExt } from "@/components/store-ext";
import { shortProjectTitle } from "@/components/task-handoff";
import { DEMO_IDEA, DEMO_TARGET_USER } from "@/lib/demo-fixtures";
import { useProjectStore } from "@/lib/store";
import { WorkspaceIllustration } from "@/components/workspace-illustration";

const FIELD = "mt-2 w-full rounded-2xl border border-violet-300/90 bg-white/80 px-4 py-3 text-base text-slate-900 shadow-[inset_0_1px_2px_rgba(76,29,149,0.04)] outline-none transition placeholder:text-slate-500 hover:border-violet-400 focus:border-violet-600 focus:ring-4 focus:ring-violet-200/70 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-violet-900/60";

function PaperPlaneIcon({ className = "size-7" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none"><path d="M21 3 9.8 14.2M21 3l-7.1 18-4.1-6.8L3 10.1 21 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function FieldIcon({ kind }: { kind: "idea" | "users" | "rules" | "rubric" }) {
  const paths = {
    idea: <><path d="M9 18h6M10 22h4" /><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    rules: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    rubric: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3V2h6v1M9 8h6M9 12h6M9 16h4" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 shrink-0 text-violet-700 dark:text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

function EditIdea({ onDone }: { onDone: () => void }) {
  const { project } = useProjectStore();
  const { editIdea } = useStoreExt();
  const [idea, setIdea] = useState(project.description);
  const [targetUser, setTargetUser] = useState(project.targetUser);
  const [error, setError] = useState<string | null>(null);
  return <form className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/80 p-5 dark:border-violet-900 dark:bg-violet-950/30" aria-label="Edit idea" onSubmit={(e) => {
    e.preventDefault();
    const message = editIdea?.(idea, targetUser) ?? null;
    setError(message);
    if (!message) onDone();
  }}>
    <label className="block font-semibold text-slate-900 dark:text-slate-100">Project idea<textarea autoFocus required minLength={12} rows={5} value={idea} onChange={(e) => setIdea(e.target.value)} className={FIELD} /></label>
    <label className="block font-semibold text-slate-900 dark:text-slate-100">Target user<input required minLength={3} value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className={FIELD} /></label>
    <p className="text-sm text-slate-700 dark:text-slate-300">Saving may reopen the plan so affected requirements and tasks are reviewed again.</p>
    {error && <p role="alert" className="text-sm text-rose-800 dark:text-rose-300">{error}</p>}
    <div className="flex flex-wrap gap-2"><button type="submit" className="min-h-11 rounded-xl bg-violet-700 px-5 py-2 font-semibold text-white shadow-md hover:bg-violet-800">Save idea</button><button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-violet-300 bg-white px-5 py-2 text-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:border-violet-700">Cancel</button></div>
  </form>;
}

function ModeSelector() {
  const { managerMode, setManagerMode, busy, hydrated } = useProjectStore();
  const helpId = useId();
  return <fieldset aria-describedby={helpId} disabled={busy || !hydrated} className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900 dark:bg-violet-950/30">
    <legend className="sr-only">Agent mode</legend>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p aria-hidden="true" className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Agent mode</p>
      <div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-violet-200 dark:bg-slate-950 dark:ring-violet-900">
        {(["demo", "live"] as const).map((mode) => <label key={mode} className={`cursor-pointer rounded-lg px-4 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-600 dark:has-[:focus-visible]:outline-violet-300 text-center text-sm font-semibold transition ${managerMode === mode ? "bg-violet-700 text-white shadow-sm" : "text-slate-600 hover:bg-violet-50 dark:text-slate-300 dark:hover:bg-violet-950"}`}><input type="radio" name="idea-agent-mode" value={mode} checked={managerMode === mode} onChange={() => setManagerMode(mode)} className="sr-only" />{mode === "demo" ? "Demo" : "Live API"}</label>)}
      </div>
    </div>
    <p id={helpId} className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{managerMode === "demo" ? "Prepared responses; no provider key or data sharing required." : "Uses the configured provider. Access and data-sharing consent are required before starting."}</p>
  </fieldset>;
}

function WorkspaceArt() {
  return <WorkspaceIllustration priority className="hidden min-h-[48rem] lg:block" caption="Start with a clear idea. Your AI team will help shape the plan." />;
}

export function IdeaScreen() {
  const { startProject, startDemoProject, project, goTo, busy, draftBrief, managerMode } = useProjectStore();
  const { editIdea } = useStoreExt();
  const [idea, setIdea] = useState(draftBrief?.idea || "");
  const [targetUser, setTargetUser] = useState(draftBrief?.targetUser || "");
  const [rubric, setRubric] = useState("");
  const [constitution, setConstitution] = useState("");
  const [editing, setEditing] = useState(false);
  const helpId = useId();
  const loadDemoText = () => { setIdea(DEMO_IDEA); setTargetUser(DEMO_TARGET_USER); };
  const pickTemplate = (template: IdeaTemplate) => { setIdea(template.idea); setTargetUser(template.targetUser); };
  const canStart = !busy && idea.trim().length >= 12 && targetUser.trim().length >= 3;
  const start = () => {
    const options = { rubric: rubric.trim() || undefined, constitution: constitution.trim() || undefined };
    startProject(idea, targetUser, options.rubric || options.constitution ? options : undefined);
  };

  if (project.id) return <div className="overflow-hidden rounded-[2rem] border border-violet-200/80 bg-white/90 shadow-[0_24px_70px_rgba(91,33,182,0.14)] dark:border-violet-900 dark:bg-slate-950/90"><div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]"><WorkspaceArt /><div className="space-y-5 p-6 sm:p-9 lg:p-12">
    <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><PaperPlaneIcon /></div>
    <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Saved project brief</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl dark:text-white">{shortProjectTitle(project)}</h1></div>
    {editing ? <EditIdea onDone={() => setEditing(false)} /> : <><p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-700 dark:text-slate-200">{project.description}</p><p className="rounded-2xl bg-violet-50 px-4 py-3 text-slate-700 dark:bg-violet-950/40 dark:text-slate-200"><span className="font-semibold">Target user:</span> {project.targetUser}</p>{typeof editIdea === "function" && <button type="button" disabled={busy} onClick={() => setEditing(true)} className="min-h-11 rounded-xl border border-violet-400 px-5 py-2 font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-200 dark:hover:bg-violet-950">Edit project brief</button>}</>}
    <p className="text-sm text-slate-600 dark:text-slate-300">Viewing this brief does not change your work. Use Requirements to refine the scope.</p><ApprovalBar approveLabel="View clarifying answers" onApprove={() => goTo("questions")} />
  </div></div></div>;

  return <div><OnboardingStrip /><section className="overflow-hidden rounded-[2rem] border border-violet-200/80 bg-white/90 shadow-[0_24px_70px_rgba(91,33,182,0.16)] backdrop-blur-sm dark:border-violet-900 dark:bg-slate-950/90"><div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.55fr)]"><WorkspaceArt /><div className="p-5 sm:p-8 lg:p-10 xl:p-12">
    <div className="flex items-start gap-4"><div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 text-violet-700 shadow-sm dark:from-violet-950 dark:to-purple-900 dark:text-violet-200"><PaperPlaneIcon /></div><div><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl xl:text-5xl dark:text-white">Start a New Project</h1><p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">Tell ProjectPilot what you want to build, and your AI team will turn it into a reviewable plan.</p></div></div>
    <div className="mt-7 space-y-5">
      <label className="block font-semibold text-slate-900 dark:text-slate-100"><span className="flex items-center gap-2"><FieldIcon kind="idea" />Project Idea <span className="text-rose-700 dark:text-rose-300" aria-hidden="true">*</span><span className="sr-only">(required)</span></span><textarea aria-label="Project idea" value={idea} onChange={(e) => setIdea(e.target.value)} minLength={12} required rows={3} placeholder="Describe the project you want to build..." className={FIELD} /></label>
      <label className="block font-semibold text-slate-900 dark:text-slate-100"><span className="flex items-center gap-2"><FieldIcon kind="users" />Target User <span className="text-rose-700 dark:text-rose-300" aria-hidden="true">*</span><span className="sr-only">(required)</span></span><input aria-label="Target user" minLength={3} required value={targetUser} onChange={(e) => setTargetUser(e.target.value)} placeholder="Who is the project for? (e.g., students, employees, customers)" className={`${FIELD} min-h-12`} /></label>
      <TemplateChips onPick={pickTemplate} />
      <label className="block font-semibold text-slate-900 dark:text-slate-100"><span className="flex items-center gap-2"><FieldIcon kind="rules" />Project Rules <span className="font-normal text-slate-500 dark:text-slate-400">(Optional)</span></span><textarea aria-label="Project Rules (Optional)" value={constitution} maxLength={4000} onChange={(e) => setConstitution(e.target.value)} rows={2} placeholder="Any specific constraints, technologies, or guidelines to follow?" className={FIELD} /></label>
      <label className="block font-semibold text-slate-900 dark:text-slate-100"><span className="flex items-center gap-2"><FieldIcon kind="rubric" />Rubric <span className="font-normal text-slate-500 dark:text-slate-400">(Optional)</span></span><textarea aria-label="Rubric (Optional)" value={rubric} maxLength={4000} onChange={(e) => setRubric(e.target.value)} rows={2} placeholder="Add your grading rubric or evaluation criteria..." className={FIELD} /></label>
      <ModeSelector />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={loadDemoText} className="min-h-11 rounded-xl border border-violet-300 bg-white/80 px-4 text-sm font-semibold text-violet-800 hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-950/70 dark:text-violet-200 dark:hover:bg-violet-950">Load sample text</button><button type="button" disabled={busy} onClick={startDemoProject} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-violet-800 underline decoration-violet-300 underline-offset-4 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-950">Run guided demo</button></div><button type="button" data-primary-action disabled={!canStart} aria-busy={busy} aria-describedby={!canStart ? helpId : undefined} onClick={start} className="min-h-14 rounded-2xl bg-gradient-to-r from-violet-700 to-purple-600 px-6 py-3 text-base font-bold text-white shadow-[0_12px_28px_rgba(109,40,217,0.3)] transition hover:-translate-y-0.5 hover:from-violet-800 hover:to-purple-700 hover:shadow-[0_16px_34px_rgba(109,40,217,0.36)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none motion-reduce:transform-none sm:min-w-[20rem]">{busy ? "Generating questions…" : "Generate Clarifying Questions →"}</button></div>
      {!canStart && <p id={helpId} className="text-sm text-slate-600 dark:text-slate-300">{busy ? "The Manager is working…" : idea.trim().length < 12 ? "Enter a project idea of at least 12 characters." : targetUser.trim().length < 3 ? "Enter a target user of at least 3 characters." : "Complete the required fields to continue."}</p>}
      {managerMode === "live" && <p className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">Live API remains opt-in. Project context is sent only after access and consent are confirmed.</p>}
    </div>
  </div></div></section></div>;
}
