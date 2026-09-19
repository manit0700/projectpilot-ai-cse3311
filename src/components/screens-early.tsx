"use client";

import { ApprovalBar } from "@/components/shell";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import { useState } from "react";

const DEMO_IDEA =
  "An AI project workspace where a Manager Agent breaks a small software project into tasks, assigns frontend, backend, database, testing, and documentation agents, reviews their outputs, and asks the student for approval before major changes.";

const DEMO_TARGET_USER =
  "CSE students building small class projects with one shared workspace";

export function IdeaScreen() {
  const { startProject, startDemoProject } = useProjectStore();
  const [idea, setIdea] = useState("");
  const [targetUser, setTargetUser] = useState("CSE students / hackathon teammates");

  const loadDemoText = () => {
    setIdea(DEMO_IDEA);
    setTargetUser(DEMO_TARGET_USER);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        New project
      </h1>
      <p className="mt-1 text-sm text-slate-600">
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
          className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-700/30 focus:ring-2"
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-slate-800">
        Target user
        <input
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-teal-700/30 focus:ring-2"
        />
      </label>

      <div className="mt-4 rounded border border-teal-200 bg-teal-50 p-4">
        <div className="text-sm font-semibold text-teal-950">Class demo sample</div>
        <p className="mt-1 text-xs leading-5 text-teal-900">
          Use this to present the automatic multi-agent workflow: manager planning,
          specialist task assignment, review, and human approval.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDemoText}
            className="rounded border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-white"
          >
            Load sample text
          </button>
          <button
            type="button"
            onClick={startDemoProject}
            className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Run guided demo
          </button>
        </div>
      </div>

      <ApprovalBar
        approveLabel="Start clarifying questions"
        disabled={idea.trim().length < 12}
        onApprove={() => startProject(idea, targetUser)}
        hint="Human oversight starts here: nothing is finalized without your approval."
      />
    </div>
  );
}

export function QuestionsScreen() {
  const { questions, updateAnswer, submitAnswers, project } = useProjectStore();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Clarifying questions</h1>
      <p className="mt-1 text-sm text-slate-600">
        Manager is filling gaps for <span className="font-medium">{project.title}</span>.
        Incomplete answers block requirements generation.
      </p>

      <ul className="mt-6 space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded border border-slate-200 bg-white p-4">
            <div className="text-sm font-medium text-slate-900">
              {i + 1}. {q.prompt}
            </div>
            <p className="mt-1 text-xs text-slate-500">{q.why}</p>
            <textarea
              value={q.answer}
              onChange={(e) => updateAnswer(q.id, e.target.value)}
              rows={2}
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-700/30 focus:ring-2"
              placeholder="Your answer"
            />
          </li>
        ))}
      </ul>

      <ApprovalBar
        approveLabel="Generate requirements"
        onApprove={submitAnswers}
        hint="If requirements look incomplete later, the manager will send you back to clarify."
      />
    </div>
  );
}

export function RequirementsScreen() {
  const {
    requirements,
    toggleRequirement,
    approveRequirements,
  } = useProjectStore();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Requirements summary</h1>
      <p className="mt-1 text-sm text-slate-600">
        Approve or reject each requirement. Major changes need your checkpoint.
      </p>

      <ul className="mt-6 space-y-2">
        {requirements.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-start gap-3 rounded border border-slate-200 bg-white p-3"
          >
            <span
              className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                r.priority === "must"
                  ? "bg-rose-100 text-rose-800"
                  : r.priority === "should"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {r.priority}
            </span>
            <p className="min-w-0 flex-1 text-sm text-slate-800">{r.text}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleRequirement(r.id, "approved")}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  r.approvalStatus === "approved"
                    ? "bg-teal-700 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => toggleRequirement(r.id, "rejected")}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  r.approvalStatus === "rejected"
                    ? "bg-slate-800 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ApprovalBar
        approveLabel="Approve requirements → build tasks"
        onApprove={approveRequirements}
      />
    </div>
  );
}

export function TasksScreen() {
  const { tasks, approveTaskPlan, busy, project } = useProjectStore();

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-slate-900">Task breakdown</h1>
      <p className="mt-1 text-sm text-slate-600">
        Dependency-ordered plan. Approving runs specialist agents (mock AI if no
        API key).
      </p>

      {project.approvedSummary && (
        <pre className="mt-4 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 whitespace-pre-wrap">
          {project.approvedSummary}
        </pre>
      )}

      <div className="mt-6 overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Depends on</th>
              <th className="px-3 py-2">Expected output</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {t.order}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{t.title}</div>
                  <div className="text-xs text-slate-500">{t.description}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {AGENT_LABELS[t.ownerAgent]}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {t.dependencies.length
                    ? t.dependencies
                        .map((d) => tasks.find((x) => x.id === d)?.order ?? "?")
                        .join(", ")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {t.expectedOutput}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ApprovalBar
        approveLabel={busy ? "Agents running…" : "Approve plan & run agents"}
        disabled={busy}
        onApprove={() => void approveTaskPlan()}
        hint="Agents receive task id, description, dependencies, expected output, constraints, and shared context."
      />
    </div>
  );
}
