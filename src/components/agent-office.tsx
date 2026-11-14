"use client";

import { DeliverableView } from "@/components/deliverable-view";
import { TaskHandoff } from "@/components/task-handoff";
import { AGENT_LABELS } from "@/lib/agents";
import type { AgentOutput, AgentRole, Feedback, Review, Task } from "@/lib/types";
import { taskLabel } from "@/lib/workflow";
import { useEffect, useMemo, useRef, useState } from "react";

const OFFICE_ROLES: AgentRole[] = ["manager", "frontend", "backend", "database", "testing", "documentation", "review"];

const ROLE_META: Record<AgentRole, { short: string; icon: string; color: string }> = {
  manager: { short: "Manager", icon: "✦", color: "from-violet-500 to-purple-700" },
  frontend: { short: "Frontend", icon: "</>", color: "from-fuchsia-500 to-violet-600" },
  backend: { short: "Backend", icon: "≡", color: "from-indigo-500 to-violet-700" },
  database: { short: "Database", icon: "◉", color: "from-purple-500 to-indigo-700" },
  testing: { short: "Testing", icon: "✓", color: "from-emerald-500 to-teal-700" },
  documentation: { short: "Documentation", icon: "▤", color: "from-sky-500 to-indigo-600" },
  review: { short: "Review", icon: "⌕", color: "from-rose-500 to-violet-700" },
};

export type AgentActivity = {
  status: "Working" | "Waiting" | "Ready" | "Completed" | "Failed" | "Needs revision" | "Coordinating" | "No tasks";
  thought: string;
  taskId?: string;
};

function shortAction(prefix: string, text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  const value = cleaned.length > 31 ? `${cleaned.slice(0, 28).trim()}…` : cleaned;
  return `${prefix}${value}`;
}

/** Derives office copy only from persisted workflow state; it never invents hidden reasoning. */
export function deriveAgentActivity(role: AgentRole, tasks: Task[], outputs: AgentOutput[], reviews: Review[], busy: boolean): AgentActivity {
  const assigned = tasks.filter((task) => task.ownerAgent === role);
  const active = assigned.find((task) => task.state === "in_progress");
  const activeTask = tasks.find((task) => task.state === "in_progress");
  const allTasksComplete = tasks.length > 0 && tasks.every((task) => task.state === "completed");

  if (role === "manager") {
    if (activeTask) return { status: "Coordinating", thought: shortAction("Dispatching ", activeTask.title), taskId: activeTask.id };
    if (tasks.some((task) => task.state === "failed")) return { status: "Coordinating", thought: "Tracking tasks that need retry" };
    if (allTasksComplete) return { status: "Completed", thought: "All specialist tasks finished" };
    if (busy) return { status: "Coordinating", thought: "Coordinating the current run" };
    return { status: "Ready", thought: "Ready to coordinate the plan" };
  }

  if (role === "review") {
    if (allTasksComplete && busy && reviews.length === 0) return { status: "Working", thought: "Reviewing collected outputs" };
    if (reviews.length > 0) return { status: "Completed", thought: `Reviewed ${reviews.length} output${reviews.length === 1 ? "" : "s"}` };
    if (tasks.some((task) => task.state === "in_progress")) return { status: "Waiting", thought: "Waiting for specialists" };
    return { status: "Waiting", thought: allTasksComplete ? "Review is ready to run" : "Waiting for completed outputs" };
  }

  if (!assigned.length) return { status: "No tasks", thought: "No tasks assigned" };
  if (active) return { status: "Working", thought: shortAction("Working on ", active.title), taskId: active.id };
  const revision = assigned.find((task) => task.state === "needs_revision");
  if (revision) return { status: "Needs revision", thought: shortAction("Updating ", revision.title), taskId: revision.id };
  const failed = assigned.find((task) => task.state === "failed");
  if (failed) return { status: "Failed", thought: shortAction("Needs retry: ", failed.title), taskId: failed.id };
  const blocked = assigned.find((task) => task.state === "blocked");
  if (blocked) {
    const dependency = blocked.dependencies.map((id) => tasks.find((task) => task.id === id)).find((task) => task?.state !== "completed");
    return { status: "Waiting", thought: dependency ? shortAction("Waiting for ", dependency.title) : "Waiting for dependencies", taskId: blocked.id };
  }
  const queued = assigned.find((task) => task.state === "queued");
  if (queued) return { status: "Ready", thought: shortAction("Ready: ", queued.title), taskId: queued.id };
  if (assigned.every((task) => task.state === "completed" && outputs.some((output) => output.taskId === task.id))) {
    return { status: "Completed", thought: assigned.length === 1 ? "Task completed!" : `${assigned.length} tasks completed!`, taskId: assigned.at(-1)?.id };
  }
  return { status: "Waiting", thought: "Waiting for the next run" };
}

