"use client";

import { ApprovalBar } from "@/components/shell";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import { TaskEditor } from "@/components/task-editor";
import { requirementsReady, taskLabel } from "@/lib/workflow";
import { useState } from "react";

const DEMO_IDEA =
  "An AI project workspace where a Manager Agent breaks a small software project into tasks, assigns frontend, backend, database, testing, and documentation agents, reviews their outputs, and asks the student for approval before major changes.";

const DEMO_TARGET_USER =
  "CSE students building small class projects with one shared workspace";

export function IdeaScreen() {
  const { startProject, startDemoProject, project, goTo } = useProjectStore();
  const [idea, setIdea] = useState("");
  const [targetUser, setTargetUser] = useState("CSE students / hackathon teammates");

  const loadDemoText = () => {
    setIdea(DEMO_IDEA);
    setTargetUser(DEMO_TARGET_USER);
  };

  if (project.id) return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Project idea</h1>
      <p className="text-lg">{project.description}</p>
      <p>Target user: {project.targetUser}</p>
      <p className="text-sm text-slate-600">This is the original brief. Viewing it does not change your work. Use Requirements to refine the scope.</p>
      <ApprovalBar approveLabel="View clarifying answers" onApprove={() => goTo("questions")} />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">
        New project
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Describe a class project, hackathon app, or portfolio idea. The Manager
        Agent will clarify scope, draft requirements, and assign specialist agents.
      </p>

      <label className="mt-6 block text-sm font-medium text-slate-800">
        Project idea
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          placeholder="e.g. A campus study-group matcher with availability calendars and course filters"
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-700/30 focus:ring-2"
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-slate-800">
        Target user
        <input
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-teal-700/30 focus:ring-2"
        />
      </label>

      <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <div className="text-sm font-semibold text-teal-950">Guided workflow sample</div>
        <p className="mt-1 text-sm leading-5 text-teal-900">
          Use this to present the guided multi-agent workflow: manager planning,
          specialist task assignment, review, and human approval.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDemoText}
            className="rounded-xl border border-teal-700 px-3 py-1.5 text-sm font-semibold text-teal-900 hover:bg-white"
          >
            Load sample text
          </button>
          <button
            type="button"
            onClick={startDemoProject}
            className="rounded bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Run guided workflow
          </button>
        </div>
      </div>

      <ApprovalBar
        approveLabel="Start clarifying questions"
        disabled={idea.trim().length < 12}
        onApprove={() => startProject(idea, targetUser)}
        hint={idea.trim().length < 12 ? "Enter a project idea of at least 12 characters to continue, or run the guided workflow." : "Human oversight starts here: nothing is finalized without your approval."}
      />
    </div>
  );
}

export function QuestionsScreen() {
  const { questions, updateAnswer, submitAnswers, project, requirements } = useProjectStore();

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Clarifying questions</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Manager is filling gaps for <span className="font-medium">{project.title}</span>.
        {requirements.length ? " Original answers are read-only; edit requirements to refine the plan without replacing your work." : " Incomplete answers block requirements generation."}
      </p>

      <ul className="mt-6 space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-medium text-slate-900">
              {i + 1}. {q.prompt}
            </div>
            <p className="mt-1 text-sm text-slate-500">{q.why}</p>
            <textarea
              readOnly={requirements.length > 0}
              aria-label={q.prompt}
              value={q.answer}
              onChange={(e) => updateAnswer(q.id, e.target.value)}
              rows={2}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-700/30 focus:ring-2"
              placeholder="Your answer"
            />
          </li>
        ))}
      </ul>

      <ApprovalBar
        approveLabel={requirements.length ? "Return to requirements" : "Generate requirements"}
        disabled={!requirements.length && questions.some((q) => !q.answer.trim())}
        onApprove={submitAnswers}
        hint={requirements.length ? "Your requirements and later work are preserved." : "Answer every question before generating requirements."}
      />
    </div>
  );
}

