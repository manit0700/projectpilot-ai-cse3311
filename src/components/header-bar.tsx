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
  const { reset, currentStep, busy, managerMode, setManagerMode, savedStatus, project } = useProjectStore();
  const narrow = useNarrow();
  // Re-read on every render (the store writes the copy and updates savedStatus); server render assumes none.
  const recovery = useSyncExternalStore(subscribeStorage, hasRecoveryCopy, () => false);
  const showModeControls = currentStep !== "idea" || isLive || !!project.id;

  const modeControls = (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <label className="text-sm font-medium text-white">Agent mode <select aria-label="Agent mode" aria-describedby={modeLocked ? "mode-lock-help" : "mode-help"} value={managerMode} disabled={modeLocked} onChange={(e) => setManagerMode(e.target.value as "demo" | "live")} className="ml-2 min-h-11 rounded-lg border border-white/25 bg-white/10 p-2 text-white disabled:cursor-not-allowed disabled:opacity-60"><option className="text-slate-900" value="demo">Demo (default)</option><option className="text-slate-900" value="live">Live API{providerConfigured ? ` · ${providerLabel}` : " · not configured"}</option></select></label>
        {modeLocked ? <p id="mode-lock-help" className="mt-1 text-xs text-violet-200">Mode locked: {modeLockReason}</p> : <p id="mode-help" className="mt-1 text-xs text-violet-200">Live is opt-in and asks for data-sharing consent.</p>}
      </div>
      {isLive && <button type="button" disabled={busy} aria-describedby={busy ? "live-access-help" : undefined} className="min-h-11 text-white underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50" onClick={onLiveAccess}>Live access</button>}
      {isLive && busy && <span id="live-access-help" className="text-xs text-violet-200">Available after the current run.</span>}
    </div>
  );

  const statusLine = (
    <p className="mb-2 text-sm text-slate-600 max-sm:text-violet-100 dark:text-slate-300" role="status">{savedStatus}{recovery && <> <button type="button" className="inline-flex min-h-11 items-center underline" onClick={downloadRecovery}>Download recovery data</button></>} · {isLive ? `Live manager, specialists, and review via ${providerLabel} · Generated code needs human testing.` : "Demo mode · Prepared sample responses."}</p>
  );

  const resetButton = currentStep !== "idea" && (
    <>
      <button
        type="button"
        disabled={busy}
        aria-describedby={busy ? "reset-help" : undefined}
        onClick={() => { if (window.confirm("Start over? This clears the current saved project.")) reset(); }}
        className="min-h-11 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reset
      </button>
      {busy && <span id="reset-help" className="text-xs text-violet-200">Reset is paused while agents run.</span>}
    </>
  );

  const studioLink = <Link href="/studio" className="inline-flex min-h-11 items-center rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-medium text-white hover:bg-white/15">Website Studio</Link>;
  const badge = (
    <span
      role="status"
      aria-label={isLive ? `Live mode using ${providerLabel}` : "Demo mode using prepared responses"}
      className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${isLive ? "border-fuchsia-300/70 bg-fuchsia-400/15 text-fuchsia-100" : "border-violet-300/60 bg-white/10 text-violet-100"}`}
    >
      {isLive ? `LIVE · ${providerLabel}` : <>DEMO<span className="hidden sm:inline"> · prepared responses</span></>}
    </span>
  );

  return (
    <header className="border-b border-violet-200/60 bg-gradient-to-r from-[#24163d] via-[#35204f] to-[#251740] text-white shadow-[0_8px_30px_rgba(38,22,61,0.18)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:gap-4 sm:py-5 sm:px-6">
        <div className="flex items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-white sm:text-2xl"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-violet-300" fill="none"><path d="M21 3 9.8 14.2M21 3l-7.1 18-4.1-6.8L3 10.1 21 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>ProjectPilot AI</div>
          {badge}
        </div>
        {narrow ? (
          <div className="flex items-center gap-2">
            {resetButton}
            <details className="relative">
              <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center rounded-xl border border-white/30 bg-white/10 px-3 text-sm font-medium text-white [&::-webkit-details-marker]:hidden">Settings</summary>
              <div className="absolute right-0 top-full z-20 mt-1 w-[calc(100vw-2rem)] max-w-sm space-y-3 rounded-xl border border-violet-400/30 bg-[#2c1a46] p-3 shadow-xl">
                {studioLink}
                {showModeControls && modeControls}
                {statusLine}
                <ShortcutsButton className="min-h-11 rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/15" />
                {exportSlot?.(true)}
              </div>
            </details>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {studioLink}
            {showModeControls && modeControls}
            <ShortcutsButton className="min-h-11 rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/15" />
            {exportSlot?.(false)}
            {resetButton}
          </div>
        )}
      </div>
      <div className="border-t border-white/10 bg-[#f7f1ff] px-4 pb-3 pt-3 text-slate-900 dark:bg-[#171020] dark:text-slate-100 sm:px-6 sm:pb-4">
        <div className="mx-auto max-w-7xl">
        {!narrow && statusLine}
        <WorkflowStepper />
        </div>
      </div>
    </header>
  );
}
