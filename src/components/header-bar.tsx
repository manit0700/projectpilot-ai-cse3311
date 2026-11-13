"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { ShortcutsButton } from "@/components/shortcuts";
import { WorkflowStepper } from "@/components/shell";
import { useProjectStore } from "@/lib/store";

const RECOVERY_KEY = "projectpilot-recovery";
const NARROW = "(max-width: 639px)";

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True under the `sm` breakpoint. Server and first client render assume desktop, then correct. */
function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function hasRecoveryCopy(): boolean {
  try { return !!localStorage.getItem(RECOVERY_KEY); } catch { return false; }
}

function downloadRecovery() {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "projectpilot-recovery.txt";
    link.click();
    URL.revokeObjectURL(url);
  } catch { /* storage or download unavailable */ }
}

export function HeaderBar({ isLive, providerLabel, providerConfigured, modeLocked, modeLockReason, onLiveAccess, exportSlot }: {
  isLive: boolean;
  providerLabel: string;
  providerConfigured: boolean;
  modeLocked: boolean;
  modeLockReason: string | null;
  onLiveAccess: () => void;
  exportSlot?: (inline: boolean) => ReactNode;
}) {
  const { reset, currentStep, busy, managerMode, setManagerMode, savedStatus } = useProjectStore();
  const narrow = useNarrow();
  // Re-read on every render (the store writes the copy and updates savedStatus); server render assumes none.
  const recovery = useSyncExternalStore(subscribeStorage, hasRecoveryCopy, () => false);

  const modeControls = (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="text-sm font-medium">Agent mode <select aria-label="Agent mode" aria-describedby={modeLocked ? "mode-lock-help" : "mode-help"} value={managerMode} disabled={modeLocked} onChange={(e) => setManagerMode(e.target.value as "demo" | "live")} className="ml-2 min-h-11 rounded-lg border border-slate-300 bg-white p-2 disabled:cursor-not-allowed disabled:opacity-60"><option value="demo">Demo (default)</option><option value="live">Live API{providerConfigured ? ` · ${providerLabel}` : " · not configured"}</option></select></label>
        {modeLocked ? <p id="mode-lock-help" className="mt-1 text-xs text-slate-600">Mode locked: {modeLockReason}</p> : <p id="mode-help" className="mt-1 text-xs text-slate-600">Live is opt-in and asks for data-sharing consent.</p>}
      </div>
      {isLive && <button type="button" disabled={busy} aria-describedby={busy ? "live-access-help" : undefined} className="min-h-11 underline disabled:cursor-not-allowed disabled:opacity-50" onClick={onLiveAccess}>Live access</button>}
      {isLive && busy && <span id="live-access-help" className="text-xs text-slate-600">Available after the current run.</span>}
    </div>
  );

  const statusLine = (
    <p className="mb-2 text-sm text-slate-600" role="status">{savedStatus}{recovery && <> <button type="button" className="inline-flex min-h-11 items-center underline" onClick={downloadRecovery}>Download recovery data</button></>} · {isLive ? `Live manager, specialists, and review via ${providerLabel} · Generated code needs human testing.` : "Demo mode · Prepared sample responses."}</p>
  );

  const resetButton = currentStep !== "idea" && (
    <>
      <button
        type="button"
        disabled={busy}
        aria-describedby={busy ? "reset-help" : undefined}
        onClick={() => { if (window.confirm("Start over? This clears the current saved project.")) reset(); }}
        className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reset
      </button>
      {busy && <span id="reset-help" className="text-xs text-slate-600">Reset is paused while agents run.</span>}
    </>
  );

  const studioLink = <Link href="/studio" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 font-medium">Website Studio</Link>;
  const badge = (
    <span
      role="status"
      aria-label={isLive ? `Live mode using ${providerLabel}` : "Demo mode using prepared responses"}
      className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${isLive ? "border-rose-300 bg-rose-50 text-rose-900" : "border-teal-300 bg-teal-50 text-teal-900"}`}
    >
      {isLive ? `LIVE · ${providerLabel}` : <>DEMO<span className="hidden sm:inline"> · prepared responses</span></>}
    </span>
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:gap-4 sm:py-5 sm:px-6">
        <div className="flex items-center gap-x-3 gap-y-1">
          <div className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">ProjectPilot AI</div>
          {badge}
        </div>
        {narrow ? (
          <div className="flex items-center gap-2">
            {resetButton}
            <details className="relative">
              <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-800 [&::-webkit-details-marker]:hidden">Settings</summary>
              <div className="absolute right-0 top-full z-20 mt-1 w-[calc(100vw-2rem)] max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                {studioLink}
                {modeControls}
                {statusLine}
                <ShortcutsButton />
                {exportSlot?.(true)}
              </div>
            </details>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {studioLink}
            {modeControls}
            <ShortcutsButton />
            {exportSlot?.(false)}
            {resetButton}
          </div>
        )}
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 sm:pb-5">
        {!narrow && statusLine}
        <WorkflowStepper />
      </div>
    </header>
  );
}
