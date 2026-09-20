"use client";

import { useState } from "react";
import { AGENT_LABELS } from "@/lib/agents";
import { useProjectStore } from "@/lib/store";
import { taskLabel } from "@/lib/workflow";
import type { AgentRole, Task } from "@/lib/types";

export function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { agents, tasks, editTask } = useProjectStore();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [ownerAgent, setOwnerAgent] = useState(task.ownerAgent);
  const [dependencies, setDependencies] = useState(task.dependencies);
  const [error, setError] = useState<string | null>(null);
  const inputClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base";

  return (
    <form aria-label={`Edit ${taskLabel(task)}`} className="mt-6 space-y-4 rounded-xl border border-teal-200 bg-teal-50 p-4" onSubmit={(event) => {
      event.preventDefault();
      const message = editTask(task.id, { title, description, ownerAgent, dependencies });
      setError(message);
      if (!message) onClose();
    }}>
      <h2 className="text-lg font-semibold">Edit {taskLabel(task)}</h2>
      <label className="block font-medium">Task title<input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></label>
      <label className="block font-medium">Task description<textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></label>
      <label className="block font-medium">Assigned agent<select value={ownerAgent} onChange={(e) => setOwnerAgent(e.target.value as AgentRole)} className={inputClass}>
        {agents.filter((a) => a.role !== "manager" && a.role !== "review").map((a) => <option key={a.id} value={a.role}>{AGENT_LABELS[a.role]}</option>)}
      </select></label>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">Dependencies</legend>
        <p className="text-sm text-slate-600">Choose tasks that must finish first. Self-dependencies are excluded; circular dependencies cannot be saved.</p>
        {tasks.filter((t) => t.id !== task.id).map((t) => <label key={t.id} className="flex items-start gap-3 rounded-lg bg-white p-3">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-teal-700" checked={dependencies.includes(t.id)} onChange={(e) => setDependencies((ids) => e.target.checked ? [...ids, t.id] : ids.filter((id) => id !== t.id))} />
          <span>{taskLabel(t)}</span>
        </label>)}
      </fieldset>
      {error && <p role="alert" className="text-rose-800">{error}</p>}
      <p className="text-sm text-slate-600">Saving does not run agents. The task plan still requires your approval.</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white">Save task</button>
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-3">Cancel</button>
      </div>
    </form>
  );
}
