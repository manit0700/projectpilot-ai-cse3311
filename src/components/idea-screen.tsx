"use client";

import { useState } from "react";
import { TemplateChips, type IdeaTemplate } from "@/components/idea-templates";
import { OnboardingStrip } from "@/components/onboarding";
import { ApprovalBar } from "@/components/shell";
import { useStoreExt } from "@/components/store-ext";
import { shortProjectTitle } from "@/components/task-handoff";
import { DEMO_IDEA, DEMO_TARGET_USER } from "@/lib/demo-fixtures";
import { useProjectStore } from "@/lib/store";

const FIELD = "mt-1 w-full sm:mt-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-700/30 focus:ring-2";

function OptionalField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:mt-3">
      <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-slate-800">{label} <span className="hidden font-normal text-slate-600 sm:inline">· optional</span></summary>
      <textarea aria-label={label} value={value} maxLength={4000} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={hint} className={`${FIELD} mb-3 mt-0`} />
    </details>
  );
}

function EditIdea({ onDone }: { onDone: () => void }) {
  const { project } = useProjectStore();
  const { editIdea } = useStoreExt();
  const [idea, setIdea] = useState(project.description);
  const [targetUser, setTargetUser] = useState(project.targetUser);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4" aria-label="Edit idea" onSubmit={(e) => {
      e.preventDefault();
      const message = editIdea?.(idea, targetUser) ?? null;
      setError(message);
      if (!message) onDone();
    }}>
      <label className="block text-sm font-medium">Project idea<textarea autoFocus required minLength={12} rows={5} value={idea} onChange={(e) => setIdea(e.target.value)} className={FIELD} /></label>
      <label className="block text-sm font-medium">Target user<input required minLength={3} value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className={FIELD} /></label>
      <p className="text-sm text-slate-700">Saving may reopen the plan so affected requirements and tasks are reviewed again.</p>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-11 rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">Save idea</button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}

export function IdeaScreen() {
  const { startProject, startDemoProject, project, goTo, busy, draftBrief, managerMode } = useProjectStore();
  const { editIdea } = useStoreExt();
  const [idea, setIdea] = useState(draftBrief?.idea || "");
  const [targetUser, setTargetUser] = useState(draftBrief?.targetUser || "CSE students / hackathon teammates");
  const [rubric, setRubric] = useState("");
  const [constitution, setConstitution] = useState("");
  const [editing, setEditing] = useState(false);

  const loadDemoText = () => { setIdea(DEMO_IDEA); setTargetUser(DEMO_TARGET_USER); };
  const pickTemplate = (template: IdeaTemplate) => { setIdea(template.idea); setTargetUser(template.targetUser); };
  const canStart = !busy && idea.trim().length >= 12 && targetUser.trim().length >= 3;
  const start = () => {
    type Options = { rubric?: string; constitution?: string };
    const options: Options = { rubric: rubric.trim() || undefined, constitution: constitution.trim() || undefined };
    // The third argument is accepted by newer stores; older stores simply ignore it.
    (startProject as (idea: string, targetUser: string, options?: Options) => void)(idea, targetUser, options.rubric || options.constitution ? options : undefined);
  };

  if (project.id) return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{shortProjectTitle(project)}</h1>
      <p className="text-sm font-medium text-slate-600">Project idea</p>
      {editing ? <EditIdea onDone={() => setEditing(false)} /> : <>
        <p className="text-lg">{project.description}</p>
        <p>Target user: {project.targetUser}</p>
        {typeof editIdea === "function" && <button type="button" disabled={busy} onClick={() => setEditing(true)} className="min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 disabled:cursor-not-allowed disabled:opacity-50">Edit idea</button>}
      </>}
      <p className="text-sm text-slate-600">This is the original brief. Viewing it does not change your work. Use Requirements to refine the scope.</p>
      <ApprovalBar approveLabel="View clarifying answers" onApprove={() => goTo("questions")} />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <OnboardingStrip />
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">New project</h1>
      <p className="mt-3 hidden text-base leading-relaxed text-slate-600 sm:block">
        Describe a class project, hackathon app, or portfolio idea. The Manager Agent will clarify scope, draft requirements, and assign specialist agents.
        {" "}Best fits include a study planner, local task tracker, or club signup prototype. Specialists generate deliverables for you to review, integrate, and test.
      </p>

      <label className="mt-3 block text-sm font-medium text-slate-800 sm:mt-6">
        Project idea
        <textarea value={idea} onChange={(e) => setIdea(e.target.value)} minLength={12} rows={3}
          placeholder="e.g. A campus study-group matcher with availability calendars and course filters" className={FIELD} />
      </label>

      <label className="mt-3 block text-sm font-medium text-slate-800 sm:mt-4">
        Target user
        <input minLength={3} value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className={`${FIELD} min-h-11`} />
      </label>

      <TemplateChips onPick={pickTemplate} />
      <OptionalField label="Grading rubric (paste it so the plan covers it)" hint="Paste the rubric or grading criteria. Requirements and tasks will be checked against it." value={rubric} onChange={setRubric} />
      <OptionalField label="Project rules (stack, course constraints)" hint="e.g. Must use Next.js and SQLite, team of three, due in four weeks." value={constitution} onChange={setConstitution} />

      <ApprovalBar
        approveLabel="Start clarifying questions"
        disabled={!canStart}
        onApprove={start}
        hint={idea.trim().length < 12 ? "Enter a project idea of at least 12 characters to continue, or run the guided workflow." : "Human oversight starts here: nothing is finalized without your approval."}
      />

      <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <div className="text-sm font-semibold text-teal-950">{managerMode === "live" ? "Demo sample · switches to prepared responses" : "Demo sample · prepared responses"}</div>
        <p className="mt-1 text-sm leading-5 text-teal-900">
          {managerMode === "live"
            ? "You are in Live mode. Running the guided workflow switches this project to Demo and uses prepared responses instead of the live provider. To use real agents, enter your own idea above and start clarifying questions."
            : "You are in Demo mode (the default). This optional sample walks the whole workflow with prepared responses. For real agents, switch Agent mode to Live API in the header and enter your own project idea above."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={loadDemoText} className="min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-white">Load sample text</button>
          <button type="button" onClick={startDemoProject} className="min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Run guided workflow</button>
        </div>
      </div>
    </div>
  );
}
