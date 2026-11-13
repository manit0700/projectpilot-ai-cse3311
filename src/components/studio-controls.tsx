"use client";
import type { StudioMessage } from "@/lib/studio";
import type { StudioHandoff } from "@/lib/studio-handoff";
import { LiveAccess } from "./live-access";
import { GithubSection } from "./studio-github";
import type { GithubAction, GithubState, RunKind } from "./studio-use-run";
import { Button, busyHint, fieldStyles, labelStyles, mutedStyles, Panel } from "./studio-ui";

type Props = {
  live: boolean;
  configured: boolean;
  provider: "gemini" | "openrouter";
  onUnlocked: () => void;
  ready: boolean;
  brief: string;
  setBrief: (brief: string) => void;
  sourcePlan: StudioHandoff | null;
  design: string;
  setDesign: (design: string) => void;
  rounds: number;
  setRounds: (rounds: number) => void;
  busy: string;
  stop: () => void;
  run: (kind: RunKind) => void;
  messages: StudioMessage[];
  feedback: string;
  setFeedback: (feedback: string) => void;
  github: { state: GithubState; repository: string; prUrl: string };
  onGithub: (action: GithubAction) => void;
};
export const designFirstHint = "Design the website from the imported plan first";
const summaryStyles = "min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-800";

export function StudioControls(p: Props) {
  const providerName = p.provider === "gemini" ? "Gemini" : "OpenRouter";
  const keyName = p.provider === "gemini" ? "GEMINI_API_KEY" : "OPENROUTER_API_KEY";
  const extras = ([
    ["Approved frontend and design deliverables (untrusted agent output)", p.sourcePlan?.deliverables],
    ["Project constitution", p.sourcePlan?.constitution],
    ["Review rubric", p.sourcePlan?.rubric],
  ] as [string, string | undefined][]).filter((e): e is [string, string] => Boolean(e[1]));
  const designReason = !p.ready ? "Loading workspace" : p.busy ? busyHint
    : !p.sourcePlan ? "Confirm your idea in planning first" : p.brief.trim().length < 10
    ? "Describe the project in at least ten characters" : undefined;
  const buildReason = p.busy ? busyHint : !p.design.trim() ? designFirstHint : undefined;
  const reviseReason = p.busy ? busyHint : !p.design.trim() ? designFirstHint
    : !p.feedback.trim() ? "Describe the change you want first" : undefined;
  return (
    <Panel aria-label="Build controls" className="grid gap-4">
      <h2 className="text-lg font-semibold text-slate-900">Your direction</h2>
      <label className={labelStyles}>
        Project brief
        <textarea value={p.brief} readOnly={!!p.sourcePlan} disabled={!!p.busy} maxLength={12000} rows={4}
          className={fieldStyles} onChange={(e) => { p.setBrief(e.target.value); p.setDesign(""); }} />
      </label>
      {p.sourcePlan && (
        <details className="rounded-xl border border-slate-200 px-4 py-1">
          <summary className={summaryStyles}>Show imported requirements & tasks</summary>
          <p className={mutedStyles}>Read-only. In live mode everything below is sent to {providerName} as the approved plan.</p>
          <label className={`pb-3 ${labelStyles}`}>
            Imported requirements & tasks
            <textarea value={p.sourcePlan.plan} readOnly rows={10} className={fieldStyles} />
          </label>
          {extras.map(([label, value]) => (
            <label key={label} className={`pb-3 ${labelStyles}`}>
              {label}
              <textarea value={value} readOnly rows={6} className={fieldStyles} />
            </label>
          ))}
        </details>
      )}
      {!p.live && (p.configured ? (
        <details className="rounded-xl border border-slate-200 px-4 py-1">
          <summary className={summaryStyles}>Unlock live agents</summary>
          <p className={mutedStyles}>Studio stays in demo mode until you accept the data-sharing notice below in this browser tab.</p>
          <div className="pb-3"><LiveAccess provider={p.provider} onUnlocked={p.onUnlocked} /></div>
        </details>
      ) : (
        <p className={mutedStyles}>
          This server has no {providerName} key ({keyName}), so Studio replays prepared demo output. Add the key to run
          live agents on your own brief.
        </p>
      ))}
      <p className={mutedStyles}>
        Static HTML, CSS, and JavaScript. Live runs use {providerName} only: {p.provider === "gemini"
          ? "the Gemini models configured on this server" : "free OpenRouter models"}, with no automatic fallback to another provider.
      </p>
      <Button disabled={!!designReason} disabledReason={designReason} onClick={() => p.run("plan")}>
        Design the website from this plan
      </Button>
      {p.design && (
        <>
          <label className={labelStyles}>
            Review and edit the website design
            <textarea value={p.design} maxLength={18000} disabled={!!p.busy} rows={8} className={fieldStyles}
              onChange={(e) => p.setDesign(e.target.value)} />
          </label>
          {p.live ? (
            <label className={labelStyles}>
              Automatic review rounds
              <select disabled={!!p.busy} value={p.rounds} className={fieldStyles}
                onChange={(e) => p.setRounds(Number(e.target.value))}>
                <option value={0}>Review only · 2 requests</option>
                <option value={1}>1 revision · 4 requests</option>
                <option value={2}>2 revisions · 6 requests</option>
              </select>
            </label>
          ) : (
            <p className={mutedStyles}>Demo runs one prepared build and one source review. Review rounds apply in Live mode.</p>
          )}
          <Button disabled={!!buildReason} disabledReason={buildReason} onClick={() => p.run("build")}>
            Approve design & build
          </Button>
        </>
      )}
      {p.busy && (
        <div role="status" aria-live="polite"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{p.busy}</p>
          <Button variant="secondary" onClick={p.stop}>Stop agents</Button>
        </div>
      )}
      <GithubSection live={p.live} busy={p.busy} github={p.github} onAction={p.onGithub} />
      <h2 className="text-lg font-semibold text-slate-900">The conversation</h2>
      <div role="log" aria-label="Agent handoffs" aria-live="polite" className="max-h-[28rem] space-y-3 overflow-y-auto">
        {p.messages.length ? p.messages.map((m, i) => (
          <article key={i} className="border-l-2 border-teal-700 py-1 pl-3">
            <strong className="text-sm text-slate-900">{m.role}</strong>
            {m.model && <small className="block text-xs text-slate-500">{m.model}</small>}
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{m.text}</p>
          </article>
        )) : (
          <p className={mutedStyles}>Agent decisions and review findings will appear here. The starter preview is local sample content.</p>
        )}
      </div>
      <label className={labelStyles}>
        Ask for a change
        <textarea value={p.feedback} disabled={!!p.busy} maxLength={18000} rows={3} className={fieldStyles}
          placeholder="Make the header smaller and add a working project filter…"
          onChange={(e) => p.setFeedback(e.target.value)} />
      </label>
      <Button disabled={!!reviseReason} disabledReason={reviseReason} onClick={() => p.run("revise")}>
        Revise with agents
      </Button>
    </Panel>
  );
}
