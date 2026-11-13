"use client";

import { useRef, useState } from "react";
import { EXPORT_GROUPS, EXPORT_ITEMS, type ExportGroup, type ExportItem } from "@/lib/export-catalog";
import { downloadFile } from "@/lib/export-download";
import { useProjectStore } from "@/lib/store";
import type { WorkflowState } from "@/lib/workflow";

// Every download in one place, usable at any step. Mount it in the Final screen or the header:
//   <ExportPanel />            full section
//   <ExportPanel compact />    collapsible menu ("Export & backup")
// It reads the store itself; the only props are presentation.

export interface ExportPanelProps {
  /** Render as a collapsible <details> menu instead of an always-open section. */
  compact?: boolean;
  className?: string;
}

const MAX_IMPORT_BYTES = 8_000_000;
type ImportResult = { ok: true } | { ok: false; error: string };

export function ExportPanel({ compact = false, className = "" }: ExportPanelProps) {
  const store = useProjectStore();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Feature-detect the store's importer so the panel still renders if it is missing.
  const importProject = (store as unknown as { importProject?: (json: string) => ImportResult }).importProject;
  const latest = (): WorkflowState => (typeof store.exportState === "function" ? store.exportState() : store);
  const hasProject = Boolean(store.project.id);

  function download(item: ExportItem) {
    setMessage(""); setError("");
    try {
      const snapshot = latest();
      const filename = item.filename(snapshot);
      downloadFile(filename, item.build(snapshot, { mode: store.managerMode }), item.mime);
      setMessage(`Downloaded ${filename}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be created.");
    }
  }

  async function chooseFile(file: File | undefined) {
    setMessage(""); setError(""); setPending(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { setError("That file is too large to be a ProjectPilot plan."); return; }
    const text = await file.text();
    if (hasProject) setPending({ name: file.name, text });
    else runImport(text, file.name);
  }

  function runImport(text: string, name: string) {
    if (!importProject) return;
    const result = importProject(text);
    setPending(null);
    if (fileInput.current) fileInput.current.value = "";
    if (result.ok) setMessage(`Imported ${name}. Your project was restored.`);
    else setError(result.error);
  }

  const body = (
    <div className={compact ? "mt-3" : ""}>
      <p className="text-sm text-slate-600">Available at any step. Unfinished plans are marked as drafts.</p>
      {(Object.keys(EXPORT_GROUPS) as ExportGroup[]).map((group) => (
        <section key={group} className="mt-4" aria-labelledby={`export-group-${group}`}>
          <h3 id={`export-group-${group}`} className="text-sm font-semibold uppercase tracking-wide text-slate-600">{EXPORT_GROUPS[group]}</h3>
          <ul className="mt-2 space-y-2">
            {EXPORT_ITEMS.filter((item) => item.group === group).map((item) => {
              const reason = item.unavailable(store);
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="font-medium text-slate-900">{item.label}</div>
                    <p className="text-sm text-slate-600">{reason ?? item.description}</p>
                  </div>
                  <button type="button" disabled={Boolean(reason)} onClick={() => download(item)} aria-label={`Download ${item.label}`}
                    className="min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50">
                    Download
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-4" aria-labelledby="export-import">
        <h3 id="export-import" className="text-sm font-semibold uppercase tracking-wide text-slate-600">Restore a backup</h3>
        <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-sm text-slate-600">Import a plan.json you downloaded earlier to continue on this browser.</p>
          <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" id="export-import-file" tabIndex={-1}
            disabled={!importProject || store.busy} onChange={(e) => void chooseFile(e.target.files?.[0])} />
          <button type="button" disabled={!importProject || store.busy} onClick={() => fileInput.current?.click()}
            className="mt-2 min-h-11 rounded-xl border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50">
            Import plan.json
          </button>
          {!importProject && <p className="mt-2 text-sm text-slate-600">Import is not available in this version of the app.</p>}
          {store.busy && importProject && <p className="mt-2 text-sm text-slate-600">Wait for the current run to finish before importing.</p>}
        </div>
        {pending && (
          <div role="alertdialog" aria-label="Replace the current project" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm text-amber-950">Importing {pending.name} replaces the project in this browser. Download a backup first if you want to keep it.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => download(EXPORT_ITEMS.find((i) => i.id === "plan-json")!)} className="min-h-11 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900">Download current backup</button>
              <button type="button" onClick={() => runImport(pending.text, pending.name)} className="min-h-11 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Replace with imported plan</button>
              <button type="button" onClick={() => { setPending(null); if (fileInput.current) fileInput.current.value = ""; }} className="min-h-11 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900">Cancel</button>
            </div>
          </div>
        )}
      </section>
      <p role="status" className="mt-3 text-sm text-teal-900">{message}</p>
      {error && <p role="alert" className="mt-1 text-sm text-rose-800">{error}</p>}
    </div>
  );

  if (compact) {
    return (
      <details className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${className}`}>
        <summary className="min-h-9 cursor-pointer text-sm font-semibold text-slate-900">Export &amp; backup</summary>
        {body}
      </details>
    );
  }
  return (
    <section className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`} aria-labelledby="export-panel-title">
      <h2 id="export-panel-title" className="text-lg font-semibold text-slate-900">Export and backup</h2>
      {body}
    </section>
  );
}
