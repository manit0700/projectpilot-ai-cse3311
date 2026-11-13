"use client";

import { useEffect, useRef } from "react";

const OPEN_EVENT = "projectpilot-shortcuts";

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl/Cmd + Enter", "Run the primary action of the current screen"],
  ["?", "Open this list of shortcuts"],
  ["Esc", "Close this dialog"],
];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Opens the shortcuts dialog from anywhere (for example a header button inside a collapsed menu). */
export function ShortcutsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className ?? "min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"}>
      Keyboard shortcuts <kbd className="ml-1 rounded border border-slate-300 px-1.5 font-mono text-xs">?</kbd>
    </button>
  );
}

/** Mount once. Listens for the shortcut keys and renders the (native, focus-trapping) dialog. */
export function Shortcuts() {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const open = () => {
      const el = dialog.current;
      if (!el || el.open) return;
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
    };
    const onKey = (event: KeyboardEvent) => {
      if (dialog.current?.open) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        const primary = document.querySelector<HTMLButtonElement>("main [data-primary-action]:not(:disabled)");
        if (primary) { event.preventDefault(); primary.click(); }
        return;
      }
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, open);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_EVENT, open); };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="shortcuts-title"
      onClose={() => opener.current?.focus()}
      // The dialog has a single focusable control, so Tab simply keeps focus on it.
      onKeyDown={(event) => { if (event.key === "Tab") { event.preventDefault(); dialog.current?.querySelector<HTMLElement>("button")?.focus(); } }}
      onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-slate-300 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/50"
    >
      <h2 id="shortcuts-title" className="text-lg font-semibold">Keyboard shortcuts</h2>
      <dl className="mt-3 space-y-2">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="flex flex-wrap items-baseline justify-between gap-2">
            <dt><kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-sm">{keys}</kbd></dt>
            <dd className="text-sm text-slate-700">{action}</dd>
          </div>
        ))}
      </dl>
      <form method="dialog" className="mt-4 flex justify-end">
        <button autoFocus className="min-h-11 rounded-xl bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800">Close</button>
      </form>
    </dialog>
  );
}
