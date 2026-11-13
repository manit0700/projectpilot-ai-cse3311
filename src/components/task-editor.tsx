"use client";

import { useState } from "react";
import { AGENT_LABELS } from "@/lib/agents";
import { useStoreExt } from "@/components/store-ext";
import { useProjectStore } from "@/lib/store";
import { taskLabel, type TaskEdit } from "@/lib/workflow";
import type { Task } from "@/lib/types";

const inputClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base";

function TaskForm({ heading, initial, excludeId, saveLabel, onSave, onClose }: {
  heading: string;
  initial: TaskEdit;
  excludeId?: string;
  saveLabel: string;
  onSave: (edit: TaskEdit) => string | null;
  onClose: () => void;
}) {
  const { agents, tasks } = useProjectStore();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [ownerAgent, setOwnerAgent] = useState(initial.ownerAgent);
  const [dependencies, setDependencies] = useState(initial.dependencies);
  const [error, setError] = useState<string | null>(null);

  return (
    <form aria-label={heading} className="mt-6 space-y-4 rounded-xl border border-teal-200 bg-teal-50 p-4" onSubmit={(event) => {
      event.preventDefault();
      const message = onSave({ title, description, ownerAgent, dependencies });
      setError(message);
      if (!message) onClose();
    }}>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <label className="block font-medium">Task title<input autoFocus required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></label>
      <label className="block font-medium">Task description<textarea required minLength={12} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></label>
      <label className="block font-medium">Assigned agent<select value={ownerAgent} onChange={(e) => setOwnerAgent(e.target.value as Task["ownerAgent"])} className={`${inputClass} min-h-11`}>
        {agents.filter((a) => a.role !== "manager" && a.role !== "review").map((a) => <option key={a.id} value={a.role}>{AGENT_LABELS[a.role]}</option>)}
      </select></label>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">Dependencies</legend>
        <p className="text-sm text-slate-600">Choose tasks that must finish first. Self-dependencies are excluded; circular dependencies cannot be saved.</p>
        {tasks.filter((t) => t.id !== excludeId).map((t) => <label key={t.id} className="flex min-h-11 items-start gap-3 rounded-lg bg-white p-3">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-teal-700" checked={dependencies.includes(t.id)} onChange={(e) => setDependencies((ids) => e.target.checked ? [...ids, t.id] : ids.filter((id) => id !== t.id))} />
          <span>{taskLabel(t)}</span>
        </label>)}
      </fieldset>
      {error && <p role="alert" className="text-rose-800">{error}</p>}
      <p className="text-sm text-slate-600">Saving does not run agents. The task plan still requires your approval.</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="min-h-11 rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white">{saveLabel}</button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3">Cancel</button>
      </div>
    </form>
  );
}

export function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { editTask } = useProjectStore();
  return (
    <TaskForm heading={`Edit ${taskLabel(task)}`} excludeId={task.id} saveLabel="Save task" onClose={onClose}
      initial={{ title: task.title, description: task.description, ownerAgent: task.ownerAgent, dependencies: task.dependencies }}
      onSave={(edit) => editTask(task.id, edit)} />
  );
}

/** Rendered only when the store provides `addTask`. */
export function TaskAddForm({ onClose }: { onClose: () => void }) {
  const { addTask } = useStoreExt();
  return (
    <TaskForm heading="Add task" saveLabel="Add task" onClose={onClose}
      initial={{ title: "", description: "", ownerAgent: "frontend", dependencies: [] }}
      onSave={(edit) => addTask?.(edit) ?? null} />
  );
}
