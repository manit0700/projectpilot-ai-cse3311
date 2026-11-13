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
  const tone = live ? "border-teal-200 bg-teal-50 text-teal-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${tone}`}>
      {live ? `LIVE · ${provider === "gemini" ? "Gemini" : "OpenRouter"}` : "DEMO · prepared output"}
    </span>
  );
}

export function AgentCards({ activity }: { activity: Activity }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Agent activity" aria-live="polite">
      {agentNames.map(([id, name]) => {
        const active = isWorking(activity[id].status);
        return (
          <article key={id} data-working={active}
            className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm ${
              active ? "border-teal-700 ring-1 ring-teal-700" : "border-slate-200"}`}>
            <h2 className="text-base font-semibold text-slate-900">{name}</h2>
            <p className="mt-1 text-sm font-semibold text-teal-800">{activity[id].status}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{activity[id].task}</p>
          </article>
        );
      })}
    </section>
  );
}

const preStyles = "mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 " +
  "font-mono text-sm leading-relaxed";
const liveHelp = "Actual model output appears here as it arrives. Agents run in dependency order: manager → " +
  "developer → reviewer → developer revisions. Only public response text is shown; source review does not run browser tests.";
const demoHelp = "Demo mode replays prepared output from a real earlier live run. Unlock live agents to stream " +
  "real model output for your own brief.";
type LiveResponseProps = { open: boolean; onToggle: () => void; model: string; text: string; live: boolean };
export function LiveResponse({ open, onToggle, model, text, live }: LiveResponseProps) {
  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Live response · <span className="font-normal text-slate-600">{model || "No agent running"}</span>
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