function AgentCharacter({ role, active }: { role: AgentRole; active: boolean }) {
  const index = OFFICE_ROLES.indexOf(role);
  const hair = ["#30263e", "#34283f", "#413449", "#493742", "#4a3a50", "#2d2940", "#51415d"][index];
  const shirt = ["#ddd0f5", "#ead8ff", "#d9ddfb", "#eee0f7", "#d8eced", "#e0e8fa", "#eadcf1"][index];
  return (
    <svg viewBox="0 0 160 145" className="h-28 w-32 sm:h-32 sm:w-36" aria-hidden="true">
      <ellipse cx="80" cy="137" rx="55" ry="7" fill="#6d4b87" opacity=".18" />
      <path d="M48 132c2-30 18-43 32-43s30 13 32 43" fill={shirt} stroke="#4a3b58" strokeWidth="4" />
      <circle cx="80" cy="67" r="35" fill="#fffaf9" stroke="#4a3b58" strokeWidth="4" />
      {index % 3 === 0 ? <path d="M46 66c0-30 15-44 36-44 25 0 38 18 34 48-8-10-14-22-17-31-10 12-26 18-53 19" fill={hair} stroke="#4a3b58" strokeWidth="4" />
        : index % 3 === 1 ? <path d="M45 65c-1-29 15-46 38-46 22 0 37 18 34 48-9-5-17-17-21-29-12 10-27 15-51 16" fill={hair} stroke="#4a3b58" strokeWidth="4" />
          : <path d="M46 58c4-27 18-39 38-39 23 0 36 17 33 43-14-4-25-13-32-24-8 10-20 17-39 20" fill={hair} stroke="#4a3b58" strokeWidth="4" />}
      <circle cx="68" cy="70" r="4" fill="#241b31" /><circle cx="93" cy="70" r="4" fill="#241b31" />
      <path d={active ? "M70 84q10 10 20 0" : "M72 85q8 5 16 0"} fill="none" stroke="#634c74" strokeWidth="3" strokeLinecap="round" />
      {role === "frontend" && <path d="M45 62c-8 0-11 6-11 15s4 15 12 15M115 62c8 0 11 6 11 15s-4 15-12 15" fill="none" stroke="#9a66e8" strokeWidth="7" strokeLinecap="round" />}
      {(role === "backend" || role === "review") && <><circle cx="68" cy="70" r="12" fill="none" stroke="#493958" strokeWidth="3" /><circle cx="93" cy="70" r="12" fill="none" stroke="#493958" strokeWidth="3" /><path d="M80 70h2" stroke="#493958" strokeWidth="3" /></>}
    </svg>
  );
}

function AgentThoughtBubble({ activity }: { activity: AgentActivity }) {
  return (
    <div className="relative mx-auto mb-1 max-w-[13rem] rounded-[50%] border-2 border-violet-300 bg-white/95 px-4 py-3 text-center text-xs font-semibold leading-snug text-violet-950 shadow-[0_10px_28px_rgba(91,33,182,0.13)] sm:text-sm">
      {activity.thought}
      <span className="absolute -bottom-3 left-1/2 size-4 -translate-x-1/2 rounded-full border-2 border-violet-300 bg-white" />
      <span className="absolute -bottom-6 left-[44%] size-2.5 rounded-full border-2 border-violet-300 bg-white" />
    </div>
  );
}

