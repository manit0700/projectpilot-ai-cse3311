"use client";

import { StudioHandoffButton } from "@/components/studio-handoff";
import { ApprovalBar } from "@/components/shell";
import { shortProjectTitle } from "@/components/task-handoff";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import { TaskEditor } from "@/components/task-editor";
import { enoughDetail } from "@/lib/input-rules";
import { taskLabel } from "@/lib/workflow";
import { TaskAddForm } from "@/components/task-editor";
import { useStoreExt } from "@/components/store-ext";
import { useEffect, useRef, useState } from "react";

export { IdeaScreen } from "@/components/idea-screen";
export { RequirementsScreen } from "@/components/requirements-screen";

export function QuestionsScreen() {
  const { questions, updateAnswer, suggestAnswers, submitAnswers, project, requirements, busy } = useProjectStore();
  const drafted = questions.filter((q) => q.suggested).length;
  // Drafting is automatic: when this screen opens with every answer blank (a restored save, or an earlier
  // automatic attempt that failed once), ask the manager once per project. A failure shows a retry button.
  const attempted = useRef<string | null>(null);
  // The failure copy is only honest when an attempt really happened and left every answer blank.
  const [attemptedFor, setAttemptedFor] = useState<string | null>(null);
  const allBlank = questions.length > 0 && questions.every((q) => !q.answer.trim());
  const anyBlank = questions.some((q) => !q.answer.trim());
  const failed = allBlank && !busy && attemptedFor === project.id;
  const draftAgain = () => { setAttemptedFor(project.id); suggestAnswers(); };
  useEffect(() => {
    if (!allBlank || requirements.length || busy || !project.id || attempted.current === project.id) return;
    attempted.current = project.id;
    suggestAnswers();
    // Deliberately not cleared on cleanup: the effect re-runs as soon as the request flips `busy`.
    window.setTimeout(() => setAttemptedFor(project.id), 0);
  }, [allBlank, requirements.length, busy, project.id, suggestAnswers]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Clarifying questions</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Manager is filling gaps for <span className="font-medium">{shortProjectTitle(project)}</span>.
        {requirements.length ? " Original answers are read-only; edit requirements to refine the plan without replacing your work." : " Give at least 12 characters per answer, including concrete constraints. Short answers block generation."}
      </p>

      {!requirements.length && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3" role="status">
          <p className="min-w-0 flex-1 text-sm text-teal-950">
            {drafted > 0
              ? `The manager drafted ${drafted} answer${drafted === 1 ? "" : "s"} from your idea and target user. Read them, edit anything that is wrong, then continue.`
              : busy ? "The manager is drafting answers from your idea and target user…"
              : failed ? "The manager could not draft answers. Try again, or write your own."
              : anyBlank ? "Some answers are still blank. Write them yourself or ask the manager to draft them."
              : "Answers are filled in. Read them, edit anything that is wrong, then continue."}
          </p>
          {!busy && (drafted > 0 || anyBlank) && (
            <button type="button" onClick={draftAgain} aria-describedby="suggest-help" className={drafted > 0 ? "inline-flex min-h-11 items-center text-sm font-medium text-teal-900 underline underline-offset-2 hover:text-teal-700" : "min-h-11 rounded-xl border border-teal-700 bg-white px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-100"}>
              {drafted > 0 ? "Redraft unedited answers" : failed ? "Draft answers again" : "Draft answers"}
            </button>
          )}
          <p id="suggest-help" className="basis-full text-xs text-teal-900/80">Answers you typed or edited are never overwritten.</p>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-medium text-slate-900">
              {i + 1}. {q.prompt}
              {q.suggested && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900">AI draft · edit me</span>}
            </div>
            <p className="mt-1 text-sm text-slate-500">{q.why}</p>
            <textarea
              readOnly={requirements.length > 0}
              aria-label={q.prompt}
              value={q.answer}
              onChange={(e) => updateAnswer(q.id, e.target.value)}
              minLength={12}
              rows={2}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-700/30 focus:ring-2"
              placeholder="Your answer"
            />
          </li>
        ))}
      </ul>

      <ApprovalBar
        approveLabel={requirements.length ? "Return to requirements" : "Continue to requirements"}
        disabled={busy || (!requirements.length && questions.some((q) => !enoughDetail(q.answer)))}
        onApprove={submitAnswers}
        hint={requirements.length ? "Your requirements and later work are preserved." : "Review the drafted answers, edit what is wrong, then continue. Every answer needs 12+ characters."}
      />
    </div>
  );
}

export function TasksScreen() {
  const { tasks, approveTaskPlan, busy, project, planApproved, goTo } = useProjectStore();
  const { addTask } = useStoreExt();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const editingTask = tasks.find((t) => t.id === editingId);
  const editLocked = busy || !!editingId || adding;
  const editButton = (id: string) => !planApproved && <>
    <button type="button" disabled={editLocked} aria-label={`Edit task ${tasks.find((t) => t.id === id)?.order}: ${tasks.find((t) => t.id === id)?.title}`} aria-describedby={editLocked ? `task-edit-help-${id}` : undefined} onClick={() => setEditingId(id)} className="mt-3 min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 disabled:cursor-not-allowed disabled:opacity-50">Edit task</button>
    {editLocked && <p id={`task-edit-help-${id}`} className="mt-1 text-xs text-slate-600">{busy ? "Editing is paused while agents run." : editingId === id ? "This task is open in the editor above." : "Save or cancel the open task edit first."}</p>}
  </>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-slate-900">Task breakdown</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Review the task order and dependencies. Confirm the idea for Website Studio, or run the original specialist workflow below.
      </p>

      {planApproved && <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">This plan has been approved. Viewing it does not rerun agents. To change shared scope, edit a requirement and review the reopened plan.</p>}
      {typeof addTask === "function" && !planApproved && !adding && !editingId && (
        <button type="button" disabled={busy} onClick={() => setAdding(true)} className="mt-4 min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 disabled:cursor-not-allowed disabled:opacity-50">Add task</button>
      )}
      {adding && <TaskAddForm onClose={() => setAdding(false)} />}
      {editingTask && <TaskEditor key={editingTask.id} task={editingTask} onClose={() => setEditingId(null)} />}
      {project.approvedSummary && (
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-slate-800">Approved project brief</summary>
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

      <StudioHandoffButton disabled={busy || !!editingId || adding} />
      <ApprovalBar
        approveLabel={busy ? "Agents running…" : planApproved ? "Return to agent board" : "Approve plan & run agents"}
        disabled={busy || !!editingId || adding}
        onApprove={() => planApproved ? goTo("board") : void approveTaskPlan()}
        hint={editingId || adding ? "Save or cancel your task edit before approving the plan." : "Approving runs only tasks that need work. Existing successful, unaffected outputs are preserved."}
      />
    </div>
  );
}
