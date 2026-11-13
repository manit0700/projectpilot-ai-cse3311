"use client";

import { describeTaskIds, taskLabel } from "@/lib/workflow";
import type { AgentOutput, Feedback, Project, Task } from "@/lib/types";

/** First clause of the brief, capped at 60 characters, for headings. */
export function shortProjectTitle(project: Pick<Project, "title" | "description">): string {
  const source = (project.description || project.title).trim().replace(/\s+/g, " ");
  if (!source) return "Untitled project";
  const clause = source.split(/[.;:!?]|,\s|\s[—–]\s|\s(?:where|that|which|so that)\s/i)[0].trim() || source;
  if (clause.length <= 60) return clause;
  const cut = clause.slice(0, 60);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trim()}…`;
}

/** One-line description of what an in-progress agent received and is producing. */
export function handoffLogLine(task: Task, tasks: Task[] = []): string {
  const known = describeTaskIds(task.dependencies, tasks);
  const received = ["project brief", ...(known ? known.split("; ") : [])].join(" + ");
  return `Received: ${received} · Producing: ${task.expectedOutput}`;
}

export function TaskHandoff({ task, tasks, outputs, feedbackItems }: {
  task: Task;
  tasks: Task[];
  outputs: AgentOutput[];
  feedbackItems: Feedback[];
}) {
  const output = outputs.find((o) => o.taskId === task.id);
  const prerequisites = task.dependencies.map((id) => {
    const dependency = tasks.find((t) => t.id === id);
    const complete = dependency?.state === "completed" && outputs.some((o) => o.taskId === id);
    return { id, label: dependency ? taskLabel(dependency) : "Removed task", complete };
  });
  const feedback = feedbackItems.filter((f) => f.affectedTasks.includes(task.id));
  const attempts = output ? `${output.retryCount + 1} attempt${output.retryCount ? "s" : ""}${output.retryCount ? ` (${output.retryCount} retr${output.retryCount === 1 ? "y" : "ies"})` : ""}` : "Not run yet";

  return (
    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700">
      <summary className="min-h-11 cursor-pointer px-3 py-2.5 font-semibold text-slate-800">Handoff · what this agent received</summary>
      <dl className="space-y-2 border-t border-slate-200 px-3 py-3">
        <div>
          <dt className="font-semibold text-slate-800">Task contract</dt>
          <dd className="mt-0.5">{task.description}</dd>
          <dd className="mt-0.5"><span className="font-medium">Expected output:</span> {task.expectedOutput}</dd>
          <dd className="mt-0.5"><span className="font-medium">Constraints:</span> {task.constraints || "None stated"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Prerequisite outputs</dt>
          {prerequisites.length === 0 ? <dd className="mt-0.5">None · starts from the project brief only</dd> : (
            <dd className="mt-0.5"><ul className="list-disc pl-4">{prerequisites.map((p) => (
              <li key={p.id}>{p.label} — {p.complete ? "output complete, passed to this agent" : "output not yet available"}</li>
            ))}</ul></dd>
          )}
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Feedback referencing this task</dt>
          {feedback.length === 0 ? <dd className="mt-0.5">None</dd> : (
            <dd className="mt-0.5"><ul className="list-disc pl-4">{feedback.map((f) => (
              <li key={f.id}><span className="uppercase">{f.revisionStatus}</span> — {f.userRequest}</li>
            ))}</ul></dd>
          )}
        </div>
        <div>
          <dt className="font-semibold text-slate-800">Attempts</dt>
          <dd className="mt-0.5">{attempts}</dd>
        </div>
      </dl>
    </details>
  );
}