function AgentDesk({ role, activity, selected, onSelect, setButtonRef }: { role: AgentRole; activity: AgentActivity; selected: boolean; onSelect: () => void; setButtonRef: (node: HTMLButtonElement | null) => void }) {
  const meta = ROLE_META[role];
  const working = activity.status === "Working" || activity.status === "Coordinating";
  return (
    <button ref={setButtonRef} type="button" onClick={onSelect} aria-pressed={selected} aria-label={`${AGENT_LABELS[role]}, ${activity.status}. ${activity.thought}`}
      className={`group relative flex min-h-[20rem] flex-col justify-end rounded-[2rem] px-2 pb-2 pt-3 text-left transition duration-200 motion-reduce:transition-none ${selected ? "bg-violet-200/55 ring-4 ring-violet-500 shadow-[0_20px_45px_rgba(124,58,237,0.28)]" : "hover:bg-white/35 hover:shadow-xl"}`}>
      <div className="absolute inset-x-2 top-2"><AgentThoughtBubble activity={activity} /></div>
      <div className="relative mx-auto mb-[-.6rem] mt-20"><AgentCharacter role={role} active={working} /></div>
      <div className={`relative h-24 w-full rounded-t-xl border-2 border-violet-950/35 bg-gradient-to-b ${selected ? "from-violet-300 to-violet-500" : "from-[#dcb29d] to-[#bd837b]"} shadow-[0_10px_20px_rgba(63,36,76,0.22)]`}>
        <div className="absolute -top-14 left-1/2 h-16 w-24 -translate-x-1/2 rounded-lg border-[5px] border-[#4c3a59] bg-gradient-to-br from-violet-200 to-violet-500 shadow-lg">
          <span className="flex h-full items-center justify-center font-mono text-lg font-bold text-white">{meta.icon}</span>
        </div>
        <div className="absolute inset-x-3 bottom-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-300/80 bg-white/90 px-2 text-center font-bold text-violet-950 shadow-sm">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs text-white ${meta.color}`}>{meta.icon}</span>
          <span className="whitespace-nowrap text-xs sm:text-sm">{meta.short}</span>
        </div>
        <span className="absolute -bottom-5 left-4 h-6 w-3 rounded-b bg-[#875f65]" /><span className="absolute -bottom-5 right-4 h-6 w-3 rounded-b bg-[#875f65]" />
      </div>
      <span className={`absolute right-4 top-4 size-3 rounded-full border-2 border-white ${working ? "animate-pulse bg-emerald-500 motion-reduce:animate-none" : activity.status === "Failed" ? "bg-rose-500" : activity.status === "Completed" ? "bg-violet-500" : "bg-slate-300"}`} aria-hidden="true" />
    </button>
  );
}

function StatusPill({ activity }: { activity: AgentActivity }) {
  const tone = activity.status === "Working" || activity.status === "Coordinating" ? "bg-emerald-100 text-emerald-900" : activity.status === "Failed" ? "bg-rose-100 text-rose-900" : activity.status === "Needs revision" ? "bg-amber-100 text-amber-950" : activity.status === "Completed" ? "bg-violet-100 text-violet-900" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${tone}`}><span className="size-2.5 rounded-full bg-current opacity-75" />{activity.status}</span>;
}

