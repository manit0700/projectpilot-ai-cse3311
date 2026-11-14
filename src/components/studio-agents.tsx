"use client";
import type { StudioStage } from "@/lib/studio-demo";
import { Button, mutedStyles, Panel } from "./studio-ui";

export type Activity = Record<StudioStage, { status: string; task: string }>;
export const agentNames: [StudioStage, string][] = [
  ["plan", "Manager / Designer"], ["build", "Developer"], ["review", "Reviewer"],
];
export const initialActivity: Activity = {
  plan: { status: "Waiting", task: "Read the confirmed idea and prepare the website design." },
  build: { status: "Waiting", task: "Turn the approved design into HTML, CSS, and JavaScript." },
  review: { status: "Waiting", task: "Inspect the actual files and send findings to the developer." },
};
export const importedTask = "Idea, requirements, and task plan confirmed in the original workflow.";
export const isWorking = (status: string) => status.startsWith("Working");

export function ModePill({ live, provider }: { live: boolean; provider: "gemini" | "openrouter" }) {
  const tone = live ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100" : "border-violet-300/40 bg-white/10 text-violet-100";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${tone}`}>
      {live ? `LIVE · ${provider === "gemini" ? "Gemini" : "OpenRouter"}` : "DEMO · prepared output"}
    </span>
  );
}

export function AgentCards({ activity }: { activity: Activity }) {
  const icons: Record<StudioStage, string> = { plan: "✦", build: "</>", review: "⌕" };
  return (
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Agent activity" aria-live="polite">
      {agentNames.map(([id, name]) => {
        const active = isWorking(activity[id].status);
        return (
          <article key={id} data-working={active}
            className={`min-w-0 rounded-[1.5rem] border bg-white/95 p-4 shadow-[0_12px_30px_rgba(91,33,182,0.08)] dark:bg-slate-950/95 ${
              active ? "border-violet-500 ring-2 ring-violet-300/70 dark:ring-violet-800" : "border-violet-100 dark:border-violet-900"}`}>
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold ${active ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200"}`}>{icons[id]}</span>
              <div className="min-w-0"><h2 className="text-base font-bold text-violet-950 dark:text-violet-100">{name}</h2><p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(activity[id].status)}`}>{activity[id].status}</p></div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{activity[id].task}</p>
          </article>
        );
      })}
    </section>
  );
}

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value.startsWith("working")) return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
  if (value.includes("completed") || value.includes("passed")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  if (value.includes("error") || value.includes("failed")) return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200";
  if (value.includes("retry") || value.includes("revision")) return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

const preStyles = "mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-violet-900/20 bg-slate-950 p-4 " +
  "font-mono text-sm leading-relaxed text-violet-100";
const liveHelp = "Actual model output appears here as it arrives. Agents run in dependency order: manager → " +
  "developer → reviewer → developer revisions. Only public response text is shown; source review does not run browser tests.";
const demoHelp = "Demo mode replays prepared output from a real earlier live run. Unlock live agents to stream " +
  "real model output for your own brief.";
type LiveResponseProps = { open: boolean; onToggle: () => void; model: string; text: string; live: boolean };
export function LiveResponse({ open, onToggle, model, text, live }: LiveResponseProps) {
  return (
    <Panel className="border-violet-200 bg-gradient-to-br from-white to-violet-50/60 p-4 dark:border-violet-900 dark:from-slate-950 dark:to-violet-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-violet-950 dark:text-violet-100">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-violet-500" /> Live response · <span className="font-normal text-slate-600 dark:text-slate-300">{model || "No agent running"}</span>
        </h2>
        <Button variant="secondary" aria-expanded={open} aria-controls="studio-live-output" onClick={onToggle}>
          {open ? "Hide output" : "Show output"}
        </Button>
      </div>
      {open && (
        <div id="studio-live-output">
          <p className={`mt-2 ${mutedStyles}`}>
            {live ? liveHelp : demoHelp}
          </p>
          <pre aria-label="Live agent response" className={preStyles}>
            {text || (live ? "Waiting for an agent request. No prepared responses are used for live builds."
              : "Waiting for a demo step. Prepared output will appear here.")}
          </pre>
        </div>
      )}
    </Panel>
  );
}
