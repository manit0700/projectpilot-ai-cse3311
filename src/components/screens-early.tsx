"use client";

import { StudioHandoffButton } from "@/components/studio-handoff";
import { ApprovalBar, ManagerPanel, MetricsPanel } from "@/components/shell";
import { WorkspaceIllustration } from "@/components/workspace-illustration";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import { TaskEditor } from "@/components/task-editor";
import { enoughDetail } from "@/lib/input-rules";
import { taskLabel } from "@/lib/workflow";
import { TaskAddForm } from "@/components/task-editor";
import { useStoreExt } from "@/components/store-ext";
import { useEffect, useId, useRef, useState } from "react";

export { IdeaScreen } from "@/components/idea-screen";
export { RequirementsScreen } from "@/components/requirements-screen";

function ManagerAvatar() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_6px_16px_rgba(109,40,217,0.24)]" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10.5a4 4 0 1 1 8 0v2.8a4 4 0 0 1-8 0v-2.8Z" />
        <path d="M6 12v1.5a6 6 0 0 0 12 0V12M12 19.5V22M9 22h6" />
        <path d="M9.5 10.5h.01M14.5 10.5h.01" />
      </svg>
    </span>
  );
}

function QuestionsWorkspaceArt() {
  return <WorkspaceIllustration src="/projectpilot-questions-workspace.png" className="sticky top-6 hidden h-[54rem] rounded-[2rem] border border-white/50 shadow-[0_24px_60px_rgba(91,33,182,0.18)] 2xl:block" sizes="250px" />;
}