function ReviewFindings({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return <p className="rounded-xl bg-violet-50 p-3 text-sm text-slate-600">No review findings are available yet.</p>;
  return <div className="space-y-3">{reviews.map((review) => {
    const findings = [...review.missingItems, ...review.conflicts, ...review.suggestions];
    return <section key={review.id} className="rounded-xl border border-violet-100 bg-violet-50/70 p-3"><p className="font-semibold capitalize text-violet-950">{review.result}</p>{findings.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{findings.map((item, index) => <li key={`${review.id}-${index}`}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-slate-600">No issues recorded.</p>}</section>;
  })}</div>;
}

function AgentDetailsPanel({ role, activity, tasks, outputs, reviews, feedbackItems, busy, skippedTaskIds, onRetry, onSkip, onClose, panelRef }: {
  role: AgentRole; activity: AgentActivity; tasks: Task[]; outputs: AgentOutput[]; reviews: Review[]; feedbackItems: Feedback[]; busy: boolean; skippedTaskIds: string[];
  onRetry: (id: string) => void; onSkip: (id: string) => void; onClose: () => void; panelRef: React.RefObject<HTMLElement | null>;
}) {
  const assigned = useMemo(() => tasks.filter((task) => task.ownerAgent === role), [role, tasks]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(activity.taskId ?? assigned[0]?.id);
  const selectedTask = assigned.find((task) => task.id === selectedTaskId) ?? assigned[0];
  const output = outputs.find((item) => item.taskId === selectedTask?.id);
  const taskReviews = output ? reviews.filter((review) => review.outputId === output.id) : [];
  const waitingDependencies = selectedTask?.dependencies.filter((id) => tasks.find((task) => task.id === id)?.state !== "completed") ?? [];

  return (
    <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="agent-panel-title" className="fixed inset-3 z-50 overflow-y-auto rounded-[2rem] border border-violet-200 bg-white/95 p-5 shadow-[0_30px_90px_rgba(46,16,101,0.3)] backdrop-blur-xl dark:border-violet-800 dark:bg-slate-950/95 xl:static xl:z-auto xl:max-h-[74rem] xl:min-h-[48rem] xl:w-[24rem] xl:self-start">
      <header className="flex items-start justify-between gap-3 border-b border-violet-100 pb-4 dark:border-violet-900">
        <div className="flex min-w-0 items-center gap-3"><span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-mono font-bold text-white shadow-lg ${ROLE_META[role].color}`}>{ROLE_META[role].icon}</span><div><h2 id="agent-panel-title" className="text-xl font-bold text-violet-950 dark:text-violet-100">{AGENT_LABELS[role]}</h2><div className="mt-2"><StatusPill activity={activity} /></div></div></div>
        <button type="button" onClick={onClose} aria-label={`Close ${AGENT_LABELS[role]} details`} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 text-2xl text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200">×</button>
      </header>

      {role === "manager" && <div className="mt-5 space-y-4"><section><h3 className="text-lg font-bold text-violet-950 dark:text-violet-100">Planning context</h3><p className="mt-2 rounded-xl bg-violet-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-violet-950/40 dark:text-slate-200">The Manager coordinates the approved plan and observable task handoffs. It has {tasks.length} task{tasks.length === 1 ? "" : "s"} across {new Set(tasks.map((task) => task.ownerAgent)).size} assigned specialist role{new Set(tasks.map((task) => task.ownerAgent)).size === 1 ? "" : "s"}.</p></section><section><h3 className="font-bold text-violet-950 dark:text-violet-100">Current activity</h3><p className="mt-2 rounded-xl border border-violet-100 p-3 text-sm text-slate-700 dark:border-violet-900 dark:text-slate-200">{activity.thought}</p></section></div>}

      {role === "review" && <div className="mt-5"><h3 className="mb-3 text-lg font-bold text-violet-950 dark:text-violet-100">Review findings</h3><ReviewFindings reviews={reviews} /></div>}

      {role !== "manager" && role !== "review" && <div className="mt-5">
        {!assigned.length ? <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50 p-5 text-center"><p className="font-semibold text-violet-950">No tasks assigned</p><p className="mt-1 text-sm text-slate-600">This specialist remains available but is not part of the current task plan.</p></div> : <>
          {assigned.length > 1 && <div><label htmlFor={`task-select-${role}`} className="text-sm font-semibold text-violet-950 dark:text-violet-100">Assigned task</label><select id={`task-select-${role}`} value={selectedTask?.id} onChange={(event) => setSelectedTaskId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm focus:border-violet-500 dark:border-violet-800 dark:bg-slate-950">{assigned.map((task) => <option key={task.id} value={task.id}>{taskLabel(task)}</option>)}</select></div>}
          {selectedTask && <div className="mt-4 space-y-4">
            <section><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-600">Current task</p><h3 className="mt-1 text-lg font-bold text-violet-950 dark:text-violet-100">{taskLabel(selectedTask)}</h3><p className="mt-2 rounded-xl bg-violet-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-violet-950/40 dark:text-slate-200">{selectedTask.description}</p></section>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-xl border border-violet-100 p-3 dark:border-violet-900"><h4 className="text-sm font-bold text-violet-950 dark:text-violet-100">Dependencies</h4>{selectedTask.dependencies.length ? <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">{selectedTask.dependencies.map((id) => { const dependency = tasks.find((task) => task.id === id); return <li key={id}>{dependency ? taskLabel(dependency) : "Removed task"} · {dependency?.state === "completed" ? "complete" : "waiting"}</li>; })}</ul> : <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">No prerequisites</p>}</div><div className="rounded-xl border border-violet-100 p-3 dark:border-violet-900"><h4 className="text-sm font-bold text-violet-950 dark:text-violet-100">Expected output</h4><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedTask.expectedOutput}</p></div></section>
            {selectedTask.state === "failed" && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-sm font-semibold text-rose-900">{skippedTaskIds.includes(selectedTask.id) ? "Skipped for now — not completed." : "Execution failed. Completed work is preserved."}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || waitingDependencies.length > 0} onClick={() => onRetry(selectedTask.id)} className="min-h-11 rounded-xl bg-violet-700 px-4 font-semibold text-white disabled:opacity-50">Retry task</button>{!skippedTaskIds.includes(selectedTask.id) && <button type="button" disabled={busy} onClick={() => onSkip(selectedTask.id)} className="min-h-11 rounded-xl border border-rose-300 px-4 font-semibold text-rose-900 disabled:opacity-50">Skip for now</button>}</div></div>}
            {output && <><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-violet-100 px-3 py-1 font-semibold text-violet-900">Confidence {Math.round(output.confidence * 100)}%</span><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{output.retryCount + 1} attempt{output.retryCount ? "s" : ""}</span></div><DeliverableView title="Generated deliverable" text={output.summary} humanEdited={output.humanEdited} badge={output.approved} /></>}
            <TaskHandoff task={selectedTask} tasks={tasks} outputs={outputs} feedbackItems={feedbackItems} />
            {taskReviews.length > 0 && <section><h4 className="mb-2 font-bold text-violet-950 dark:text-violet-100">Review findings</h4><ReviewFindings reviews={taskReviews} /></section>}
          </div>}
        </>}
      </div>}
    </aside>
  );
}

export function AgentOffice({ tasks, outputs, reviews, feedbackItems, busy, skippedTaskIds, onRetry, onSkip }: {
  tasks: Task[]; outputs: AgentOutput[]; reviews: Review[]; feedbackItems: Feedback[]; busy: boolean; skippedTaskIds: string[]; onRetry: (id: string) => void; onSkip: (id: string) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<AgentRole | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Partial<Record<AgentRole, HTMLButtonElement | null>>>({});
  const activities = useMemo(() => Object.fromEntries(OFFICE_ROLES.map((role) => [role, deriveAgentActivity(role, tasks, outputs, reviews, busy)])) as Record<AgentRole, AgentActivity>, [tasks, outputs, reviews, busy]);

  function closePanel() {
    const role = selectedRole;
    setSelectedRole(null);
    requestAnimationFrame(() => role && triggerRefs.current[role]?.focus());
  }
  useEffect(() => {
    if (!selectedRole) return;
    panelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closePanel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // closePanel deliberately uses the role from this render for focus restoration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole]);

  return (
    <div className={`mt-6 grid items-start gap-5 ${selectedRole ? "xl:grid-cols-[minmax(0,1fr)_24rem]" : ""}`}>
      <section aria-label="Interactive AI team office" className="relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,.88),transparent_31%),linear-gradient(145deg,#f7efff_0%,#e7d8fb_52%,#f5eaff_100%)] px-3 pb-8 pt-7 shadow-[0_28px_80px_rgba(91,33,182,0.18)] sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[repeating-linear-gradient(90deg,rgba(121,82,148,.1)_0,rgba(121,82,148,.1)_1px,transparent_1px,transparent_80px),linear-gradient(#eadbf5,#d9c2ea)]" />
        <div className="pointer-events-none absolute left-6 top-7 hidden sm:block">
          <div className="relative h-32 w-24 overflow-hidden rounded-t-[2rem] border-[7px] border-violet-300/35 bg-gradient-to-b from-fuchsia-300 via-pink-200 to-orange-100 shadow-inner"><span className="absolute inset-y-0 left-1/2 w-1 bg-violet-400/25" /><span className="absolute inset-x-0 top-1/2 h-1 bg-violet-400/25" /><span className="absolute bottom-3 right-2 h-10 w-3 bg-violet-500/20" /><span className="absolute bottom-3 right-6 h-6 w-4 bg-violet-500/15" /></div>
          <div className="relative -ml-2 -mt-5 h-20 w-20"><span className="absolute bottom-0 left-5 h-10 w-11 rounded-b-2xl bg-violet-300" /><span className="absolute left-2 top-4 h-8 w-12 -rotate-[35deg] rounded-[100%_0] bg-emerald-500/70" /><span className="absolute left-10 top-0 h-10 w-7 rotate-[20deg] rounded-[100%_0] bg-emerald-600/70" /><span className="absolute left-10 top-7 h-7 w-11 rotate-[35deg] rounded-[0_100%] bg-lime-600/60" /></div>
        </div>
        <div className="pointer-events-none absolute right-8 top-7 hidden h-36 w-48 rounded-2xl border-8 border-violet-300/25 bg-white/35 p-3 shadow-inner sm:block"><div className="h-4 rounded bg-violet-200/60" /><div className="mt-3 flex h-20 items-end gap-2 border-b-4 border-violet-300/35 px-2">{[54, 68, 48, 72, 58, 64].map((height, i) => <span key={i} style={{ height }} className={`w-4 rounded-t ${i % 2 ? "bg-fuchsia-300/55" : "bg-violet-400/50"}`} />)}</div><span className="absolute -top-6 right-7 h-10 w-16 rounded-[100%_0] bg-emerald-500/55" /><span className="absolute -top-9 right-16 h-12 w-8 rotate-30 rounded-[100%_0] bg-lime-600/55" /></div>
        <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {OFFICE_ROLES.map((role, index) => <div key={role} className={index >= 4 ? "xl:translate-x-1/2" : ""}><AgentDesk role={role} activity={activities[role]} selected={selectedRole === role} onSelect={() => setSelectedRole(role)} setButtonRef={(node) => { triggerRefs.current[role] = node; }} /></div>)}
        </div>
      </section>
      {selectedRole && <><button type="button" aria-label="Close agent details" onClick={closePanel} className="fixed inset-0 z-40 cursor-default bg-violet-950/30 backdrop-blur-sm xl:hidden" /><AgentDetailsPanel key={selectedRole} role={selectedRole} activity={activities[selectedRole]} tasks={tasks} outputs={outputs} reviews={reviews} feedbackItems={feedbackItems} busy={busy} skippedTaskIds={skippedTaskIds} onRetry={onRetry} onSkip={onSkip} onClose={closePanel} panelRef={panelRef} /></>}
    </div>
  );
}