export function RequirementsScreen() {
  const store = useProjectStore();
  const { requirements, toggleRequirement, approveRequirements, editRequirement, busy, tasks } = store;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const ready = requirementsReady(store);
  const counts = [
    ["Approved", requirements.filter((r) => r.approvalStatus === "approved").length],
    ["Pending", requirements.filter((r) => r.approvalStatus === "pending").length],
    ["Needs revision", requirements.filter((r) => r.approvalStatus === "rejected").length],
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Requirements summary</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">Review each requirement. Edited requirements always need approval again.</p>
      <div aria-live="polite" className="mt-5 flex flex-wrap gap-3">
        {counts.map(([label, count]) => <span key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-medium">{label}: {count}</span>)}
      </div>
      <ul className="mt-6 space-y-3">
        {requirements.map((r) => (
          <li key={r.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded bg-slate-100 px-2 py-1 uppercase">{r.priority}</span>
              <span className={`rounded px-2 py-1 ${r.approvalStatus === "approved" ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"}`}>{r.approvalStatus === "rejected" ? "Needs revision" : r.approvalStatus === "approved" ? "Approved" : "Pending review"}</span>
            </div>
            {editingId === r.id ? (
              <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { editRequirement(r.id, draft); setEditingId(null); } }}>
                <label className="block font-medium">Requirement text<textarea autoFocus required value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label>
                {tasks.length > 0 && <p className="my-3 text-sm text-amber-900">Saving a change reopens the task plan and refreshes its shared-context outputs after approval. Existing tasks and history are preserved.</p>}
                {!draft.trim() && <p className="mt-2 text-sm text-amber-900">Enter requirement text before saving.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={!draft.trim()} className="rounded-xl bg-teal-700 px-4 py-2 text-white disabled:opacity-50">Save requirement</button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-slate-300 px-4 py-2">Cancel</button>
                </div>
              </form>
            ) : <>
              <p className="text-base leading-relaxed text-slate-800">{r.text}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || !!editingId} onClick={() => toggleRequirement(r.id, "approved")} className={`rounded-xl border px-4 py-2 font-semibold ${r.approvalStatus === "approved" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>Approve</button>
                <button type="button" disabled={busy || !!editingId} onClick={() => toggleRequirement(r.id, "rejected")} className={`rounded-xl border px-4 py-2 font-semibold ${r.approvalStatus === "rejected" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>Needs revision</button>
                <button type="button" disabled={busy || !!editingId} onClick={() => { setDraft(r.text); setEditingId(r.id); }} className="rounded-xl border border-slate-300 px-4 py-2">Edit</button>
              </div>
            </>}
          </li>
        ))}
      </ul>
      <ApprovalBar approveLabel={tasks.length ? "Continue to task plan" : "Approve requirements → build tasks"}
        disabled={busy || !ready || !!editingId} onApprove={approveRequirements}
        hint={editingId ? "Save or cancel your edit before continuing." : !ready ? "Approve or resolve all requirements before generating the task plan." : "All requirements approved. Continue to review the task plan; agents will not run yet."} />
    </div>
  );
}

export function TasksScreen() {
  const { tasks, approveTaskPlan, busy, project, planApproved, goTo } = useProjectStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingTask = tasks.find((t) => t.id === editingId);
  const editButton = (id: string) => !planApproved && <button type="button" disabled={busy || !!editingId} onClick={() => setEditingId(id)} className="mt-3 rounded-xl border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 disabled:opacity-50">Edit task</button>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Task breakdown</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Review the task order and dependencies. Your approval starts the assigned agents.
      </p>

      {planApproved && <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">This plan has been approved. Viewing it does not rerun agents. To change shared scope, edit a requirement and review the reopened plan.</p>}
      {editingTask && <TaskEditor key={editingTask.id} task={editingTask} onClose={() => setEditingId(null)} />}
      {project.approvedSummary && (
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold text-slate-800">Approved project brief</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-600">{project.approvedSummary}</pre>
        </details>
      )}

      <ol className="mt-6 space-y-4 xl:hidden" aria-label="Dependency-ordered tasks">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-lg font-semibold text-slate-900">{taskLabel(task)}</h2>
            <p className="mt-2 text-base leading-relaxed text-slate-600">{task.description}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-semibold text-slate-800">Assigned agent</dt><dd className="mt-1 text-slate-600">{AGENT_LABELS[task.ownerAgent]}</dd></div>
              <div><dt className="font-semibold text-slate-800">Depends on</dt><dd className="mt-1 text-slate-600">{task.dependencies.length ? task.dependencies.map((id) => {
                const dependency = tasks.find((item) => item.id === id);
                return dependency ? taskLabel(dependency) : id;
              }).join("; ") : "No prerequisites"}</dd></div>
              <div><dt className="font-semibold text-slate-800">Expected output</dt><dd className="mt-1 text-slate-600">{task.expectedOutput}</dd></div>
            </dl>
            {editButton(task.id)}
          </li>
        ))}
      </ol>

      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 xl:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-sm uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">#</th>
              <th scope="col" className="px-3 py-2">Task</th>
              <th scope="col" className="px-3 py-2">Owner</th>
              <th scope="col" className="px-3 py-2">Depends on</th>
              <th scope="col" className="px-3 py-2">Expected output</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2 font-mono text-sm text-slate-500">
                  {t.order}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{t.title}</div>
                  <div className="text-sm text-slate-500">{t.description}</div>
                  {editButton(t.id)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm">
                  {AGENT_LABELS[t.ownerAgent]}
                </td>
                <td className="px-3 py-2 text-sm text-slate-600">
                  {t.dependencies.length
                    ? t.dependencies
                        .map((d) => { const dependency = tasks.find((x) => x.id === d); return dependency ? taskLabel(dependency) : d; })
                        .join(", ")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-sm text-slate-600">
                  {t.expectedOutput}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ApprovalBar
        approveLabel={busy ? "Agents running…" : planApproved ? "Return to agent board" : "Approve plan & run agents"}
        disabled={busy || !!editingId}
        onApprove={() => planApproved ? goTo("board") : void approveTaskPlan()}
        hint={editingId ? "Save or cancel your task edit before approving the plan." : "Approving runs only tasks that need work. Existing successful, unaffected outputs are preserved."}
      />
    </div>
  );
}