function ClarifyingQuestionCard({
  question,
  index,
  total,
  readOnly,
  onAnswerChange,
}: {
  question: { id: string; prompt: string; answer: string; why: string; suggested?: boolean };
  index: number;
  total: number;
  readOnly: boolean;
  onAnswerChange: (answer: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const fieldId = useId();
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const trimmedLength = question.answer.trim().length;
  const invalid = !readOnly && touched && !enoughDetail(question.answer);
  const describedBy = invalid ? `${helpId} ${errorId}` : helpId;

  return (
    <li className="overflow-hidden rounded-[1.75rem] border border-violet-200/90 bg-white shadow-[0_14px_38px_rgba(91,33,182,0.09)] dark:border-violet-900 dark:bg-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50/90 to-purple-50/50 px-5 py-4 dark:border-violet-900 dark:from-violet-950/60 dark:to-purple-950/30 sm:px-6">
        <div className="flex items-center gap-3">
          <ManagerAvatar />
          <div>
            <p className="font-semibold leading-tight text-slate-950 dark:text-white">Manager AI</p>
            <p className="mt-0.5 text-xs text-violet-700 dark:text-violet-300">Clarifying your project</p>
          </div>
        </div>
        <p className="rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-xs font-semibold text-violet-800 dark:border-violet-800 dark:bg-slate-950/70 dark:text-violet-200">
          Question {index + 1} of {total}
        </p>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        <section className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-4 dark:border-violet-900 dark:bg-violet-950/30 sm:px-5">
          <h2 className="text-lg font-semibold leading-relaxed text-slate-950 dark:text-white sm:text-xl">{question.prompt}</h2>
          {question.why && <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{question.why}</p>}
        </section>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={fieldId} className="font-semibold text-slate-950 dark:text-white">Your Answer<span className="sr-only"> for {question.prompt}</span></label>
            {question.suggested && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                <span className="size-1.5 rounded-full bg-violet-500" aria-hidden="true" />
                AI-suggested starting point
              </span>
            )}
          </div>
          <textarea
            id={fieldId}
            readOnly={readOnly}
            value={question.answer}
            onChange={(event) => {
              setTouched(true);
              onAnswerChange(event.target.value);
            }}
            onBlur={() => setTouched(true)}
            minLength={12}
            rows={4}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={`w-full resize-y rounded-2xl border bg-white px-4 py-3 text-base leading-relaxed text-slate-900 shadow-[inset_0_1px_2px_rgba(76,29,149,0.04)] outline-none transition placeholder:text-slate-500 focus:ring-4 focus-visible:outline-violet-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus-visible:outline-violet-400 ${invalid ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:focus:ring-rose-950" : "border-violet-300 hover:border-violet-400 focus:border-violet-600 focus:ring-violet-200/70 dark:border-violet-800 dark:focus:border-violet-400 dark:focus:ring-violet-900/60"} ${readOnly ? "cursor-default bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300" : ""}`}
            placeholder="Write your answer here…"
          />
          <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs">
            <p id={helpId} className="text-slate-500 dark:text-slate-400">
              {readOnly ? "Answer saved with the approved requirements." : "Minimum 12 characters."}
            </p>
            {!readOnly && <p className={invalid ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}>{trimmedLength} characters</p>}
          </div>
          {invalid && (
            <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-300">
              Enter at least 12 characters. {Math.max(0, 12 - trimmedLength)} more required.
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export function QuestionsScreen() {
  const { questions, updateAnswer, suggestAnswers, submitAnswers, project, requirements, busy, goTo } = useProjectStore();
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[250px_minmax(0,1fr)_280px]">
      <QuestionsWorkspaceArt />

      <section className="min-w-0 rounded-[2rem] border border-violet-200/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(91,33,182,0.13)] backdrop-blur-sm dark:border-violet-900 dark:bg-slate-950/95 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Let&apos;s Clarify Your Project</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">Your AI Manager has a few questions to better understand what you&apos;re building.</p>

        <section className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50/70 p-4 dark:border-violet-900 dark:from-violet-950/60 dark:to-purple-950/30" aria-labelledby="manager-banner-title">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM18.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3ZM5.5 13l.7 2.3 2.3.7-2.3.7L5.5 19l-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="manager-banner-title" className="font-semibold text-violet-950 dark:text-violet-100">Manager AI</h2>
                <span className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:border-violet-800 dark:bg-slate-950/70 dark:text-violet-200">{questions.length} questions</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-violet-950/80 dark:text-violet-200" role="status">
                {requirements.length
                  ? "Your original answers are saved and read-only. Edit requirements to refine the plan without replacing later work."
                  : drafted > 0
                    ? `I drafted ${drafted} suggested answer${drafted === 1 ? "" : "s"} from your idea and target user. Review and edit anything that is not right.`
                    : busy ? "I’m drafting suggested answers from your idea and target user…"
                    : failed ? "I could not draft answers. Try again, or write your own."
                    : anyBlank ? "Some answers are blank. Write them yourself or ask me to draft them."
                    : "Your answers are ready to review before requirements are generated."}
              </p>
              {!requirements.length && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {!busy && (drafted > 0 || anyBlank) && (
                    <button type="button" onClick={draftAgain} aria-describedby="suggest-help" className="min-h-11 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800 transition hover:border-violet-400 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200 dark:hover:bg-violet-950">
                      {drafted > 0 ? "Redraft unedited answers" : failed ? "Draft answers again" : "Draft answers"}
                    </button>
                  )}
                  <p id="suggest-help" className="text-xs leading-relaxed text-violet-800/80 dark:text-violet-300">Answers you typed or edited are never overwritten.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <ul className="mt-6 space-y-6">
          {questions.map((q, i) => (
            <ClarifyingQuestionCard
              key={q.id}
              question={q}
              index={i}
              total={questions.length}
              readOnly={requirements.length > 0}
              onAnswerChange={(answer) => updateAnswer(q.id, answer)}
            />
          ))}
        </ul>

        <ApprovalBar
          variant="purple"
          approveLabel={requirements.length ? "Return to Requirements →" : busy ? "Generating Requirements…" : "Generate Requirements →"}
          disabled={busy || (!requirements.length && questions.some((q) => !enoughDetail(q.answer)))}
          onApprove={submitAnswers}
          secondaryLabel="Back"
          secondaryDisabled={busy}
          onSecondary={() => goTo("idea")}
          hint={requirements.length ? "Your requirements and later work are preserved." : "Review the drafted answers, edit what is wrong, then continue. Every answer needs 12+ characters."}
        />
      </section>

      <div className="min-w-0 space-y-6">
        <MetricsPanel variant="purple" />
        <ManagerPanel variant="purple" />
      </div>
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
  const assignedAgents = new Set(tasks.map((task) => task.ownerAgent)).size;
  const dependencyLinks = tasks.reduce((total, task) => total + task.dependencies.length, 0);
  const editButton = (id: string) => !planApproved && <>
    <button type="button" disabled={editLocked} aria-label={`Edit task ${tasks.find((t) => t.id === id)?.order}: ${tasks.find((t) => t.id === id)?.title}`} aria-describedby={editLocked ? `task-edit-help-${id}` : undefined} onClick={() => setEditingId(id)} className="mt-4 min-h-11 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800 transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200 dark:hover:bg-violet-950">Edit task</button>
    {editLocked && <p id={`task-edit-help-${id}`} className="mt-2 text-xs text-slate-600 dark:text-slate-300">{busy ? "Editing is paused while agents run." : editingId === id ? "This task is open in the editor above." : "Save or cancel the open task edit first."}</p>}
  </>;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[250px_minmax(0,1fr)_280px]">
      <WorkspaceIllustration src="/projectpilot-tasks-workspace.png" className="sticky top-6 hidden h-[54rem] rounded-[2rem] border border-white/50 shadow-[0_24px_60px_rgba(91,33,182,0.18)] 2xl:block" sizes="250px" />

      <section className="min-w-0 rounded-[2rem] border border-violet-200/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(91,33,182,0.13)] backdrop-blur-sm dark:border-violet-900 dark:bg-slate-950/95 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Task Breakdown</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">Review the task order, agent assignments, dependencies, and expected outputs before your AI team begins work.</p>

        <section className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50/70 p-4 dark:border-violet-900 dark:from-violet-950/60 dark:to-purple-950/30" aria-labelledby="task-summary-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="task-summary-title" className="font-semibold text-violet-950 dark:text-violet-100">Implementation plan</h2>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${planApproved ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-violet-200 bg-white/80 text-violet-800 dark:border-violet-800 dark:bg-slate-950/70 dark:text-violet-200"}`}>{planApproved ? "Plan approved" : "Awaiting approval"}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-violet-100 bg-white/80 px-3 py-2 dark:border-violet-900 dark:bg-slate-950/70"><span className="block text-xs text-slate-600 dark:text-slate-300">Tasks</span><strong className="font-mono text-lg text-violet-950 dark:text-violet-100">{tasks.length}</strong></div>
            <div className="rounded-xl border border-violet-100 bg-white/80 px-3 py-2 dark:border-violet-900 dark:bg-slate-950/70"><span className="block text-xs text-slate-600 dark:text-slate-300">Agents</span><strong className="font-mono text-lg text-violet-950 dark:text-violet-100">{assignedAgents}</strong></div>
            <div className="rounded-xl border border-violet-100 bg-white/80 px-3 py-2 dark:border-violet-900 dark:bg-slate-950/70"><span className="block text-xs text-slate-600 dark:text-slate-300">Dependencies</span><strong className="font-mono text-lg text-violet-950 dark:text-violet-100">{dependencyLinks}</strong></div>
          </div>
          {planApproved && <p className="mt-3 text-sm leading-relaxed text-violet-900 dark:text-violet-200">This plan has been approved. Viewing it does not rerun agents. Edit a requirement to reopen shared scope for review.</p>}
          {typeof addTask === "function" && !planApproved && !adding && !editingId && (
            <button type="button" disabled={busy} onClick={() => setAdding(true)} className="mt-4 min-h-11 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800 transition hover:border-violet-400 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200"><span aria-hidden="true">＋</span> Add task</button>
          )}
        </section>

        {adding && <TaskAddForm onClose={() => setAdding(false)} />}
        {editingTask && <TaskEditor key={editingTask.id} task={editingTask} onClose={() => setEditingId(null)} />}
        {project.approvedSummary && (
          <details className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
            <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-violet-950 dark:text-violet-100">Approved project brief</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words border-t border-violet-200 pt-3 font-sans text-sm leading-relaxed text-slate-600 dark:border-violet-900 dark:text-slate-300">{project.approvedSummary}</pre>
          </details>
        )}

        <ol className="mt-6 space-y-5" aria-label="Dependency-ordered tasks">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-[1.75rem] border border-violet-200 bg-white p-5 shadow-[0_14px_38px_rgba(91,33,182,0.08)] dark:border-violet-900 dark:bg-slate-950 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">Task {String(task.order).padStart(2, "0")}</p>
                  <h2 className="mt-1 text-xl font-semibold leading-snug text-slate-950 dark:text-white">{task.title}</h2>
                </div>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">{AGENT_LABELS[task.ownerAgent]}</span>
              </div>
              <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">{task.description}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                  <dt className="text-sm font-semibold text-violet-950 dark:text-violet-100">Depends on</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{task.dependencies.length ? task.dependencies.map((id) => {
                    const dependency = tasks.find((item) => item.id === id);
                    return dependency ? taskLabel(dependency) : id;
                  }).join("; ") : "No prerequisites"}</dd>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4 dark:border-purple-900 dark:bg-purple-950/30">
                  <dt className="text-sm font-semibold text-purple-950 dark:text-purple-100">Expected output</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{task.expectedOutput}</dd>
                </div>
              </dl>
              {editButton(task.id)}
            </li>
          ))}
        </ol>

        <StudioHandoffButton variant="purple" disabled={busy || !!editingId || adding} />
        <ApprovalBar
          variant="purple"
          approveLabel={busy ? "Agents running…" : planApproved ? "Return to AI Team →" : "Approve Plan & Run Agents →"}
          disabled={busy || !!editingId || adding}
          onApprove={() => planApproved ? goTo("board") : void approveTaskPlan()}
          secondaryLabel="← Back"
          secondaryDisabled={busy || !!editingId || adding}
          onSecondary={() => goTo("requirements")}
          hint={editingId || adding ? "Save or cancel your task edit before approving the plan." : "Approving runs only tasks that need work. Existing successful, unaffected outputs are preserved."}
        />
      </section>

      <div className="min-w-0 space-y-6">
        <MetricsPanel variant="purple" />
        <ManagerPanel variant="purple" />
      </div>
    </div>
  );
}
